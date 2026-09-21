/**
 * AppDatabase：sql.js（asm.js 版，零 wasm 配置）封装 + 防抖持久化 + migration。
 * 重要数据不落 localStorage（FR-DATA-03）；损坏时明确报错不覆盖（DATA_SPEC §6）。
 */
import initSqlJs from 'sql.js/dist/sql-asm.js';
import type { Database } from 'sql.js';
import type { PersistenceBackend } from './backend';
import { MIGRATIONS } from './schema';

export type SqlParam = string | number | null;

export interface AppDatabaseDeps {
  backend: PersistenceBackend;
}

export class AppDatabase {
  private readonly db: Database;
  private readonly backend: PersistenceBackend;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  /** 是否有未落盘修改 */
  private dirty = false;
  /** 实例是否已关闭（关闭后挂起的防抖 timer 不得再触发 flush） */
  private closed = false;
  /** 写操作版本号：flush 据此判断保存期间是否又发生了新写入 */
  private revision = 0;
  /** flush 串行链：并发 flush 调用排队执行，杜绝交错保存 */
  private flushChain: Promise<void> = Promise.resolve();

  private constructor(db: Database, backend: PersistenceBackend) {
    this.db = db;
    this.backend = backend;
  }

  /** 打开（或创建）数据库并执行 migration */
  static async open(deps?: Partial<AppDatabaseDeps>): Promise<AppDatabase> {
    const backend = deps?.backend ?? (await import('./backend')).defaultBackend();
    const SQL = await initSqlJs();
    const bytes = await backend.load().catch((err: unknown) => {
      // 读取失败：不覆盖，带原始错误上抛（用户可导出备份排查）
      throw new Error(`学习数据读取失败：${err instanceof Error ? err.message : String(err)}`, { cause: err });
    });
    let db: Database;
    try {
      db = bytes === null ? new SQL.Database() : new SQL.Database(bytes);
    } catch (err) {
      throw new Error(`学习数据库损坏，无法打开（原文件保留在存储中）：${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
    const app = new AppDatabase(db, backend);
    app.migrate();
    return app;
  }

  /** 当前 schema 版本（meta 表尚未建立时视为 0） */
  get version(): number {
    try {
      const rows = this.all('SELECT value FROM meta WHERE key = ?', ['schema_version']);
      return rows.length === 0 ? 0 : Number(rows[0]!.value);
    } catch {
      return 0;
    }
  }

  /** 顺序执行 migration；单事务，失败回滚上抛 */
  private migrate(): void {
    const current = this.version;
    const target = MIGRATIONS.length;
    if (current >= target) return;
    this.db.run('BEGIN TRANSACTION');
    try {
      for (let v = current; v < target; v++) {
        MIGRATIONS[v]!(this);
        this.run('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
          'schema_version',
          String(v + 1),
        ]);
      }
      this.db.run('COMMIT');
    } catch (err) {
      this.db.run('ROLLBACK');
      throw new Error(`数据库迁移失败（v${current}→v${target}）：${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
    void this.schedulePersist();
  }

  /** 执行写语句 */
  run(sql: string, params: SqlParam[] = []): void {
    this.db.run(sql, params);
    this.markDirty();
    void this.schedulePersist();
  }

  /** 查询（返回对象数组） */
  all(sql: string, params: SqlParam[] = []): Array<Record<string, unknown>> {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const rows: Array<Record<string, unknown>> = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as Record<string, unknown>);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  /** 事务 */
  transaction(fn: () => void): void {
    this.db.run('BEGIN TRANSACTION');
    try {
      fn();
      this.db.run('COMMIT');
    } catch (err) {
      this.db.run('ROLLBACK');
      throw err;
    }
    this.markDirty();
    void this.schedulePersist();
  }

  /** 导出数据库字节（备份/持久化） */
  exportBytes(): Uint8Array {
    return this.db.export();
  }

  /** 标记脏数据（每次写操作递增版本号，供 flush 判断竞态窗口） */
  private markDirty(): void {
    this.revision += 1;
    this.dirty = true;
  }

  /** 防抖持久化（500ms） */
  async schedulePersist(): Promise<void> {
    this.dirty = true;
    if (this.persistTimer !== null) clearTimeout(this.persistTimer);
    return new Promise((resolve, reject) => {
      this.persistTimer = setTimeout(() => {
        this.persistTimer = null;
        this.flush().then(resolve, reject);
      }, 500);
    });
  }

  /**
   * 立即持久化（竞态安全）：
   * - 并发调用经 flushChain 串行化；
   * - while-dirty 循环：保存期间若发生新写入（revision 变化），dirty 保持 true，
   *   循环继续保存 —— 绝不丢失最后一次修改（P14 P0-4）。
   */
  async flush(): Promise<void> {
    if (this.closed) return;
    const run = this.flushChain.then(async () => {
      while (this.dirty) {
        const snapshotRev = this.revision;
        await this.backend.save(this.exportBytes());
        // 仅当保存期间没有新写入时才清除 dirty
        if (this.revision === snapshotRev) this.dirty = false;
      }
    });
    this.flushChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** 全量 JSON 导出（备份兜底，FR-DATA-04） */
  exportJson(): string {
    const tables = [
      'meta',
      'chapter_progress',
      'mastery',
      'attempt',
      'wrong_book',
      'submission',
      'coding_progress',
      'note',
      'favorite',
      'study_day',
      'settings',
    ];
    const out: Record<string, unknown> = { schemaVersion: this.version, exportedAt: new Date().toISOString() };
    for (const t of tables) {
      try {
        out[t] = this.all(`SELECT * FROM ${t}`);
      } catch {
        out[t] = [];
      }
    }
    return JSON.stringify(out, null, 2);
  }

  close(): void {
    this.closed = true;
    this.dirty = false;
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.db.close();
    this.backend.close?.();
  }
}

/** 应用级单例（由 AppStore 在启动时初始化） */
let singleton: AppDatabase | null = null;
/** 进行中的 open（并发 getDb() 复用同一 promise，杜绝双开实例） */
let opening: Promise<AppDatabase | null> | null = null;
/** open 代次：reset 期间挂起的 open 完成后不得再覆盖 singleton（防“复活”） */
let openToken = 0;

export async function getDb(): Promise<AppDatabase> {
  for (;;) {
    if (singleton !== null) return singleton;
    const token = openToken;
    if (opening === null) {
      opening = AppDatabase.open()
        .then((db) => {
          if (token !== openToken) {
            // open 期间发生了 reset：此实例已过期，关闭并重开
            db.close();
            return null;
          }
          singleton = db;
          return db;
        })
        .finally(() => {
          opening = null;
        });
    }
    const db = await opening;
    if (db !== null) return db;
  }
}

/**
 * 清空全部数据并重建数据库（设置页「清空全部数据」统一入口）。
 * 流程：关闭当前 sql.js 实例与底层连接 → backend.reset() 删除底层数据
 * （Web：IndexedDB 库；Electron：userData/cuincstructlab.db）→ 重新 open + migrate。
 */
export async function resetDatabase(deps?: Partial<AppDatabaseDeps>): Promise<AppDatabase> {
  openToken += 1;
  opening = null;
  if (singleton !== null) {
    singleton.close();
    singleton = null;
  }
  const backend = deps?.backend ?? (await import('./backend')).defaultBackend();
  await backend.reset();
  singleton = await AppDatabase.open({ ...deps, backend });
  return singleton;
}

/** 测试辅助：重置单例（先落盘未保存的修改再关闭，等价「正常退出前 flush」） */
export async function resetDbSingleton(): Promise<void> {
  openToken += 1;
  opening = null;
  if (singleton !== null) {
    const db = singleton;
    singleton = null;
    try {
      await db.flush();
    } catch (err) {
      console.error('resetDbSingleton: flush 失败', err);
    }
    db.close();
  }
}

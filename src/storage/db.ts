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
  private persisting = false;
  private dirty = false;

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
    void this.schedulePersist();
  }

  /** 导出数据库字节（备份/持久化） */
  exportBytes(): Uint8Array {
    return this.db.export();
  }

  /** 防抖持久化（500ms） */
  async schedulePersist(): Promise<void> {
    this.dirty = true;
    if (this.persistTimer !== null) clearTimeout(this.persistTimer);
    return new Promise((resolve) => {
      this.persistTimer = setTimeout(() => {
        void this.flush().then(() => resolve());
      }, 500);
    });
  }

  /** 立即持久化 */
  async flush(): Promise<void> {
    if (this.persisting || !this.dirty) return;
    this.persisting = true;
    try {
      await this.backend.save(this.exportBytes());
      this.dirty = false;
    } finally {
      this.persisting = false;
    }
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
    this.db.close();
    this.backend.close?.();
  }
}

/** 应用级单例（由 AppStore 在启动时初始化） */
let singleton: AppDatabase | null = null;

export async function getDb(): Promise<AppDatabase> {
  if (singleton === null) {
    singleton = await AppDatabase.open();
  }
  return singleton;
}

/** 测试辅助：重置单例 */
export function resetDbSingleton(): void {
  if (singleton !== null) {
    singleton.close();
    singleton = null;
  }
}

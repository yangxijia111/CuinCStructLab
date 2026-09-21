/**
 * 持久化后端（ARCHITECTURE.md §1.3）。
 * 浏览器：IndexedDB（库 cclab / key sqlite-db）；Electron：userData 文件（P12 提供桥接）。
 * 写失败必须上抛（NFR-06），绝不静默吞异常。
 */
export interface PersistenceBackend {
  /** 读取数据库字节；不存在返回 null */
  load(): Promise<Uint8Array | null>;
  /** 保存数据库字节 */
  save(data: Uint8Array): Promise<void>;
  /** 关闭底层连接（可选） */
  close?(): void;
  /** 删除底层数据库（清空全部数据；调用方须先关闭自身连接） */
  reset(): Promise<void>;
}

const DB_NAME = 'cclab';
const STORE = 'kv';
const KEY = 'sqlite-db';

/** 模块级共享连接：同一库的所有 backend 实例复用一个 IDBDatabase */
let sharedConn: IDBDatabase | null = null;

/** 浏览器 IndexedDB 后端 */
export class IndexedDbBackend implements PersistenceBackend {
  async load(): Promise<Uint8Array | null> {
    const db = await this.conn();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = (): void => {
        const value = req.result as Uint8Array | undefined;
        resolve(value ?? null);
      };
      req.onerror = (): void => reject(new Error(`IndexedDB 读取失败: ${String(req.error)}`));
    });
  }

  async save(data: Uint8Array): Promise<void> {
    const db = await this.conn();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(data, KEY);
      tx.oncomplete = (): void => resolve();
      tx.onerror = (): void => reject(new Error(`IndexedDB 写入失败: ${String(tx.error)}`));
      tx.onabort = (): void => reject(new Error('IndexedDB 事务中止（可能磁盘空间不足）'));
    });
  }

  close(): void {
    // close() 异步生效：连接在事务排空后真正关闭（此后 conn() 会重新打开）
    sharedConn?.close();
    sharedConn = null;
  }

  /**
   * 安全清空：先关闭共享连接，再删除数据库。
   * 真实浏览器中 close() 需等事务排空，期间 deleteDatabase 会 blocked →
   * 短暂轮询重试；超过上限仍阻塞则明确报错（绝不静默）。
   */
  async reset(): Promise<void> {
    this.close();
    for (let attempt = 0; ; attempt++) {
      const deleted = await new Promise<boolean>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = (): void => resolve(true);
        req.onerror = (): void => reject(new Error(`IndexedDB 删除失败: ${String(req.error)}`));
        req.onblocked = (): void => resolve(false); // 连接正在关闭，稍候重试
      });
      if (deleted) return;
      if (attempt >= 20) throw new Error('IndexedDB 删除被阻塞：仍有未关闭的连接');
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  private conn(): Promise<IDBDatabase> {
    if (sharedConn !== null) return Promise.resolve(sharedConn);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (): void => {
        req.result.createObjectStore(STORE);
      };
      req.onsuccess = (): void => {
        sharedConn = req.result;
        resolve(req.result);
      };
      req.onerror = (): void => reject(new Error(`IndexedDB 打开失败: ${String(req.error)}`));
    });
  }
}

/** 内存后端（测试用） */
export class MemoryBackend implements PersistenceBackend {
  private data: Uint8Array | null = null;
  load(): Promise<Uint8Array | null> {
    return Promise.resolve(this.data === null ? null : new Uint8Array(this.data));
  }
  save(data: Uint8Array): Promise<void> {
    this.data = new Uint8Array(data);
    return Promise.resolve();
  }
  async reset(): Promise<void> {
    this.data = null;
    await Promise.resolve();
  }
}

/** Electron 桌面版：主进程文件持久化（userData/cuincstructlab.db） */
export class ElectronFileBackend implements PersistenceBackend {
  async load(): Promise<Uint8Array | null> {
    const bridge = (globalThis as { cclabBridge?: { dbLoad(): Promise<Uint8Array | null> } }).cclabBridge;
    if (bridge === undefined) throw new Error('桌面桥不可用');
    return bridge.dbLoad();
  }

  async save(data: Uint8Array): Promise<void> {
    const bridge = (globalThis as { cclabBridge?: { dbSave(d: Uint8Array): Promise<void> } }).cclabBridge;
    if (bridge === undefined) throw new Error('桌面桥不可用');
    await bridge.dbSave(data);
  }

  /** 通过 IPC 删除 userData/cuincstructlab.db（主进程二次验证） */
  async reset(): Promise<void> {
    const bridge = (globalThis as { cclabBridge?: { dbReset?(): Promise<void> } }).cclabBridge;
    if (bridge === undefined || bridge.dbReset === undefined) throw new Error('桌面桥不可用');
    await bridge.dbReset();
  }
}

/** 检测运行环境并返回默认后端 */
export function defaultBackend(): PersistenceBackend {
  const bridge = (globalThis as { cclabBridge?: unknown }).cclabBridge;
  return bridge === undefined ? new IndexedDbBackend() : new ElectronFileBackend();
}

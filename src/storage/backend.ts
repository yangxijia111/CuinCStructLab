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
}

const DB_NAME = 'cclab';
const STORE = 'kv';
const KEY = 'sqlite-db';

/** 浏览器 IndexedDB 后端 */
export class IndexedDbBackend implements PersistenceBackend {
  private conn: IDBDatabase | null = null;

  async load(): Promise<Uint8Array | null> {
    const db = await this.open();
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
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(data, KEY);
      tx.oncomplete = (): void => resolve();
      tx.onerror = (): void => reject(new Error(`IndexedDB 写入失败: ${String(tx.error)}`));
      tx.onabort = (): void => reject(new Error('IndexedDB 事务中止（可能磁盘空间不足）'));
    });
  }

  close(): void {
    this.conn?.close();
    this.conn = null;
  }

  private open(): Promise<IDBDatabase> {
    if (this.conn !== null) return Promise.resolve(this.conn);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (): void => {
        req.result.createObjectStore(STORE);
      };
      req.onsuccess = (): void => {
        this.conn = req.result;
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
}

/** 检测运行环境并返回默认后端（Electron 文件桥接由 P12 注入） */
export function defaultBackend(): PersistenceBackend {
  return new IndexedDbBackend();
}

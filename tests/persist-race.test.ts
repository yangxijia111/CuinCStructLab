/**
 * 持久化竞态回归（P14 P0-4）：
 * flush 进行期间的新写入必须触发后续保存，绝不因旧 flush 完成而清掉 dirty 丢失修改。
 * 压力场景：连续快速写 100 次、persist 期间继续写 → 最终落盘必须是最新状态。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppDatabase, resetDbSingleton } from '../src/storage/db';
import type { PersistenceBackend } from '../src/storage/backend';
import * as repos from '../src/storage/repos';

/** 第一次 save 挂起（可控放行）、后续立即完成的 backend：精确复现“保存进行中又发生写” */
class BlockingBackend implements PersistenceBackend {
  readonly snapshots: Uint8Array[] = [];
  private block = true;
  private release: (() => void) | null = null;

  load(): Promise<Uint8Array | null> {
    return Promise.resolve(this.snapshots.at(-1) ?? null);
  }

  save(data: Uint8Array): Promise<void> {
    this.snapshots.push(new Uint8Array(data));
    if (this.block) {
      this.block = false;
      return new Promise<void>((resolve) => {
        this.release = resolve;
      });
    }
    return Promise.resolve();
  }

  async reset(): Promise<void> {
    this.snapshots.length = 0;
    this.block = true;
    this.release = null;
  }

  releaseFirst(): void {
    this.release?.();
    this.release = null;
  }

  /** 第一次 save 是否仍挂起 */
  get blocked(): boolean {
    return this.release !== null;
  }
}

beforeEach(() => {
  resetDbSingleton();
});

describe('flush 竞态', () => {
  it('flush 进行期间的写入不会被旧 flush 清掉 dirty（revision 语义）', async () => {
    const backend = new BlockingBackend();
    const db = await AppDatabase.open({ backend });

    // 第 1 次写 + 主动 flush（save 挂起，未完成）
    repos.saveSetting(db, 'key', 'A');
    const flushing = db.flush();
    await vi.waitFor(() => expect(backend.blocked).toBe(true));

    // 保存进行中又发生新写（关键竞态窗口）
    repos.saveSetting(db, 'key', 'B');

    backend.releaseFirst();
    await flushing; // 旧 flush 完成；新写入必须已触发后续保存

    // 最终落盘为最新值 B
    const finalDb = await AppDatabase.open({ backend });
    expect(repos.loadSettings(finalDb).key).toBe('B');
    finalDb.close();
    db.close();
  });

  it('连续快速写 100 次 → flush → 落盘为最新状态', async () => {
    const backend = new BlockingBackend();
    const db = await AppDatabase.open({ backend });
    for (let i = 1; i <= 100; i++) {
      repos.saveSetting(db, 'counter', String(i));
    }
    const flushing = db.flush();
    await vi.waitFor(() => expect(backend.blocked).toBe(true));
    backend.releaseFirst();
    await flushing;

    const finalDb = await AppDatabase.open({ backend });
    expect(repos.loadSettings(finalDb).counter).toBe('100');
    finalDb.close();
    db.close();
  });

  it('persist 期间继续写 + 压力写交错：最终内容完整（100 次高频写含竞态窗口）', async () => {
    const backend = new BlockingBackend();
    const db = await AppDatabase.open({ backend });

    repos.saveSetting(db, 'stage', 'first');
    const flushing = db.flush(); // save 挂起
    await vi.waitFor(() => expect(backend.blocked).toBe(true));
    for (let i = 1; i <= 100; i++) {
      repos.saveSetting(db, 'burst', String(i)); // 保存期间高频写入
    }
    backend.releaseFirst();
    await flushing; // while-dirty 自动补存，直到最新状态落盘

    const finalDb = await AppDatabase.open({ backend });
    const settings = repos.loadSettings(finalDb);
    expect(settings.burst).toBe('100');
    expect(settings.stage).toBe('first');
    finalDb.close();
    db.close();
  });

  it('并发 flush 调用安全（串行链不产生交错损坏）', async () => {
    const backend = new BlockingBackend();
    const db = await AppDatabase.open({ backend });
    repos.saveSetting(db, 'c', '1');
    repos.saveSetting(db, 'c', '2');
    const all = Promise.all([db.flush(), db.flush(), db.flush()]);
    await vi.waitFor(() => expect(backend.blocked).toBe(true));
    backend.releaseFirst();
    await all;

    const finalDb = await AppDatabase.open({ backend });
    expect(repos.loadSettings(finalDb).c).toBe('2');
    finalDb.close();
    db.close();
  });
});

/**
 * 持久化集成测试：真实 sql.js + IndexedDbBackend（fake-indexeddb）。
 * 验证 v1.0 完成标准："页面刷新/重启后数据不会丢失"。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { AppDatabase, resetDbSingleton } from '../src/storage/db';
import { IndexedDbBackend } from '../src/storage/backend';
import * as repos from '../src/storage/repos';

// fake-indexeddb 在 setup.ts 全局注入

async function reopen(): Promise<AppDatabase> {
  await resetDbSingleton();
  return AppDatabase.open({ backend: new IndexedDbBackend() });
}

beforeEach(async () => {
  // 清空 IndexedDB
  await resetDbSingleton();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('cclab');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => resolve();
    req.onblocked = (): void => resolve();
  });
});

describe('数据持久化（模拟刷新/重启）', () => {
  it('写入 → 刷新（重新打开）→ 数据仍在', async () => {
    const db1 = await reopen();
    repos.saveChapterVisit(db1, 3, 2);
    repos.saveAttempt(db1, 'ch03-q01', 3, false, 'A');
    repos.saveWrong(db1, 'ch03-q01', 'pointer');
    repos.saveNote(db1, 'chapter', '3', '接线顺序两步不能反');
    repos.saveSetting(db1, 'theme', 'light');
    await db1.flush();
    db1.close();

    // 模拟应用重启
    const db2 = await reopen();
    const progress = repos.loadChapterProgress(db2);
    expect(progress[3]?.visitCount).toBe(1);
    expect(progress[3]?.maxSectionIndex).toBe(2);
    expect(progress[3]?.status).toBe('learning');

    const attempts = repos.loadAttempts(db2);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.correct).toBe(false);

    const wrong = repos.loadWrongBook(db2);
    expect(wrong['ch03-q01']?.wrongCount).toBe(1);

    expect(repos.loadNotes(db2)['chapter:3']).toBe('接线顺序两步不能反');
    expect(repos.loadSettings(db2).theme).toBe('light');
    db2.close();
  });

  it('多次写入合并持久化（覆盖旧版本）', async () => {
    const db1 = await reopen();
    repos.saveWrong(db1, 'e1', 'concept');
    repos.saveWrong(db1, 'e1', 'concept');
    await db1.flush();
    db1.close();

    const db2 = await reopen();
    expect(repos.loadWrongBook(db2)['e1']?.wrongCount).toBe(2);
    repos.markWrongMastered(db2, 'e1');
    await db2.flush();
    db2.close();

    const db3 = await reopen();
    expect(repos.loadWrongBook(db3)['e1']?.mastered).toBe(true);
    db3.close();
  });

  it('学习日活按天聚合', async () => {
    const db1 = await reopen();
    repos.saveAttempt(db1, 'a', 1, true, 'x');
    repos.saveChapterVisit(db1, 1, 0);
    await db1.flush();
    const days = repos.loadStudyDays(db1);
    expect(days).toHaveLength(1);
    expect(days[0]?.events).toBe(2);
    db1.close();
  });

  it('JSON 导出包含全部表', async () => {
    const db = await reopen();
    repos.saveSetting(db, 'k', 'v');
    const json = JSON.parse(db.exportJson()) as Record<string, unknown>;
    expect(json.schemaVersion).toBe(1);
    expect(Array.isArray(json.settings)).toBe(true);
    db.close();
  });
});

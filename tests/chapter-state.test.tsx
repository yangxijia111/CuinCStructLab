/**
 * 章节完成状态单调性（P14 P0-2）：done 是终态，重新访问不得降级为 learning。
 * 状态机只允许 new → learning → done；分别在 内存态 / SQLite / 刷新恢复 三层验证。
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { AppDatabase, resetDbSingleton } from '../src/storage/db';
import { IndexedDbBackend } from '../src/storage/backend';
import * as repos from '../src/storage/repos';
import { AppStoreProvider, useAppStore } from '../src/ui/AppStore';

// fake-indexeddb 在 setup.ts 全局注入

async function reopen(): Promise<AppDatabase> {
  await resetDbSingleton();
  return AppDatabase.open({ backend: new IndexedDbBackend() });
}

beforeEach(async () => {
  await resetDbSingleton();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('cclab');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => resolve();
    req.onblocked = (): void => resolve();
  });
});

describe('SQLite 层：done 不被 visitChapter 降级', () => {
  it('done 后再次 visit，status 保持 done', async () => {
    const db = await reopen();
    repos.saveChapterVisit(db, 3, 0);
    expect(repos.loadChapterProgress(db)[3]?.status).toBe('learning');
    repos.saveChapterDone(db, 3);
    expect(repos.loadChapterProgress(db)[3]?.status).toBe('done');
    // 已完成章节重新打开（访问第 0 节）
    repos.saveChapterVisit(db, 3, 0);
    expect(repos.loadChapterProgress(db)[3]?.status).toBe('done');
    db.close();
  });

  it('刷新恢复：done 后重复访问 + 重开数据库，status 仍为 done', async () => {
    const db1 = await reopen();
    repos.saveChapterVisit(db1, 5, 1);
    repos.saveChapterDone(db1, 5);
    repos.saveChapterVisit(db1, 5, 2); // 复习时翻到第 2 节
    await db1.flush();
    db1.close();

    const db2 = await reopen();
    const progress = repos.loadChapterProgress(db2);
    expect(progress[5]?.status).toBe('done');
    expect(progress[5]?.maxSectionIndex).toBe(2); // 其他字段正常更新
    expect(progress[5]?.visitCount).toBe(2);
    db2.close();
  });
});

describe('内存态（AppStore hook）：done 不被 visitChapter 降级', () => {
  it('markChapterDone 后 visitChapter，progress 保持 done', async () => {
    const wrapper = ({ children }: { children: ReactNode }): ReactNode => <AppStoreProvider>{children}</AppStoreProvider>;
    const { result } = renderHook(() => useAppStore(), { wrapper });
    await waitFor(() => expect(result.current.storageReady).toBe(true));

    act(() => result.current.visitChapter(7, 0));
    expect(result.current.progress[7]?.status).toBe('learning');

    act(() => result.current.markChapterDone(7));
    expect(result.current.progress[7]?.status).toBe('done');

    // 复习：重新打开已完成章节 → 不得降级
    act(() => result.current.visitChapter(7, 3));
    expect(result.current.progress[7]?.status).toBe('done');
    expect(result.current.progress[7]?.maxSectionIndex).toBe(13); // done 时已标记全部节，max 不回落
  });
});

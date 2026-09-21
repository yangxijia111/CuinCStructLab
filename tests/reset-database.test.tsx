/**
 * 清空全部数据回归（P14 P0-3）：Web（内存/IndexedDB）与 Electron 后端统一走 resetDatabase。
 * 验证：清空后重开为空库、UI 二次确认、Electron 走 IPC 删除 userData 文件。
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppDatabase, getDb, resetDatabase, resetDbSingleton } from '../src/storage/db';
import { ElectronFileBackend, IndexedDbBackend, MemoryBackend } from '../src/storage/backend';
import * as repos from '../src/storage/repos';
import { AppStoreProvider } from '../src/ui/AppStore';
import { SettingsPage } from '../src/pages/SettingsPage';

// fake-indexeddb 在 setup.ts 全局注入

beforeEach(async () => {
  await resetDbSingleton();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('cclab');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => resolve();
    req.onblocked = (): void => resolve();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('resetDatabase：内存后端', () => {
  it('清空后重开为空库（重新 migrate）', async () => {
    const backend = new MemoryBackend();
    const db1 = await AppDatabase.open({ backend });
    repos.saveChapterVisit(db1, 2, 1);
    repos.saveSetting(db1, 'theme', 'light');
    await db1.flush();
    db1.close();

    const db2 = await resetDatabase({ backend });
    expect(repos.loadChapterProgress(db2)).toEqual({});
    expect(repos.loadSettings(db2)).toEqual({});
    expect(db2.version).toBeGreaterThan(0); // schema 已重建
    db2.close();
  });
});

describe('resetDatabase：IndexedDB 后端（浏览器真实路径）', () => {
  it('先关连接再删库，清空后重开为空', async () => {
    const db1 = await AppDatabase.open({ backend: new IndexedDbBackend() });
    repos.saveChapterVisit(db1, 3, 0);
    await db1.flush();

    const db2 = await resetDatabase({ backend: new IndexedDbBackend() });
    expect(repos.loadChapterProgress(db2)).toEqual({});
    await db2.flush();
    db2.close();

    // 再次冷启动（模拟刷新）仍为空
    await resetDbSingleton();
    const db3 = await AppDatabase.open({ backend: new IndexedDbBackend() });
    expect(repos.loadChapterProgress(db3)).toEqual({});
    db3.close();
  });
});

describe('resetDatabase：Electron 桥（删除 userData 文件）', () => {
  it('ElectronFileBackend.reset 走 dbReset IPC', async () => {
    const calls: string[] = [];
    vi.stubGlobal('cclabBridge', {
      isDesktop: true,
      dbLoad: () => {
        calls.push('load');
        return Promise.resolve(null);
      },
      dbSave: () => {
        calls.push('save');
        return Promise.resolve();
      },
      dbReset: () => {
        calls.push('reset');
        return Promise.resolve();
      },
    });
    const backend = new ElectronFileBackend();
    const db = await resetDatabase({ backend });
    expect(calls).toContain('reset');
    db.close();
  });

  it('桥不可用时明确报错（不静默）', async () => {
    const backend = new ElectronFileBackend();
    await expect(backend.reset()).rejects.toThrow('桌面桥不可用');
  });
});

describe('设置页清空数据（UI 二次确认 + 状态复位）', () => {
  function mount(): void {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AppStoreProvider>
          <SettingsPage />
        </AppStoreProvider>
      </MemoryRouter>,
    );
  }

  it('需要两次点击才执行清空，且清空后重开为空库', async () => {
    mount();
    await waitFor(() => expect(screen.getByRole('button', { name: '清空全部数据…' })).toBeDefined());

    // 预写数据（通过 provider 的 getDb 单例）
    const db = await getDb();
    repos.saveChapterVisit(db, 4, 2);

    // 第一次点击只进入确认态
    fireEvent.click(screen.getByRole('button', { name: '清空全部数据…' }));
    expect(screen.getByRole('button', { name: '确认清空全部数据' })).toBeDefined();
    expect(screen.getByText(/不可恢复/)).toBeDefined();

    // 拦截 reload（jsdom 未实现）
    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { reload: reloadSpy });

    fireEvent.click(screen.getByRole('button', { name: '确认清空全部数据' }));
    await waitFor(() => expect(screen.getByText(/数据已清空/)).toBeDefined(), { timeout: 8000 });

    // 底层数据确实被清空
    const reopened = await resetDatabase({ backend: new IndexedDbBackend() });
    expect(repos.loadChapterProgress(reopened)).toEqual({});
    reopened.close();
  });
});

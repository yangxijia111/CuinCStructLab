/**
 * 数据导入回归（P14 P1-5）：
 * 校验（损坏 JSON/未来版本/非法字段/未知表）、roundtrip、事务导入不破坏现有库、UI 流程。
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppDatabase, getDb, resetDbSingleton } from '../src/storage/db';
import { MemoryBackend } from '../src/storage/backend';
import * as repos from '../src/storage/repos';
import { validateImportPayload, importData } from '../src/storage/import';
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

/** 造一份合法导出 JSON（与 exportJson 同构） */
function makeExport(overrides?: Partial<Record<string, unknown>>): string {
  const data: Record<string, unknown> = {
    schemaVersion: 1,
    exportedAt: '2026-09-22T00:00:00.000Z',
    meta: [{ key: 'schema_version', value: '1' }],
    chapter_progress: [{ chapter: 3, status: 'done', lastVisitAt: 100, visitCount: 2, maxSectionIndex: 13 }],
    attempt: [{ id: 1, exerciseId: 'ch03-q01', chapter: 3, correct: 0, userAnswer: 'A', createdAt: 100 }],
    wrong_book: [{ exerciseId: 'ch03-q01', errorCategory: 'pointer', wrongCount: 1, lastWrongAt: 100, mastered: 0, masteredAt: null }],
    settings: [{ key: 'theme', value: 'light' }],
    note: [],
    favorite: [],
    study_day: [{ day: '2026-09-22', events: 3 }],
    mastery: [],
    submission: [],
    coding_progress: [],
    ...overrides,
  };
  return JSON.stringify(data);
}

describe('validateImportPayload：校验与拒绝', () => {
  it('合法导出通过并给出预览', () => {
    const r = validateImportPayload(makeExport());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.preview.schemaVersion).toBe(1);
      expect(r.preview.totalRows).toBeGreaterThan(0);
      expect(r.preview.counts.find((c) => c.table === 'chapter_progress')?.rows).toBe(1);
    }
  });

  it('损坏 JSON 拒绝', () => {
    const r = validateImportPayload('{"schemaVersion": 1, "settings": [broken');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('损坏的 JSON');
  });

  it('未来版本拒绝', () => {
    const r = validateImportPayload(makeExport({ schemaVersion: 99 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toContain('高于当前应用支持');
  });

  it('非法枚举（chapter_progress.status）拒绝', () => {
    const bad = JSON.parse(makeExport()) as Record<string, unknown>;
    (bad.chapter_progress as Array<Record<string, unknown>>)[0]!.status = 'hacked';
    const r = validateImportPayload(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toContain('status 非法');
  });

  it('字段类型错误（correct 为字符串）拒绝', () => {
    const bad = JSON.parse(makeExport()) as Record<string, unknown>;
    (bad.attempt as Array<Record<string, unknown>>)[0]!.correct = 'yes';
    const r = validateImportPayload(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toContain('correct');
  });

  it('行不是对象 / 表不是数组拒绝', () => {
    const r1 = validateImportPayload(makeExport({ settings: 'not-array' }));
    expect(r1.ok).toBe(false);
    const r2 = validateImportPayload(makeExport({ favorite: ['x'] }));
    expect(r2.ok).toBe(false);
  });

  it('未知表拒绝；缺失表允许', () => {
    const bad = JSON.parse(makeExport()) as Record<string, unknown>;
    bad.unknown_table = [{ a: 1 }];
    const r = validateImportPayload(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toContain('未知的表');

    const minimal = JSON.stringify({ schemaVersion: 1, exportedAt: 'x', settings: [] });
    const ok = validateImportPayload(minimal);
    expect(ok.ok).toBe(true);
  });

  it('超大小上限拒绝', () => {
    const r = validateImportPayload('x'.repeat(33 * 1024 * 1024));
    expect(r.ok).toBe(false);
  });
});

describe('importData：事务导入与 roundtrip', () => {
  it('导出 → 导入新库 → 内容一致（roundtrip）', async () => {
    const backend1 = new MemoryBackend();
    const db1 = await AppDatabase.open({ backend: backend1 });
    repos.saveChapterVisit(db1, 5, 2);
    repos.saveChapterDone(db1, 5);
    repos.saveAttempt(db1, 'ch05-q01', 5, true, '"B"');
    repos.saveWrong(db1, 'ch05-q01', 'boundary');
    repos.saveNote(db1, 'chapter', '5', '注意取模回绕');
    repos.saveSetting(db1, 'theme', 'light');
    await db1.flush();

    const json = db1.exportJson();
    const check = validateImportPayload(json);
    expect(check.ok).toBe(true);
    if (!check.ok) return;

    const backend2 = new MemoryBackend();
    const db2 = await AppDatabase.open({ backend: backend2 });
    importData(db2, check.data);
    await db2.flush();

    expect(repos.loadChapterProgress(db2)[5]?.status).toBe('done');
    expect(repos.loadAttempts(db2)).toHaveLength(1);
    expect(repos.loadAttempts(db2)[0]?.correct).toBe(true);
    expect(repos.loadWrongBook(db2)['ch05-q01']?.wrongCount).toBe(1);
    expect(repos.loadNotes(db2)['chapter:5']).toBe('注意取模回绕');
    expect(repos.loadSettings(db2).theme).toBe('light');
    db1.close();
    db2.close();
  });

  it('导入覆盖现有库（清空重灌）', async () => {
    const backend = new MemoryBackend();
    const db = await AppDatabase.open({ backend });
    repos.saveSetting(db, 'old', 'data');
    await db.flush();

    const check = validateImportPayload(makeExport());
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    importData(db, check.data);

    expect(repos.loadSettings(db).theme).toBe('light');
    expect(repos.loadSettings(db).old).toBeUndefined();
    expect(repos.loadChapterProgress(db)[3]?.status).toBe('done');
    db.close();
  });

  it('导入中途失败事务回滚：现有数据不受影响', async () => {
    const backend = new MemoryBackend();
    const db = await AppDatabase.open({ backend });
    repos.saveSetting(db, 'keep', 'me');
    await db.flush();

    const check = validateImportPayload(makeExport());
    expect(check.ok).toBe(true);
    if (!check.ok) return;

    // 注入失败：第 3 次 run 抛错（导入的多条语句中途失败）
    const originalRun = db.run.bind(db);
    let calls = 0;
    vi.spyOn(db, 'run').mockImplementation((sql: string, params?: Array<string | number | null>) => {
      calls += 1;
      if (calls === 3) throw new Error('注入的磁盘故障');
      return originalRun(sql, params);
    });
    expect(() => importData(db, check.data)).toThrow('注入的磁盘故障');
    vi.restoreAllMocks();

    // 回滚后：原数据完好，导入数据未出现
    expect(repos.loadSettings(db).keep).toBe('me');
    expect(repos.loadChapterProgress(db)[3]).toBeUndefined();
    db.close();
  });

  it('校验失败路径完全不触碰数据库', async () => {
    const backend = new MemoryBackend();
    const db = await AppDatabase.open({ backend });
    repos.saveSetting(db, 'untouched', 'yes');
    const r = validateImportPayload('not json at all');
    expect(r.ok).toBe(false);
    expect(repos.loadSettings(db).untouched).toBe('yes');
    db.close();
  });
});

describe('设置页导入 UI（预览 + 确认）', () => {
  it('选择合法文件 → 预览 → 确认导入 → 数据落库', async () => {
    // jsdom 不实现 createObjectURL（导入前自动备份用）
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (): string => 'blob:mock',
      revokeObjectURL: (): void => undefined,
    });
    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { reload: reloadSpy });

    // 预写当前库数据（将被导入覆盖）
    const db0 = await getDb();
    repos.saveSetting(db0, 'will-be', 'replaced');

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AppStoreProvider>
          <SettingsPage />
        </AppStoreProvider>
      </MemoryRouter>,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    const file = new File([makeExport()], 'backup.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText(/导入预览/)).toBeDefined());
    expect(screen.getByText(/确认导入/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '确认导入' }));
    await waitFor(() => expect(screen.getByText(/导入完成/)).toBeDefined(), { timeout: 8000 });

    const db = await getDb();
    expect(repos.loadChapterProgress(db)[3]?.status).toBe('done');
    expect(repos.loadSettings(db).theme).toBe('light');
    expect(repos.loadSettings(db)['will-be']).toBeUndefined();
  }, 20000);

  it('选择非法文件 → 明确报错且无预览', async () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AppStoreProvider>
          <SettingsPage />
        </AppStoreProvider>
      </MemoryRouter>,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{broken'], 'broken.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/导入失败（文件未做任何改动）/)).toBeDefined());
    expect(screen.queryByText(/导入预览/)).toBeNull();
  });
});

/**
 * 自定义编译器设置链路回归（P14 P1-2）：
 * 浏览→检测→显示版本→保存路径→重启恢复→CodingPage 使用；
 * 自定义路径失效自动回退 PATH 探测并明确提示。
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppDatabase, getDb, resetDbSingleton } from '../src/storage/db';
import { IndexedDbBackend } from '../src/storage/backend';
import * as repos from '../src/storage/repos';
import { detectCompilersWithFallback, registerNodeRunner } from '../src/runner/runner';
import type { NodeRunnerImplementation, RunnerAvailability } from '../src/runner/runner';
import { AppStoreProvider } from '../src/ui/AppStore';
import { SettingsPage } from '../src/pages/SettingsPage';

// fake-indexeddb 在 setup.ts 全局注入

const unavailable = (reason: string): RunnerAvailability => ({ available: false, reason, installHint: '', compiler: null });
const available = (path: string, version: string): RunnerAvailability => ({
  available: true,
  reason: '',
  installHint: '',
  compiler: { kind: 'gcc', path, version },
});

function useRunnerStub(impl: Partial<NodeRunnerImplementation>): void {
  registerNodeRunner({
    detectCompiler: impl.detectCompiler ?? ((): Promise<RunnerAvailability> => Promise.resolve(unavailable('no compiler'))),
    compileAndRun: impl.compileAndRun ?? ((): never => {
      throw new Error('unused in this suite');
    }),
  });
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

afterEach(() => {
  registerNodeRunner(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('detectCompilersWithFallback', () => {
  it('自定义路径可用：直接使用，无回退提示', async () => {
    const seen: Array<string | undefined> = [];
    useRunnerStub({
      detectCompiler: (p) => {
        seen.push(p);
        return Promise.resolve(p ? available(p, 'gcc 14') : unavailable('PATH no gcc'));
      },
    });
    const r = await detectCompilersWithFallback('C:\\tools\\gcc.exe');
    expect(r.available).toBe(true);
    expect(r.compiler?.path).toBe('C:\\tools\\gcc.exe');
    expect(r.reason).toBe('');
    expect(seen).toEqual(['C:\\tools\\gcc.exe']);
  });

  it('自定义路径失效：自动回退 PATH 探测并明确提示', async () => {
    useRunnerStub({
      detectCompiler: (p) =>
        Promise.resolve(p === undefined ? available('gcc', 'gcc 13.2 (PATH)') : unavailable(`指定的编译器路径无法执行：${p}`)),
    });
    const r = await detectCompilersWithFallback('C:\\broken\\clang.exe');
    expect(r.available).toBe(true);
    expect(r.compiler?.path).toBe('gcc');
    expect(r.reason).toContain('自定义路径不可用');
    expect(r.reason).toContain('回退');
  });

  it('自定义路径与 PATH 均不可用：保留完整失败原因', async () => {
    useRunnerStub({
      detectCompiler: (p) => Promise.resolve(unavailable(p === undefined ? '未探测到 C 编译器' : `路径无法执行：${p}`)),
    });
    const r = await detectCompilersWithFallback('C:\\broken\\gcc.exe');
    expect(r.available).toBe(false);
    expect(r.reason).toContain('路径无法执行');
    expect(r.reason).toContain('未探测到');
  });

  it('空路径视为自动探测（不触发回退分支）', async () => {
    const seen: Array<string | undefined> = [];
    useRunnerStub({
      detectCompiler: (p) => {
        seen.push(p);
        return Promise.resolve(available('gcc', 'v1'));
      },
    });
    const r = await detectCompilersWithFallback('   ');
    expect(r.available).toBe(true);
    expect(seen).toEqual([undefined]);
  });
});

describe('编译器设置持久化（重启恢复）', () => {
  it('setCompilerPath 写入 settings 表；重开数据库后恢复', async () => {
    const backend = new IndexedDbBackend();
    const db1 = await AppDatabase.open({ backend });
    repos.saveSetting(db1, 'compilerPath', 'C:\\msys64\\mingw64\\bin\\gcc.exe');
    await db1.flush();
    db1.close();

    const db2 = await AppDatabase.open({ backend });
    expect(repos.loadSettings(db2).compilerPath).toBe('C:\\msys64\\mingw64\\bin\\gcc.exe');
    db2.close();
  });
});

describe('设置页编译器 UI', () => {
  function mount(): void {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AppStoreProvider>
          <SettingsPage />
        </AppStoreProvider>
      </MemoryRouter>,
    );
  }

  it('检测并保存 → 卸载重挂后恢复（重启语义，同测试内完成避免跨用例单例纠缠）', async () => {
    useRunnerStub({
      detectCompiler: (p) => Promise.resolve(p ? available(p, 'gcc 15.1') : unavailable('未探测到 C 编译器')),
    });
    mount();
    const input = await waitFor(() => {
      const el = screen.getByPlaceholderText(/gcc\.exe/);
      expect(el).toBeDefined();
      return el as HTMLInputElement;
    });
    fireEvent.change(input, { target: { value: 'D:\\winlibs\\gcc.exe' } });
    fireEvent.click(screen.getByRole('button', { name: '检测并保存' }));

    await waitFor(() => expect(screen.getByText(/gcc 15\.1/)).toBeDefined());
    expect(screen.getByText(/D:\\winlibs\\gcc\.exe/)).toBeDefined();
    // 写入存储层（AppStore withDb → getDb 单例；持久化 roundtrip 另有专项测试）
    const db = await getDb();
    await waitFor(() => {
      expect(repos.loadSettings(db).compilerPath).toBe('D:\\winlibs\\gcc.exe');
    });

    // 模拟应用重启：卸载组件 + 关闭单例（数据已 flush 到 settings 表）
    cleanup();
    await resetDbSingleton();

    mount();
    const input2 = await waitFor(() => {
      const el = screen.getByPlaceholderText(/gcc\.exe/);
      expect(el).toBeDefined();
      return el as HTMLInputElement;
    });
    // 输入框初值来自持久化的 compilerPath（重启恢复）
    await waitFor(() => expect((input2 as HTMLInputElement).value).toBe('D:\\winlibs\\gcc.exe'));
  });

  it('浏览器模式下浏览按钮给出明确提示', async () => {
    useRunnerStub({});
    mount();
    fireEvent.click(screen.getByRole('button', { name: '浏览…' }));
    await waitFor(() => expect(screen.getByText(/仅桌面版可用/)).toBeDefined());
  });
});

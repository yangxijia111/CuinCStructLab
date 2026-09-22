/**
 * Compiler Adapter 单元测试（mock execProbe：stdout/stderr/exitCode 可控）。
 * 覆盖 COMPILER_ADAPTER_SPEC：版本解析、签名验证、customPath 消歧、MSVC 环境提示、classifyExit。
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(path.join(process.cwd(), 'package.json'));

interface ProbeRaw {
  ran: boolean;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}
interface ProbeOutcome {
  found: boolean;
  version: string | null;
  reason: string;
}
interface Adapter {
  kind: 'gcc' | 'clang' | 'cl';
  versionArgs(): string[];
  probe(cmd: string): Promise<ProbeOutcome>;
  buildCompileArgs(binaryPath: string, sourcePath: string): string[];
  getEnvironmentInfo(): Record<string, boolean>;
}
interface Adapters {
  gcc: Adapter;
  clang: Adapter;
  cl: Adapter;
}

const { createCompilerAdapters, guessAdapterOrder, detectCompilerAdapter, classifyExit, MSVC_ENV_HINT } = require(
  path.join(process.cwd(), 'electron', 'compiler-adapters.cjs'),
) as {
  createCompilerAdapters: (probe?: (cmd: string, args: string[], t?: number) => Promise<ProbeRaw>) => Adapters;
  guessAdapterOrder: (p: string, adapters: Adapters) => Adapter[];
  detectCompilerAdapter: (customPath: string | undefined, adapters: Adapters, platform?: string) => Promise<{
    available: boolean;
    reason: string;
    installHint: string;
    compiler: { kind: string; path: string; version: string } | null;
  }>;
  classifyExit: (o: { exitCode: number | null; signal: string | null; timedOut: boolean; spawnError: string | null }) => string;
  MSVC_ENV_HINT: string;
};

/** 按 cmd 返回 mock 探测结果 */
function adaptersFor(script: Record<string, { ran?: boolean; exitCode?: number | null; stdout?: string; stderr?: string }>): Adapters {
  const probe = async (cmd: string): Promise<ProbeRaw> =>
    Promise.resolve({
      ran: script[cmd]?.ran ?? true,
      exitCode: script[cmd]?.exitCode ?? 0,
      signal: null,
      stdout: script[cmd]?.stdout ?? '',
      stderr: script[cmd]?.stderr ?? '',
      durationMs: 0,
    });
  return createCompilerAdapters(probe as never);
}

describe('版本解析与签名验证', () => {
  it('GCC：stdout 首行为版本，签名匹配', async () => {
    const a = adaptersFor({ gcc: { exitCode: 0, stdout: 'gcc (Ubuntu 13.2.0) 13.2.0\nCopyright (C) 2023 Free Software Foundation, Inc.\n' } });
    const r = await a.gcc.probe('gcc');
    expect(r.found).toBe(true);
    expect(r.version).toBe('gcc (Ubuntu 13.2.0) 13.2.0');
  });

  it('Clang：签名 /clang/i 匹配', async () => {
    const a = adaptersFor({ clang: { exitCode: 0, stdout: 'Ubuntu clang version 17.0.6 (1~llvm17)\n' } });
    const r = await a.clang.probe('clang');
    expect(r.found).toBe(true);
    expect(r.version).toContain('clang version 17');
  });

  it('任意 exe（如 node）输出无签名 → 拒绝（D2 修复验证）', async () => {
    const a = adaptersFor({ 'C:/tools/fake-gcc.exe': { exitCode: 0, stdout: 'v22.0.0\nSome runtime output\n' } });
    const r = await a.gcc.probe('C:/tools/fake-gcc.exe');
    expect(r.found).toBe(false);
  });

  it('spawn 启动失败（ran=false）→ 不 found', async () => {
    const a = adaptersFor({ gcc: { ran: false } });
    const r = await a.gcc.probe('gcc');
    expect(r.found).toBe(false);
  });
});

describe('MSVC 适配器（D1/D3/D4 修复验证）', () => {
  const banner = {
    exitCode: 2,
    stdout: '',
    stderr: 'Microsoft (R) C/C++ Optimizing Compiler Version 19.38.33133 for x64\nCopyright (C) Microsoft Corporation. All rights reserved.\nusage: cl [ option... ] filename... [ /link linkoption... ]\n',
  };

  it('banner 在 stderr、退出码非 0 → 仍正确识别并解析版本', async () => {
    const a = adaptersFor({ cl: banner });
    const r = await a.cl.probe('cl');
    expect(r.found).toBe(true);
    expect(r.version).toBe('MSVC 19.38.33133');
  });

  it('编译参数：/nologo /W4 /EHsc /std:c11 /Fe:（c11 支持教学 C99 语法）', () => {
    const a = adaptersFor({});
    expect(a.cl.buildCompileArgs('C:/t/program.exe', 'C:/t/main.c')).toEqual([
      '/nologo',
      '/W4',
      '/EHsc',
      '/std:c11',
      '/Fe:C:/t/program.exe',
      'C:/t/main.c',
    ]);
  });

  it('PATH 探测到 cl 但 INCLUDE 未定义 → 不可用 + "开发环境未初始化"明确提示（不误判可用）', async () => {
    const prevInclude = process.env.INCLUDE;
    delete process.env.INCLUDE;
    try {
      const a = adaptersFor({ cl: banner });
      const r = await detectCompilerAdapter(undefined, a, 'win32');
      expect(r.available).toBe(false);
      expect(r.reason).toContain('MSVC 开发环境未初始化');
    } finally {
      if (prevInclude !== undefined) process.env.INCLUDE = prevInclude;
    }
  });

  it('INCLUDE 已定义（Developer Command Prompt）→ 可用', async () => {
    const prevInclude = process.env.INCLUDE;
    process.env.INCLUDE = 'C:\\Program Files\\...\\include';
    try {
      const a = adaptersFor({ cl: banner });
      const r = await detectCompilerAdapter(undefined, a, 'win32');
      expect(r.available).toBe(true);
      expect(r.compiler?.kind).toBe('cl');
    } finally {
      if (prevInclude === undefined) delete process.env.INCLUDE;
      else process.env.INCLUDE = prevInclude;
    }
  });
});

describe('customPath 消歧（D5 修复验证：结论由签名决定）', () => {
  it('路径名含 clang 的真 gcc → 识别为 gcc（先试 clang 签名不匹配，gcc 命中）', async () => {
    const a = adaptersFor({
      'C:/mingw/clang-labeled-gcc.exe': { exitCode: 0, stdout: 'gcc (Rev3, Built by MSYS2 project) 13.2.0\n' },
    });
    const r = await detectCompilerAdapter('C:/mingw/clang-labeled-gcc.exe', a, 'win32');
    expect(r.available).toBe(true);
    expect(r.compiler?.kind).toBe('gcc');
  });

  it('cl.exe 自定义路径 → MSVC（--version 不适用于 cl，走无参数 banner）', async () => {
    const prevInclude = process.env.INCLUDE;
    process.env.INCLUDE = 'x';
    try {
      const a = adaptersFor({ 'C:/VS/VC/Tools/MSVC/.../bin/cl.exe': { exitCode: 2, stderr: 'Microsoft (R) C/C++ Optimizing Compiler Version 19.38 for x64\n' } });
      const r = await detectCompilerAdapter('C:/VS/VC/Tools/MSVC/.../bin/cl.exe', a, 'win32');
      expect(r.available).toBe(true);
      expect(r.compiler?.kind).toBe('cl');
    } finally {
      if (prevInclude === undefined) delete process.env.INCLUDE;
      else process.env.INCLUDE = prevInclude;
    }
  });

  it('完全不是编译器的 exe（能运行但输出无签名）→ 明确拒绝', async () => {
    const a = adaptersFor({ 'C:/Windows/notepad.exe': { exitCode: 0, stdout: '' } });
    const r = await detectCompilerAdapter('C:/Windows/notepad.exe', a, 'win32');
    expect(r.available).toBe(false);
    expect(r.reason).toContain('不是受支持的 C 编译器');
  });

  it('cl.exe 存在但环境未初始化的 customPath → 不可用 + 提示', async () => {
    const prevInclude = process.env.INCLUDE;
    delete process.env.INCLUDE;
    try {
      const a = adaptersFor({ 'C:/VS/bin/cl.exe': { exitCode: 2, stderr: 'Microsoft (R) C/C++ Optimizing Compiler Version 19.38\n' } });
      const r = await detectCompilerAdapter('C:/VS/bin/cl.exe', a, 'win32');
      expect(r.available).toBe(false);
      expect(r.reason).toBe(MSVC_ENV_HINT);
    } finally {
      if (prevInclude !== undefined) process.env.INCLUDE = prevInclude;
    }
  });
});

describe('guessAdapterOrder（文件名只影响顺序）', () => {
  it('cl / cl.exe 优先 MSVC；含 clang 优先 Clang；默认 Gcc 优先', () => {
    const a = adaptersFor({});
    expect(guessAdapterOrder('C:/x/cl.exe', a)[0]).toBe(a.cl);
    expect(guessAdapterOrder('C:/x/clang.exe', a)[0]).toBe(a.clang);
    expect(guessAdapterOrder('C:/x/gcc.exe', a)[0]).toBe(a.gcc);
    expect(guessAdapterOrder('C:/x/cc', a)[0]).toBe(a.gcc);
  });
});

describe('classifyExit（平台无关失败分类）', () => {
  it.each([
    ['spawn_error', { exitCode: null, signal: null, timedOut: false, spawnError: 'spawn ENOENT' }],
    ['timeout', { exitCode: null, signal: 'SIGKILL', timedOut: true, spawnError: null }],
    ['signal', { exitCode: null, signal: 'SIGSEGV', timedOut: false, spawnError: null }],
    ['nonzero_exit', { exitCode: 3, signal: null, timedOut: false, spawnError: null }],
    ['ok', { exitCode: 0, signal: null, timedOut: false, spawnError: null }],
  ])('%s 分类正确', (expected, outcome) => {
    expect(classifyExit(outcome)).toBe(expected);
  });

  it('timeout 优先于 signal（TLE 判定在 RE 之前）', () => {
    expect(classifyExit({ exitCode: null, signal: 'SIGKILL', timedOut: true, spawnError: null })).toBe('timeout');
  });
});

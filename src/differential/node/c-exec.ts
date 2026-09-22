/**
 * Node 专属：C 差分程序编译执行器（仅被 tests/differential 引用，不进浏览器 bundle）。
 * 复用 runner-core.execSafe（数组 argv、超时杀树、输出限幅）与临时目录清理纪律。
 */
import { createRequire } from 'node:module';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// vitest 转换链下 import.meta.url 不可靠：以进程 cwd（项目根）锚定唯一实现
const require = createRequire(path.join(process.cwd(), 'package.json'));
const runnerCorePath = path.join(process.cwd(), 'electron', 'runner-core.cjs');
// 直接引用主进程同款实现（单一实现原则）
const runnerCore = require(runnerCorePath) as {
  execSafe: (cmd: string, args: string[], opts: { cwd?: string; timeoutMs: number; stdin?: string }) => Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean; durationMs: number }>;
  buildCompileArgs: (kind: 'gcc' | 'clang' | 'cl', binaryPath: string, sourcePath: string) => string[];
};

export interface CCompilerSpec {
  kind: 'gcc' | 'clang' | 'cl';
  path: string;
}

export interface CProgramResult {
  ok: boolean;
  /** 编译失败信息（ok=false 时给出） */
  compileError: string | null;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

/** 编译并运行一段完整 C 程序；任何路径（含异常）都清理临时目录 */
export async function runCProgram(source: string, compiler: CCompilerSpec, opts: { timeoutMs?: number } = {}): Promise<CProgramResult> {
  const fsp = await import('node:fs/promises');
  const dir = path.join(tmpdir(), `cclab-diff-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  await fsp.mkdir(dir, { recursive: true });
  const sourcePath = path.join(dir, 'diff.c');
  const binaryPath = path.join(dir, process.platform === 'win32' ? 'diff.exe' : 'diff');
  try {
    await writeFile(sourcePath, source, 'utf8');
    const compile = await runnerCore.execSafe(compiler.path, runnerCore.buildCompileArgs(compiler.kind, binaryPath, sourcePath), {
      cwd: dir,
      timeoutMs: 30000,
    });
    if (compile.code !== 0) {
      return {
        ok: false,
        compileError: `编译失败（exit=${String(compile.code)}）：${compile.stderr.slice(0, 4000)}`,
        stdout: compile.stdout,
        stderr: compile.stderr,
        exitCode: compile.code,
        timedOut: compile.timedOut,
      };
    }
    const run = await runnerCore.execSafe(binaryPath, [], { cwd: dir, timeoutMs: opts.timeoutMs ?? 30000 });
    return {
      ok: run.code === 0 && !run.timedOut,
      compileError: run.timedOut ? 'C 差分程序超时' : run.code !== 0 ? `运行失败 exit=${String(run.code)}` : null,
      stdout: run.stdout,
      stderr: run.stderr,
      exitCode: run.code,
      timedOut: run.timedOut,
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** 探测指定 kind 的编译器（差分按需选择 gcc/clang；cl 由 MSVC 环境提供） */
export async function detectCompilerByKind(kind: 'gcc' | 'clang' | 'cl'): Promise<CCompilerSpec | null> {
  const candidates: Record<'gcc' | 'clang' | 'cl', string[]> = {
    gcc: ['gcc', 'cc'],
    clang: ['clang'],
    cl: ['cl'],
  };
  for (const cmd of candidates[kind]) {
    const probe = await runnerCore.execSafe(cmd, kind === 'cl' ? [] : ['--version'], { timeoutMs: 8000 });
    if (probe.code === null) continue; // spawn 失败（ENOENT 等）：绝不从错误信息里"认出"编译器
    // gcc/clang 版本在 stdout；MSVC banner 在 stderr。签名匹配防任意 exe 冒充（正式探测走 compiler-adapters）
    const out = kind === 'cl' ? `${probe.stdout}\n${probe.stderr}` : probe.stdout;
    const signature = kind === 'cl' ? /Microsoft/i : kind === 'clang' ? /clang/i : /gcc|Free Software/i;
    if (signature.test(out)) {
      return { kind, path: cmd };
    }
  }
  return null;
}

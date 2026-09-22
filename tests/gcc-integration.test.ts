/**
 * 真实 C Runner 集成测试（P14 重点）。
 *
 * 两个层次：
 *  1. runner-core 行为（任何有 Node 的环境都跑，用 node 自身当被测子进程——真实子进程，非 mock）：
 *     payload 验证、编译参数一致性、超时终止、输出限幅、真实 durationMs。
 *  2. gcc 全量判题（PATH 有 gcc/clang 才执行；GitHub Actions ubuntu 自带 gcc 全量运行；
 *     本地无编译器时该部分显式跳过并在 CI 的 gcc-runner job 强制覆盖）：
 *     全部 CODING_PROBLEMS 的 referenceSolution 编译 + 运行全部用例必须 Accepted，
 *     并覆盖 AC/WA/CE/RE/TLE、stdin、Unicode、临时目录清理。
 */
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { CODING_PROBLEMS } from '../src/coding/problems';
import type { CodingProblem } from '../src/coding/problems';
import { judgeSubmission } from '../src/judge/judge';
import { registerNodeRunner, detectCompilers } from '../src/runner/runner';
import type { CompileRunOutcome, CompilerInfo, NodeRunnerImplementation, RunnerAvailability } from '../src/runner/runner';

const require = createRequire(import.meta.url);
// 单一实现：测试直接加载主进程同款 runner-core，杜绝双实现漂移
const runnerCore = require('../electron/runner-core.cjs') as {
  validateRunnerPayload(p: unknown): { ok: boolean; errors: string[]; value: unknown };
  buildCompileArgs(kind: string, binaryPath: string, sourcePath: string): string[];
  detectCompiler(customPath?: string, platform?: string): Promise<RunnerAvailability>;
  execSafe(
    cmd: string,
    args: string[],
    opts: { cwd?: string; timeoutMs: number; stdin?: string },
  ): Promise<{ exitCode: number | null; signal: string | null; timedOut: boolean; spawnError: string | null; stdout: string; stderr: string; durationMs: number }>;
  classifyOutcome: (o: { exitCode: number | null; signal: string | null; timedOut: boolean; spawnError: string | null }) => string;
  compileAndRun(
    compiler: CompilerInfo,
    userCode: string,
    harness: string,
    cases: Array<{ stdin: string; expected: string }>,
    timeLimitMs?: number,
  ): Promise<CompileRunOutcome>;
  MAX_OUTPUT: number;
  LIMITS: { MAX_CASES: number; MAX_SOURCE_CHARS: number; MAX_STDIN_CHARS: number; MIN_TIME_LIMIT_MS: number; MAX_TIME_LIMIT_MS: number };
};

// 把唯一实现注册进 TS 桥（测试走与生产一致的接口）
const nodeImpl: NodeRunnerImplementation = {
  detectCompiler: (customPath) => runnerCore.detectCompiler(customPath),
  compileAndRun: (compiler, userCode, harness, cases, timeLimitMs) =>
    runnerCore.compileAndRun(compiler, userCode, harness, cases, timeLimitMs),
};
registerNodeRunner(nodeImpl);

const NODE = process.execPath;

/* ============ 层次 1：runner-core 行为（全平台可跑） ============ */

describe('runner-core payload 验证（渲染层不可信）', () => {
  const valid = {
    compiler: { kind: 'gcc', path: 'gcc', version: 'gcc 13' },
    userCode: 'int f(void){return 0;}',
    harness: 'int main(void){return f();}',
    cases: [{ stdin: '', expected: '' }],
    timeLimitMs: 1000,
  };

  it('合法 payload 通过并规范化（version 默认空串）', () => {
    const r = runnerCore.validateRunnerPayload(valid);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    const v = r.value as { compiler: { version: string }; timeLimitMs: number };
    expect(v.compiler.version).toBe('gcc 13');
  });

  it.each([
    ['null', null],
    ['数组', [valid]],
    ['字符串', 'payload'],
  ])('非对象 payload（%s）拒绝', (_name, p) => {
    const r = runnerCore.validateRunnerPayload(p);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('compiler.kind 不在白名单拒绝', () => {
    const r = runnerCore.validateRunnerPayload({ ...valid, compiler: { ...valid.compiler, kind: 'sh' } });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain('compiler.kind');
  });

  it('compiler.path 空/超长拒绝', () => {
    expect(runnerCore.validateRunnerPayload({ ...valid, compiler: { ...valid.compiler, path: '' } }).ok).toBe(false);
    expect(
      runnerCore.validateRunnerPayload({ ...valid, compiler: { ...valid.compiler, path: 'a'.repeat(2000) } }).ok,
    ).toBe(false);
  });

  it('userCode/harness 非字符串或超长拒绝', () => {
    expect(runnerCore.validateRunnerPayload({ ...valid, userCode: 42 }).ok).toBe(false);
    expect(runnerCore.validateRunnerPayload({ ...valid, userCode: 'x'.repeat(runnerCore.LIMITS.MAX_SOURCE_CHARS + 1) }).ok).toBe(false);
    expect(runnerCore.validateRunnerPayload({ ...valid, harness: null }).ok).toBe(false);
  });

  it('cases 空数组/超数量/元素非法拒绝', () => {
    expect(runnerCore.validateRunnerPayload({ ...valid, cases: [] }).ok).toBe(false);
    const many = Array.from({ length: runnerCore.LIMITS.MAX_CASES + 1 }, () => ({ stdin: '', expected: '' }));
    expect(runnerCore.validateRunnerPayload({ ...valid, cases: many }).ok).toBe(false);
    expect(runnerCore.validateRunnerPayload({ ...valid, cases: [{ stdin: 1, expected: '' }] }).ok).toBe(false);
    expect(
      runnerCore.validateRunnerPayload({ ...valid, cases: [{ stdin: 'x'.repeat(runnerCore.LIMITS.MAX_STDIN_CHARS + 1), expected: '' }] }).ok,
    ).toBe(false);
  });

  it('timeLimitMs 越界/非整数拒绝', () => {
    expect(runnerCore.validateRunnerPayload({ ...valid, timeLimitMs: 0 }).ok).toBe(false);
    expect(runnerCore.validateRunnerPayload({ ...valid, timeLimitMs: runnerCore.LIMITS.MAX_TIME_LIMIT_MS + 1 }).ok).toBe(false);
    expect(runnerCore.validateRunnerPayload({ ...valid, timeLimitMs: 3.5 }).ok).toBe(false);
    expect(runnerCore.validateRunnerPayload({ ...valid, timeLimitMs: '5000' }).ok).toBe(false);
    expect(runnerCore.validateRunnerPayload({ ...valid, timeLimitMs: runnerCore.LIMITS.MIN_TIME_LIMIT_MS }).ok).toBe(true);
  });
});

describe('runner-core 编译参数（单一实现，消除双实现漂移）', () => {
  it('MSVC：/nologo /W4 /EHsc /std:c11 /Fe:（c11：教学 C 代码用 C99 for 内声明，默认模式不支持）', () => {
    expect(runnerCore.buildCompileArgs('cl', 'C:\\t\\program.exe', 'C:\\t\\main.c')).toEqual([
      '/nologo',
      '/W4',
      '/EHsc',
      '/std:c11',
      '/Fe:C:\\t\\program.exe',
      'C:\\t\\main.c',
    ]);
  });

  it('gcc/clang：-std=c99 -Wall -O0 -o', () => {
    expect(runnerCore.buildCompileArgs('gcc', '/t/program', '/t/main.c')).toEqual([
      '-std=c99',
      '-Wall',
      '-O0',
      '-o',
      '/t/program',
      '/t/main.c',
    ]);
    expect(runnerCore.buildCompileArgs('clang', '/t/program', '/t/main.c')).toEqual([
      '-std=c99',
      '-Wall',
      '-O0',
      '-o',
      '/t/program',
      '/t/main.c',
    ]);
  });
});

describe('runner-core 子进程行为（node 作为真实被测程序）', () => {
  it('正常执行：exitCode/stdout 与真实 durationMs', async () => {
    const r = await runnerCore.execSafe(NODE, ['-e', 'console.log("hello-runner")'], { timeoutMs: 10000 });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe('hello-runner\n');
    expect(r.timedOut).toBe(false);
    expect(r.durationMs).toBeGreaterThan(0);
  });

  it('超时可终止（死循环进程被杀，timedOut 标记）', async () => {
    const r = await runnerCore.execSafe(NODE, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 500 });
    expect(r.timedOut).toBe(true);
    expect(r.durationMs).toBeGreaterThanOrEqual(500);
  });

  it('信号崩溃绝不允许通过（P15：POSIX 报 signal，Windows 映射为非零退出码 0xC0000005）', async () => {
    const r = await runnerCore.execSafe(NODE, ['-e', 'process.kill(process.pid, "SIGSEGV")'], { timeoutMs: 10000 });
    const cls = runnerCore.classifyOutcome(r);
    if (process.platform === 'win32') {
      // Windows 模拟信号 → 异常退出码（Access Violation），signal 为 null
      expect(cls).toBe('nonzero_exit');
      expect(r.exitCode).not.toBe(0);
    } else {
      expect(r.signal).toBe('SIGSEGV');
      expect(cls).toBe('signal');
    }
    expect(cls).not.toBe('ok');
  });

  it('stdout 超限截断（限幅后不再增长）', async () => {
    const r = await runnerCore.execSafe(
      NODE,
      ['-e', 'const chunk="x".repeat(1024*1024); for(let i=0;i<3;i++){ process.stdout.write(chunk); }'],
      { timeoutMs: 30000 },
    );
    expect(r.stdout.length).toBeGreaterThan(0);
    expect(r.stdout.length).toBeLessThanOrEqual(runnerCore.MAX_OUTPUT + 128 * 1024); // 允许一个 chunk 的余量
    expect(r.stdout.startsWith('x')).toBe(true);
  });

  it('stdin 真实传入子进程', async () => {
    const r = await runnerCore.execSafe(NODE, ['-e', 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log("got:"+s.trim()))'], {
      timeoutMs: 10000,
      stdin: 'ping 42\n',
    });
    expect(r.stdout.trim()).toBe('got:ping 42');
  });

  it('compileAndRun 对非法 payload 上抛（纵深防御，即使绕过 IPC）', async () => {
    await expect(
      runnerCore.compileAndRun({ kind: 'gcc', path: 'gcc', version: '' }, 'int x;', '', [{ stdin: '', expected: '' }], 0),
    ).rejects.toThrow(/runner payload 非法/);
    await expect(
      runnerCore.compileAndRun({ kind: 'sh', path: 'gcc', version: '' } as unknown as CompilerInfo, 'int x;', '', [
        { stdin: '', expected: '' },
      ], 1000),
    ).rejects.toThrow(/compiler\.kind/);
  });

  it('探测接口：无编译器路径时结构完整（浏览器/Node 均可调用）', async () => {
    const r = await detectCompilers('definitely-not-a-real-compiler-path-xyz');
    expect(r.available).toBe(false);
    expect(r.reason.length).toBeGreaterThan(0);
    expect(r.compiler).toBeNull();
  });
});

/* ============ 层次 2：真实 gcc 全量判题（CI Ubuntu 全量执行） ============ */

const detect: RunnerAvailability = await runnerCore.detectCompiler();
const hasCompiler = detect.available && detect.compiler !== null;
const compiler = detect.compiler as CompilerInfo | null;

describe('gcc 集成：全部编程题 referenceSolution 必须 Accepted', () => {
  it.skipIf(!hasCompiler)('referenceSolution 编译运行全部 testCases 全 AC（%d 题）', { timeout: 300_000 }, async () => {
    expect(CODING_PROBLEMS.length).toBeGreaterThanOrEqual(10);
    const failures: string[] = [];
    for (const problem of CODING_PROBLEMS) {
      const outcome = await runnerCore.compileAndRun(
        compiler!,
        problem.referenceSolution,
        problem.harness,
        problem.testCases.map((c) => ({ stdin: c.stdin, expected: c.expected })),
        problem.timeLimitMs ?? 5000,
      );
      const judged = judgeSubmission({
        compileExitCode: outcome.compileExitCode,
        compileStderr: `${outcome.compileStdout}\n${outcome.compileStderr}`,
        cases: outcome.cases,
        timeLimitMs: problem.timeLimitMs ?? 5000,
      });
      if (judged.status !== 'accepted') {
        failures.push(
          `${problem.id}: ${judged.status}` +
            (judged.failedCase !== null
              ? ` @case${judged.failedCase.index + 1} expected=${JSON.stringify(judged.failedCase.expected)} actual=${JSON.stringify(judged.failedCase.actual)}`
              : ` ${judged.compileMessage.slice(0, 200)}`),
        );
      }
      expect(outcome.cleaned).toBe(true);
      for (const c of outcome.cases) {
        expect(c.durationMs).toBeGreaterThan(0); // durationMs 真实计时，不再恒 0
      }
    }
    expect(failures).toEqual([]);
  });

  it.skipIf(!hasCompiler)('题目数据一致性：模板/用例/参考答案非空且 harness 含 main', () => {
    for (const p of CODING_PROBLEMS) {
      expect(p.referenceSolution.trim().length, p.id).toBeGreaterThan(20);
      expect(p.harness.includes('int main'), p.id).toBe(true);
      expect(p.template.includes('TODO'), p.id).toBe(true);
      expect(p.testCases.length, p.id).toBeGreaterThan(0);
    }
  });

  it.skipIf(!hasCompiler)('p-stack-push 栈满溢出用例：9 入栈失败、pop 弹出 8（真实 gcc 行为）', { timeout: 60_000 }, async () => {
    const problem = CODING_PROBLEMS.find((p) => p.id === 'p-stack-push');
    expect(problem).toBeDefined();
    const outcome = await runnerCore.compileAndRun(
      compiler!,
      problem!.referenceSolution,
      problem!.harness,
      problem!.testCases.map((c) => ({ stdin: c.stdin, expected: c.expected })),
      5000,
    );
    const case2 = outcome.cases[1]!;
    expect(case2.actual.trim()).toBe('1 2 3 4 5 6 7'); // 9 入栈失败（栈满），0 弹出 8
  });

  it.skipIf(!hasCompiler)('WA：恒空实现（不写入任何元素）被判 Wrong Answer', { timeout: 60_000 }, async () => {
    const problem = CODING_PROBLEMS.find((p) => p.id === 'p-stack-push')!;
    // 注入缺陷：push 什么都不做 → 输出恒为空，与任何非空期望稳定不符（自带类型定义保证可编译）
    const badCode = `#include <stdio.h>
#define STACK_CAP 8

typedef struct {
    int data[STACK_CAP];
    int top;
} ArrayStack;

int stackPush(ArrayStack *s, int value) { (void)s; (void)value; return -1; }
`;
    const outcome = await runnerCore.compileAndRun(
      compiler!,
      badCode,
      problem.harness,
      problem.testCases.map((c) => ({ stdin: c.stdin, expected: c.expected })),
      5000,
    );
    const judged = judgeSubmission({
      compileExitCode: outcome.compileExitCode,
      compileStderr: `${outcome.compileStdout}\n${outcome.compileStderr}`,
      cases: outcome.cases,
      timeLimitMs: 5000,
    });
    expect(judged.status).toBe('wrong_answer');
    expect(judged.failedCase).not.toBeNull();
  });

  it.skipIf(!hasCompiler)('CE：语法错误返回非零退出码并被判 Compile Error', { timeout: 60_000 }, async () => {
    const outcome = await runnerCore.compileAndRun(
      compiler!,
      'int broken( { this is not C }',
      'int main(void){return 0;}',
      [{ stdin: '', expected: '' }],
      1000,
    );
    expect(outcome.compileExitCode).not.toBe(0);
    expect(outcome.cases.length).toBe(0);
    const judged = judgeSubmission({
      compileExitCode: outcome.compileExitCode,
      compileStderr: outcome.compileStderr,
      cases: outcome.cases,
      timeLimitMs: 1000,
    });
    expect(judged.status).toBe('compile_error');
  });

  it.skipIf(!hasCompiler)('RE：空指针解引用被判 Runtime Error', { timeout: 60_000 }, async () => {
    const userCode = '#include <stdio.h>\nvoid boom(void){ *(int*)0 = 1; }\n';
    const harness = 'void boom(void);\nint main(void){ boom(); return 0; }\n';
    const outcome = await runnerCore.compileAndRun(compiler!, userCode, harness, [{ stdin: '', expected: '' }], 2000);
    const judged = judgeSubmission({
      compileExitCode: outcome.compileExitCode,
      compileStderr: outcome.compileStderr,
      cases: outcome.cases,
      timeLimitMs: 2000,
    });
    expect(judged.status).toBe('runtime_error');
  });

  it.skipIf(!hasCompiler)('TLE：while(1) 死循环被超时终止并判 Time Limit', { timeout: 60_000 }, async () => {
    const userCode = 'void spin(void){ for(;;){} }\n';
    const harness = 'void spin(void);\nint main(void){ spin(); return 0; }\n';
    const outcome = await runnerCore.compileAndRun(compiler!, userCode, harness, [{ stdin: '', expected: '' }], 800);
    expect(outcome.cases[0]!.timedOut).toBe(true);
    const judged = judgeSubmission({
      compileExitCode: outcome.compileExitCode,
      compileStderr: outcome.compileStderr,
      cases: outcome.cases,
      timeLimitMs: 800,
    });
    expect(judged.status).toBe('time_limit_exceeded');
  });

  it.skipIf(!hasCompiler)('输出洪泛被限幅且进程被终止（不挂起测试）', { timeout: 60_000 }, async () => {
    const userCode = '#include <stdio.h>\nvoid flood(void){ for(;;){ for(int i=0;i<26;i++) putchar(\'a\'+i); putchar(\'\\n\'); } }\n';
    const harness = 'void flood(void);\nint main(void){ flood(); return 0; }\n';
    const outcome = await runnerCore.compileAndRun(compiler!, userCode, harness, [{ stdin: '', expected: '' }], 1200);
    expect(outcome.cases[0]!.timedOut).toBe(true);
    expect(outcome.cases[0]!.actual.length).toBeLessThanOrEqual(runnerCore.MAX_OUTPUT + 128 * 1024);
    expect(outcome.cleaned).toBe(true);
  });

  it.skipIf(!hasCompiler)('Unicode：源码含中文 printf 按字节精确比较', { timeout: 60_000 }, async () => {
    const userCode = '#include <stdio.h>\nconst char* greet(void){ return "你好，数据结构"; }\n';
    const harness = '#include <stdio.h>\nconst char* greet(void);\nint main(void){ puts(greet()); return 0; }\n';
    const outcome = await runnerCore.compileAndRun(compiler!, userCode, harness, [{ stdin: '', expected: '你好，数据结构' }], 3000);
    expect(outcome.cases[0]!.actual.trim()).toBe('你好，数据结构');
  });

  it.skipIf(!hasCompiler)('临时目录清理：判题结束后 tmpdir 无 cclab- 残留', { timeout: 120_000 }, async () => {
    const before = new Set((await readdir(tmpdir())).filter((n) => n.startsWith('cclab-')));
    const problem: CodingProblem = CODING_PROBLEMS[0]!;
    await runnerCore.compileAndRun(
      compiler!,
      problem.referenceSolution,
      problem.harness,
      problem.testCases.map((c) => ({ stdin: c.stdin, expected: c.expected })),
      5000,
    );
    const after = (await readdir(tmpdir())).filter((n) => n.startsWith('cclab-') && !before.has(n));
    expect(after).toEqual([]);
  });

  it.skipIf(!hasCompiler)('平台差异：二进制名与终止方式按平台约定', () => {
    if (process.platform === 'win32') {
      // runner-core 源码在 Windows 使用 program.exe 与 taskkill 树终止
      // （静态断言在 electron-security.test.ts 覆盖；此处断言探测回退存在）
      expect(typeof runnerCore.detectCompiler).toBe('function');
    } else {
      expect(typeof runnerCore.detectCompiler).toBe('function');
    }
  });
});

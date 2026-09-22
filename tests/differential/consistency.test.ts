/**
 * GCC ↔ Clang 判题一致性（P15 任务书十二）：
 * 全部 CodingProblem referenceSolution 与 WA/CE/RE 场景在两个编译器下的判题结果必须一致。
 * CI clang job 强制执行；本地缺任一编译器时跳过。
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CODING_PROBLEMS } from '../../src/coding/problems';
import { judgeSubmission } from '../../src/judge/judge';
import { detectCompilerByKind, type CCompilerSpec } from '../../src/differential/node/c-exec';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const runnerCore = require(path.join(process.cwd(), 'electron', 'runner-core.cjs')) as {
  compileAndRun: (
    compiler: { kind: string; path: string; version?: string },
    userCode: string,
    harness: string,
    cases: Array<{ stdin: string; expected: string }>,
    timeLimitMs?: number,
  ) => Promise<{
    compileExitCode: number;
    compileStdout: string;
    compileStderr: string;
    cases: Array<{ index: number; actual: string; expected: string; exitCode: number | null; timedOut: boolean; durationMs: number }>;
  }>;
};

// 顶层 await：探测结果在 describe.skipIf 评估前就绪
const gcc: CCompilerSpec | null = await detectCompilerByKind('gcc');
const clang: CCompilerSpec | null = await detectCompilerByKind('clang');

async function judgeWith(compiler: CCompilerSpec, code: string, harness: string, cases: Array<{ stdin: string; expected: string }>, tl: number) {
  const outcome = await runnerCore.compileAndRun(compiler, code, harness, cases, tl);
  return judgeSubmission({
    compileExitCode: outcome.compileExitCode,
    compileStderr: `${outcome.compileStdout}\n${outcome.compileStderr}`,
    cases: outcome.cases,
    timeLimitMs: tl,
  }).status;
}

describe.skipIf(gcc === null || clang === null)('GCC ↔ Clang 判题一致性', () => {
  it(
    '全部 CodingProblem referenceSolution：两编译器判题结果一致且为 Accepted',
    { timeout: 300_000 },
    async () => {
      expect(CODING_PROBLEMS.length).toBeGreaterThanOrEqual(10);
      for (const p of CODING_PROBLEMS) {
        const cases = p.testCases.map((c) => ({ stdin: c.stdin, expected: c.expected }));
        const tl = p.timeLimitMs ?? 5000;
        const sGcc = await judgeWith(gcc!, p.referenceSolution, p.harness, cases, tl);
        const sClang = await judgeWith(clang!, p.referenceSolution, p.harness, cases, tl);
        expect(sGcc, `${p.id}: gcc=${sGcc}（应为 accepted）`).toBe('accepted');
        expect(sClang, `${p.id}: clang=${sClang}（应为 accepted）`).toBe('accepted');
        expect(sGcc, `${p.id}: 两编译器结果不一致`).toBe(sClang);
      }
    },
  );

  it(
    '缺陷代码场景（WA/CE/RE）判题结果一致',
    { timeout: 120_000 },
    async () => {
      const p = CODING_PROBLEMS.find((x) => x.id === 'p-stack-push')!;
      const cases = p.testCases.map((c) => ({ stdin: c.stdin, expected: c.expected }));

      // CE：语法错误
      const ceCode = 'int broken( { this is not C }';
      const ceHarness = 'int main(void){return 0;}';
      expect(await judgeWith(gcc!, ceCode, ceHarness, [{ stdin: '', expected: '' }], 1000)).toBe('compile_error');
      expect(await judgeWith(clang!, ceCode, ceHarness, [{ stdin: '', expected: '' }], 1000)).toBe('compile_error');

      // RE：空指针写
      const reCode = '#include <stdio.h>\nvoid boom(void){ *(int*)0 = 1; }\n';
      const reHarness = 'void boom(void);\nint main(void){ boom(); return 0; }\n';
      expect(await judgeWith(gcc!, reCode, reHarness, [{ stdin: '', expected: '' }], 2000)).toBe('runtime_error');
      expect(await judgeWith(clang!, reCode, reHarness, [{ stdin: '', expected: '' }], 2000)).toBe('runtime_error');

      // WA：恒空实现
      const waCode = `#include <stdio.h>
#define STACK_CAP 8
typedef struct { int data[STACK_CAP]; int top; } ArrayStack;
int stackPush(ArrayStack *s, int value) { (void)s; (void)value; return -1; }
`;
      const sGcc = await judgeWith(gcc!, waCode, p.harness, cases, 5000);
      const sClang = await judgeWith(clang!, waCode, p.harness, cases, 5000);
      expect(sGcc).toBe('wrong_answer');
      expect(sClang).toBe('wrong_answer');
    },
  );
});

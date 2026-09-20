import { describe, expect, it } from 'vitest';
import { CODING_PROBLEMS } from '../coding/problems';
import { firstDiffLine, normalizeOutput, outputMatches, truncateOutput } from './compare';
import { judgeSubmission } from './judge';
import type { CaseRunResult } from './judge';

describe('输出比对规范化（JUDGE_SPEC §2）', () => {
  it('等价组：CRLF/LF、行尾空白、末尾换行', () => {
    expect(outputMatches('5\n', '5')).toBe(true);
    expect(outputMatches('5', '5\n')).toBe(true);
    expect(outputMatches('5 \n', '5')).toBe(true); // 行尾空格
    expect(outputMatches('5\t', '5')).toBe(true);
    expect(outputMatches('1 2 3\r\n4 5 6\r\n', '1 2 3\n4 5 6\n')).toBe(true); // CRLF
    expect(outputMatches('a\r\nb', 'a\nb')).toBe(true);
    expect(outputMatches('x\n\n\n', 'x')).toBe(true); // 末尾多余换行
  });

  it('严格差异组：中间空行、大小写、行内空格', () => {
    expect(outputMatches('5\n\n6', '5\n6')).toBe(false); // 中间空行
    expect(outputMatches('ABC', 'abc')).toBe(false); // 大小写
    expect(outputMatches('1 2', '1  2')).toBe(false); // 行内空格数
    expect(outputMatches('1 2', '12')).toBe(false);
  });

  it('firstDiffLine 定位', () => {
    const d = firstDiffLine('10 20 30', '10 99 30');
    expect(d).toEqual({ lineNo: 1, expected: '10 20 30', actual: '10 99 30' });
    expect(firstDiffLine('a\nb', 'a\nb')).toBeNull();
    expect(firstDiffLine('a', 'a\nb')?.lineNo).toBe(2);
  });

  it('truncateOutput', () => {
    const r = truncateOutput('x'.repeat(10), 5);
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBeLessThan(30);
    expect(truncateOutput('abc', 100).truncated).toBe(false);
  });

  it('normalizeOutput 展示', () => {
    expect(normalizeOutput('a \r\nb\r\n')).toBe('a\nb');
  });
});

describe('判题状态机（JUDGE_SPEC §1）', () => {
  const mk = (over: Partial<CaseRunResult>): CaseRunResult => ({
    index: 0,
    stdin: 'in',
    expected: 'exp',
    actual: 'exp',
    exitCode: 0,
    timedOut: false,
    durationMs: 1,
    ...over,
  });

  it('Accepted：全部用例通过', () => {
    const out = judgeSubmission({
      compileExitCode: 0,
      compileStderr: '',
      timeLimitMs: 5000,
      cases: [mk({}), mk({ index: 1 })],
    });
    expect(out.status).toBe('accepted');
    expect(out.passedCount).toBe(2);
  });

  it('Compile Error：编译非零退出 + stderr 截断展示', () => {
    const out = judgeSubmission({
      compileExitCode: 1,
      compileStderr: 'error: expected ; before return'.repeat(1000),
      timeLimitMs: 5000,
      cases: [],
    });
    expect(out.status).toBe('compile_error');
    expect(out.compileMessage.length).toBeLessThanOrEqual(8 * 1024);
    expect(out.compileMessage).toContain('expected ;');
  });

  it('Time Limit Exceeded：超时优先于其他判定', () => {
    const out = judgeSubmission({
      compileExitCode: 0,
      compileStderr: '',
      timeLimitMs: 5000,
      cases: [mk({ timedOut: true, actual: '部分输出' })],
    });
    expect(out.status).toBe('time_limit_exceeded');
    expect(out.failedCase?.timedOut).toBe(true);
  });

  it('Runtime Error：非零退出码', () => {
    const out = judgeSubmission({
      compileExitCode: 0,
      compileStderr: '',
      timeLimitMs: 5000,
      cases: [mk({ exitCode: 139 })],
    });
    expect(out.status).toBe('runtime_error');
    expect(out.compileMessage).toContain('139');
  });

  it('Wrong Answer：展示 输入/Expected/Actual 与差异行', () => {
    const out = judgeSubmission({
      compileExitCode: 0,
      compileStderr: '',
      timeLimitMs: 5000,
      cases: [mk({ index: 0, actual: '10 99 30' }), mk({ index: 1 })],
    });
    expect(out.status).toBe('wrong_answer');
    expect(out.passedCount).toBe(0);
    expect(out.failedCase?.expected).toBe('exp');
    expect(out.diff).not.toBeNull();
  });

  it('WA 的换行差异被规范化为 AC（JUDGE_SPEC §2 等价组）', () => {
    const out = judgeSubmission({
      compileExitCode: 0,
      compileStderr: '',
      timeLimitMs: 5000,
      cases: [mk({ expected: '5\n', actual: '5' })],
    });
    expect(out.status).toBe('accepted');
  });
});

describe('编程题定义完整性', () => {
  it('≥9 题，id 唯一，含全部必备字段', () => {
    expect(CODING_PROBLEMS.length).toBeGreaterThanOrEqual(9);
    const ids = CODING_PROBLEMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of CODING_PROBLEMS) {
      expect(p.statement.length).toBeGreaterThan(20);
      expect(p.template).toContain('TODO');
      expect(p.testCases.length).toBeGreaterThanOrEqual(3);
      expect(p.referenceSolution.length).toBeGreaterThan(20);
      expect(p.harness).toContain('int main');
    }
  });

  it('覆盖任务书要求的题目类型', () => {
    const ids = new Set(CODING_PROBLEMS.map((p) => p.id));
    for (const required of ['p-seqlist-insert', 'p-list-pushback', 'p-list-delete', 'p-stack-push', 'p-circular-enqueue', 'p-bst-search', 'p-bubble-sort', 'p-quick-sort', 'p-binary-search']) {
      expect(ids.has(required), required).toBe(true);
    }
  });
});

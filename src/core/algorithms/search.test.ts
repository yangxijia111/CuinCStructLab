import { describe, expect, it } from 'vitest';
import type { ArrayState } from '../types';
import { SEARCH_C_CODE, binarySearchDirect, binarySearchSteps, linearSearchSteps } from './search';

function assertCodeLines(steps: { codeLine: number }[]): void {
  for (const [i, step] of steps.entries()) {
    expect(step.codeLine, `step${i}`).toBeLessThanOrEqual(SEARCH_C_CODE.length);
    expect(step.codeLine, `step${i}`).toBeGreaterThanOrEqual(0);
  }
}

describe('binarySearchDirect', () => {
  const sorted = [1, 3, 5, 7, 9, 11];
  it('存在/不存在/首/末/空/单元素', () => {
    expect(binarySearchDirect(sorted, 7)).toBe(3);
    expect(binarySearchDirect(sorted, 4)).toBe(-1);
    expect(binarySearchDirect(sorted, 1)).toBe(0);
    expect(binarySearchDirect(sorted, 11)).toBe(5);
    expect(binarySearchDirect([], 1)).toBe(-1);
    expect(binarySearchDirect([5], 5)).toBe(0);
    expect(binarySearchDirect([5], 3)).toBe(-1);
  });
});

describe('linearSearchSteps', () => {
  it('找到与找不到', () => {
    const arr = [4, 2, 9, 2];
    const hit = linearSearchSteps(arr, 9);
    expect(hit.steps[hit.steps.length - 1]?.type).toBe('visit');
    expect(hit.steps[hit.steps.length - 1]?.title).toContain('返回下标 2');
    const miss = linearSearchSteps(arr, 8);
    expect(miss.steps[miss.steps.length - 1]?.title).toContain('-1');
    assertCodeLines(hit.steps);
  });

  it('空数组直接返回 -1', () => {
    const out = linearSearchSteps([], 1);
    expect(out.steps[out.steps.length - 1]?.title).toContain('-1');
  });
});

describe('binarySearchSteps', () => {
  const sorted = [1, 3, 5, 7, 9, 11, 13, 15];

  it('找到：步骤逐步缩小范围', () => {
    const out = binarySearchSteps(sorted, 7);
    const last = out.steps[out.steps.length - 1]!;
    expect(last.type).toBe('visit');
    expect(last.title).toContain('返回下标 3');
    // 区间标记逐步缩小
    const ranges = out.steps.filter((s) => s.afterState.range !== undefined).map((s) => s.afterState.range);
    expect(ranges.length).toBeGreaterThan(0);
    assertCodeLines(out.steps);
  });

  it('不存在：low > high 收场', () => {
    const out = binarySearchSteps(sorted, 8);
    const last = out.steps[out.steps.length - 1]!;
    expect(last.type).toBe('info');
    expect(last.title).toContain('不存在');
  });

  it('首元素与末元素', () => {
    expect(binarySearchSteps(sorted, 1).steps.slice(-1)[0]?.title).toContain('返回下标 0');
    expect(binarySearchSteps(sorted, 15).steps.slice(-1)[0]?.title).toContain('返回下标 7');
  });

  it('空数组', () => {
    const out = binarySearchSteps([], 5);
    expect(out.steps[out.steps.length - 1]?.title).toContain('-1');
  });

  it('无序数组：默认给出警告步骤并继续（assumeSorted=false 时失败）', () => {
    const unsorted = [5, 1, 9, 3];
    const warn = binarySearchSteps(unsorted, 3);
    expect(warn.steps[0]?.description).toContain('不是升序');
    const fail = binarySearchSteps(unsorted, 3, false);
    expect(fail.ok).toBe(false);
    const lastState: ArrayState | undefined = fail.steps[fail.steps.length - 1]?.afterState;
    void lastState;
  });

  it('二分比顺序快（步骤中的比较次数）', () => {
    const big = Array.from({ length: 64 }, (_, i) => i * 2);
    const bin = binarySearchSteps(big, 100);
    const lin = linearSearchSteps(big, 100);
    const binCmp = bin.steps[bin.steps.length - 1]?.metrics?.comparisons ?? 0;
    const linCmp = lin.steps[lin.steps.length - 1]?.metrics?.comparisons ?? 0;
    expect(binCmp).toBeLessThanOrEqual(7); // log2(64) = 6
    expect(linCmp).toBe(51);
  });
});

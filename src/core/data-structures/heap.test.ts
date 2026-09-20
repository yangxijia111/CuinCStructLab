import { describe, expect, it } from 'vitest';
import { seededRandom } from '../utils/misc';
import type { HeapState } from '../types';
import {
  HEAP_C_CODE,
  assertHeapProperty,
  heapDeleteTop,
  heapInsert,
  heapValues,
  heapify,
  heapifyPure,
} from './heap';

function finalState(outcome: { steps: { afterState: HeapState }[] }): HeapState {
  const last = outcome.steps[outcome.steps.length - 1];
  if (last === undefined) throw new Error('没有步骤');
  return last.afterState;
}

function assertCodeLines(steps: { codeLine: number }[]): void {
  for (const [i, step] of steps.entries()) {
    expect(step.codeLine, `step${i}`).toBeLessThanOrEqual(HEAP_C_CODE.length);
    expect(step.codeLine, `step${i}`).toBeGreaterThanOrEqual(0);
  }
}

describe('heapInsert（上滤）', () => {
  it('插入后保持堆性质（max）', () => {
    let s = heapifyPure([], 'max');
    for (const v of [5, 3, 8, 1, 9]) {
      const out = heapInsert(s, v);
      expect(out.ok).toBe(true);
      s = finalState(out);
      expect(assertHeapProperty(s), `插入 ${v} 后`).toBe(true);
    }
    expect(heapValues(s)[0]).toBe(9);
    assertCodeLines(heapInsert(s, 7).steps);
  });

  it('min 堆插入', () => {
    let s = heapifyPure([], 'min');
    for (const v of [5, 3, 8, 1]) {
      s = finalState(heapInsert(s, v));
      expect(assertHeapProperty(s)).toBe(true);
    }
    expect(heapValues(s)[0]).toBe(1);
  });

  it('上滤步骤存在（孩子与父比较/交换）', () => {
    const s = heapifyPure([10, 5, 3], 'max');
    const out = heapInsert(s, 9);
    expect(out.steps.some((st) => st.type === 'swap')).toBe(true);
    expect(out.steps.some((st) => st.title.includes('上滤') || st.title.includes('向上'))).toBe(true);
  });
});

describe('heapDeleteTop（下滤）', () => {
  it('删除堆顶后仍为堆，且取出的是最值', () => {
    let s = heapifyPure([4, 10, 3, 5, 1], 'max');
    const popped: number[] = [];
    while (heapValues(s).length > 0) {
      const out = heapDeleteTop(s);
      expect(out.ok).toBe(true);
      s = finalState(out);
      const topLine = out.steps.find((st) => st.type === 'delete')!;
      popped.push(Number(topLine.title.match(/取出堆顶 (-?\d+)/)?.[1]));
      expect(assertHeapProperty(s)).toBe(true);
    }
    expect(popped).toEqual([10, 5, 4, 3, 1]); // 降序输出
    assertCodeLines(heapDeleteTop(heapifyPure([1], 'max')).steps);
  });

  it('空堆删除失败', () => {
    const out = heapDeleteTop(heapifyPure([], 'max'));
    expect(out.ok).toBe(false);
    expect(out.steps[out.steps.length - 1]?.title).toContain('空堆');
  });

  it('单元素堆删除后为空', () => {
    const out = heapDeleteTop(heapifyPure([7], 'min'));
    expect(finalState(out).order).toHaveLength(0);
  });
});

describe('heapify（Floyd 建堆）', () => {
  it('随机数组建堆后性质成立（max/min）', () => {
    const rnd = seededRandom(7);
    for (const compare of ['max', 'min'] as const) {
      for (let trial = 0; trial < 10; trial++) {
        const n = Math.floor(rnd() * 30) + 1;
        const arr = Array.from({ length: n }, () => Math.floor(rnd() * 100) - 50);
        const out = heapify(arr, compare);
        expect(out.ok).toBe(true);
        const s = finalState(out);
        expect(assertHeapProperty(s), `${compare} ${arr.join(',')}`).toBe(true);
        expect(heapValues(s).slice().sort((a, b) => a - b)).toEqual([...arr].sort((a, b) => a - b));
        assertCodeLines(out.steps);
      }
    }
  });

  it('空数组与单元素', () => {
    expect(heapValues(finalState(heapify([], 'max')))).toEqual([]);
    expect(heapValues(finalState(heapify([1], 'max')))).toEqual([1]);
  });
});

describe('堆排序语义（insert+deleteTop = 排序）', () => {
  it('依次取出得到降序（max 堆）', () => {
    const values = [3, 1, 4, 1, 5, 9, 2, 6];
    let s = heapifyPure([], 'max');
    for (const v of values) s = finalState(heapInsert(s, v));
    const sorted: number[] = [];
    while (heapValues(s).length > 0) {
      const step = heapDeleteTop(s);
      const topLine = step.steps.find((st) => st.type === 'delete')!;
      sorted.push(Number(topLine.title.match(/取出堆顶 (-?\d+)/)?.[1]));
      s = finalState(step);
    }
    expect(sorted).toEqual([...values].sort((a, b) => b - a));
  });
});

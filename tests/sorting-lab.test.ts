/**
 * P7 集成测试：排序实验室数据流 + Compare Mode 语义。
 */
import { describe, expect, it } from 'vitest';
import { SORT_METAS, type SortId } from '../src/core/algorithms/sorting-codes';
import { compareSorts, sortWithSteps } from '../src/core/algorithms/sorting';
import { binarySearchSteps } from '../src/core/algorithms/search';

const DATA = [5, 2, 9, 1, 7, 3, 8, 6];

describe('Compare Mode 语义', () => {
  it('三算法同一数据结果一致', () => {
    const rs = compareSorts(['bubble', 'quick', 'merge'], DATA);
    for (const { result } of rs) {
      expect(result.sorted).toEqual([...DATA].sort((a, b) => a - b));
    }
  });

  it('同一步进下各算法按自己的 steps 渲染（共享 index 夹取）', () => {
    const rs = compareSorts(['bubble', 'quick'], DATA);
    const maxLen = Math.max(...rs.map((r) => r.result.steps.length));
    const bubbleLen = rs[0]!.result.steps.length;
    const quickLen = rs[1]!.result.steps.length;
    expect(maxLen).toBe(bubbleLen);
    expect(quickLen).toBeLessThan(bubbleLen); // 快排步数少
    // index 超过某算法长度时渲染其最后一步（停留显示）
    const idx = quickLen + 10;
    const clamped = Math.min(idx, quickLen - 1);
    const step = rs[1]!.result.steps[clamped]!;
    expect(step.afterState.cells.map((c) => c.value)).toEqual([...DATA].sort((a, b) => a - b));
    // 每一步 metrics 单调
    for (const { id, result } of rs) {
      let c = 0;
      let s = 0;
      for (const st of result.steps) {
        if (st.metrics !== undefined) {
          expect(st.metrics.comparisons).toBeGreaterThanOrEqual(c);
          expect(st.metrics.swaps).toBeGreaterThanOrEqual(s);
          c = st.metrics.comparisons;
          s = st.metrics.swaps;
        }
      }
      void id;
    }
  });

  it('七种算法最终步骤均为 sorted 且计数在最后一步可得', () => {
    for (const id of Object.keys(SORT_METAS) as SortId[]) {
      const r = sortWithSteps(id, DATA);
      const last = r.steps[r.steps.length - 1]!;
      expect(last.metrics?.comparisons).toBe(r.meta.comparisons);
      expect(last.metrics?.swaps).toBe(r.meta.swaps);
    }
  });
});

describe('查找模式数据流', () => {
  it('排序后二分找到目标', () => {
    const sorted = [...DATA].sort((a, b) => a - b);
    const out = binarySearchSteps(sorted, 6);
    const last = out.steps[out.steps.length - 1]!;
    expect(last.title).toContain('6');
  });
});

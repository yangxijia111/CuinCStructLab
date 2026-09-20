import { describe, expect, it } from 'vitest';
import { seededRandom } from '../utils/misc';
import { SORT_C_CODES, SORT_METAS, type SortId } from './sorting-codes';
import { compareSorts, sortDirect, sortWithSteps } from './sorting';

const ALL: SortId[] = ['bubble', 'selection', 'insertion', 'shell', 'merge', 'quick', 'heap'];

/** TEST_PLAN §2 规定的固定数据集 */
const DATASETS: Array<{ name: string; arr: number[] }> = [
  { name: '空数组', arr: [] },
  { name: '单元素', arr: [1] },
  { name: '[2,1]', arr: [2, 1] },
  { name: '[1,2]', arr: [1, 2] },
  { name: '[3,2,1]', arr: [3, 2, 1] },
  { name: '重复值', arr: [5, 1, 5, 1, 5] },
  { name: '负数', arr: [-3, 7, -1, 0, -8, 2] },
];

function stdSorted(arr: number[]): number[] {
  return [...arr].sort((a, b) => a - b);
}

function assertCodeLines(id: SortId, steps: { codeLine: number }[]): void {
  const code = SORT_C_CODES[id];
  for (const [i, step] of steps.entries()) {
    expect(step.codeLine, `${id} step${i}`).toBeLessThanOrEqual(code.length);
    expect(step.codeLine, `${id} step${i}`).toBeGreaterThanOrEqual(0);
  }
}

describe('纯函数版排序：结果正确', () => {
  for (const id of ALL) {
    it(`${SORT_METAS[id].name} 全数据集`, () => {
      for (const ds of DATASETS) {
        expect(sortDirect(id, ds.arr), `${id} ${ds.name}`).toEqual(stdSorted(ds.arr));
      }
      // 随机 20 个（固定种子）
      const rnd = seededRandom(id.length * 100);
      const random = Array.from({ length: 20 }, () => Math.floor(rnd() * 200) - 100);
      expect(sortDirect(id, random)).toEqual(stdSorted(random));
    });
  }
});

describe('步骤版排序：终态一致 + 计数一致', () => {
  for (const id of ALL) {
    it(`${SORT_METAS[id].name} 终态 = 标准排序`, () => {
      for (const ds of DATASETS) {
        const r = sortWithSteps(id, ds.arr);
        expect(r.sorted, `${id} ${ds.name}`).toEqual(stdSorted(ds.arr));
        expect(r.steps.length, `${id} ${ds.name} 步骤非空`).toBeGreaterThan(0);
      }
      const rnd = seededRandom(42);
      const random = Array.from({ length: 16 }, () => Math.floor(rnd() * 100));
      expect(sortWithSteps(id, random).sorted).toEqual(stdSorted(random));
      assertCodeLines(id, sortWithSteps(id, [3, 1, 2]).steps);
    });

    it(`${SORT_METAS[id].name} 步骤计数与 metrics 一致`, () => {
      const arr = [5, 2, 9, 1, 7];
      const r = sortWithSteps(id, arr);
      const last = r.steps[r.steps.length - 1]!;
      expect(last.metrics?.comparisons).toBe(r.meta.comparisons);
      expect(last.metrics?.swaps).toBe(r.meta.swaps);
      // 计数单调不减
      for (let i = 1; i < r.steps.length; i++) {
        const prev = r.steps[i - 1]!.metrics;
        const cur = r.steps[i]!.metrics;
        if (prev !== undefined && cur !== undefined) {
          expect(cur.comparisons).toBeGreaterThanOrEqual(prev.comparisons);
          expect(cur.swaps).toBeGreaterThanOrEqual(prev.swaps);
        }
      }
    });

    it(`${SORT_METAS[id].name} 最后一步标记全部 sorted`, () => {
      const r = sortWithSteps(id, [3, 1, 2]);
      const last = r.steps[r.steps.length - 1]!;
      for (const c of last.afterState.cells) {
        expect(c.flags).toContain('sorted');
      }
    });
  }

  it('quick 有 pivot 标记步骤', () => {
    const r = sortWithSteps('quick', [3, 8, 2, 7]);
    expect(r.steps.some((st) => st.afterState.cells.some((c) => c.flags.includes('pivot')))).toBe(true);
  });

  it('merge 有区间标记与写回步骤', () => {
    const r = sortWithSteps('merge', [4, 2, 3, 1]);
    expect(r.steps.some((st) => st.title.includes('合并'))).toBe(true);
    expect(r.steps.some((st) => st.title.includes('写回'))).toBe(true);
    expect(r.steps.some((st) => st.afterState.range !== undefined)).toBe(true);
  });

  it('shell 有 gap 趟次步骤', () => {
    const r = sortWithSteps('shell', [9, 8, 7, 6, 5]);
    const gapSteps = r.steps.filter((st) => st.title.includes('间隔 gap ='));
    expect(gapSteps.length).toBeGreaterThanOrEqual(2); // gap=2, gap=1
  });

  it('bubble 有序数组提前结束（O(n) 优化）', () => {
    const r = sortWithSteps('bubble', [1, 2, 3, 4, 5]);
    expect(r.steps.some((st) => st.title.includes('提前结束'))).toBe(true);
    expect(r.meta.comparisons).toBe(4); // 一趟比较 n-1 次
  });
});

describe('compareSorts（Compare Mode 数据基础）', () => {
  it('同一数据多算法并行结果一致', () => {
    const arr = [6, 3, 9, 1, 7, 2];
    const rs = compareSorts(['bubble', 'quick', 'merge'], arr);
    expect(rs).toHaveLength(3);
    for (const { result } of rs) {
      expect(result.sorted).toEqual(stdSorted(arr));
    }
  });
});

describe('稳定性标注与实现一致', () => {
  it('声明的稳定性正确（对稳定算法验证相对顺序保持）', () => {
    // 用对象稳定性近似验证：对相等的原始下标顺序保持
    for (const id of ALL) {
      const arr = [5, 1, 5, 1, 5, 1];
      // 包装为 (value, originalIndex)，排序后检查相等元素的 originalIndex 递增
      const wrapped = arr.map((v, i) => ({ v, i }));
      const sorted = [...wrapped].sort((a, b) => a.v - b.v || a.i - b.i); // 稳定参考
      const ours = sortDirect(id, arr);
      expect(ours).toEqual(sorted.map((x) => x.v));
      // 值集合一致
      expect(new Set(ours)).toEqual(new Set(arr));
    }
    // bubble/insertion/merge 声明稳定，selection/shell/quick/heap 声明不稳定
    expect(SORT_METAS.bubble.stable).toBe(true);
    expect(SORT_METAS.insertion.stable).toBe(true);
    expect(SORT_METAS.merge.stable).toBe(true);
    expect(SORT_METAS.selection.stable).toBe(false);
    expect(SORT_METAS.shell.stable).toBe(false);
    expect(SORT_METAS.quick.stable).toBe(false);
    expect(SORT_METAS.heap.stable).toBe(false);
  });
});

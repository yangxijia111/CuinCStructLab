import { describe, expect, it } from 'vitest';
import type { ArrayState } from '../types';
import {
  SEQ_LIST_C_CODE,
  seqListDelete,
  seqListFind,
  seqListFrom,
  seqListInit,
  seqListInsert,
  seqListSet,
  seqListTraverse,
  seqListValues,
} from './seqlist';

/** 取操作后的终态（最后一步的 afterState） */
function finalState(outcome: { steps: { afterState: ArrayState }[] }): ArrayState {
  const last = outcome.steps[outcome.steps.length - 1];
  if (last === undefined) throw new Error('没有步骤');
  return last.afterState;
}

/** 断言所有步骤 codeLine 均在代码范围内且快照不可变 */
function assertStepInvariants(steps: { codeLine: number; beforeState: ArrayState; afterState: ArrayState }[]): void {
  for (const [i, step] of steps.entries()) {
    expect(step.codeLine, `step ${i} codeLine`).toBeGreaterThanOrEqual(0);
    expect(step.codeLine, `step ${i} codeLine`).toBeLessThanOrEqual(SEQ_LIST_C_CODE.length);
  }
}

describe('seqListFrom / 初始构建', () => {
  it('构建 [10,20,30]', () => {
    const out = seqListFrom([10, 20, 30]);
    expect(out.ok).toBe(true);
    expect(seqListValues(finalState(out))).toEqual([10, 20, 30]);
    expect(finalState(out).size).toBe(3);
    assertStepInvariants(out.steps);
  });

  it('指定容量', () => {
    const out = seqListFrom([1], 8);
    expect(finalState(out).capacity).toBe(8);
  });
});

describe('seqListInit', () => {
  it('初始化后为空表', () => {
    const out = seqListInit(4);
    expect(out.ok).toBe(true);
    const s = finalState(out);
    expect(s.size).toBe(0);
    expect(s.capacity).toBe(4);
    expect(s.cells).toHaveLength(4);
    // 内存面板包含数组对象与 L.data 指针
    const memStep = out.steps.find((st) => st.type === 'create');
    expect(memStep?.memory.cells.some((c) => c.name === 'int[4]')).toBe(true);
    expect(memStep?.memory.cells.some((c) => c.name === 'L.data')).toBe(true);
  });
});

describe('seqListInsert', () => {
  it('尾插', () => {
    const s = finalState(seqListFrom([10, 20]));
    const out = seqListInsert(s, 2, 30);
    expect(out.ok).toBe(true);
    expect(seqListValues(finalState(out))).toEqual([10, 20, 30]);
    assertStepInvariants(out.steps);
  });

  it('中间插入（含搬移步骤）', () => {
    const s = finalState(seqListFrom([10, 20, 30]));
    const out = seqListInsert(s, 1, 15);
    expect(out.ok).toBe(true);
    expect(seqListValues(finalState(out))).toEqual([10, 15, 20, 30]);
    // 必须存在搬移步骤（映射到 L->data[i+1] = L->data[i] 那一行）
    const moveLine = SEQ_LIST_C_CODE.findIndex((l) => l.includes('L->data[i + 1] = L->data[i]')) + 1;
    expect(out.steps.some((st) => st.codeLine === moveLine)).toBe(true);
    // 最终 size=4
    expect(finalState(out).size).toBe(4);
  });

  it('头插 pos=0', () => {
    const s = finalState(seqListFrom([1, 2, 3]));
    const out = seqListInsert(s, 0, 99);
    expect(seqListValues(finalState(out))).toEqual([99, 1, 2, 3]);
  });

  it('越界：pos < 0 与 pos > size 均失败且状态不变', () => {
    const s = finalState(seqListFrom([1, 2]));
    for (const bad of [-1, 3]) {
      const out = seqListInsert(s, bad, 5);
      expect(out.ok).toBe(false);
      const last = out.steps[out.steps.length - 1]!;
      expect(last.type).toBe('error');
      expect(seqListValues(last.afterState)).toEqual([1, 2]);
    }
  });

  it('扩容触发：满容量插入后容量翻倍', () => {
    const s = finalState(seqListFrom([1, 2], 2));
    const out = seqListInsert(s, 1, 9);
    expect(out.ok).toBe(true);
    const fs = finalState(out);
    expect(fs.capacity).toBe(4);
    expect(seqListValues(fs)).toEqual([1, 9, 2]);
    // 存在 grow 与 free 步骤
    expect(out.steps.some((st) => st.type === 'grow')).toBe(true);
    expect(out.steps.some((st) => st.type === 'free')).toBe(true);
  });
});

describe('seqListDelete', () => {
  it('删除中间元素', () => {
    const s = finalState(seqListFrom([10, 15, 20, 30]));
    const out = seqListDelete(s, 1);
    expect(out.ok).toBe(true);
    expect(seqListValues(finalState(out))).toEqual([10, 20, 30]);
    expect(finalState(out).size).toBe(3);
  });

  it('删除头与尾', () => {
    const s = finalState(seqListFrom([1, 2, 3]));
    expect(seqListValues(finalState(seqListDelete(s, 0)))).toEqual([2, 3]);
    expect(seqListValues(finalState(seqListDelete(s, 2)))).toEqual([1, 2]);
  });

  it('空表与越界删除失败', () => {
    const s = finalState(seqListFrom([1]));
    expect(seqListDelete(s, 0).ok).toBe(true);
    const empty = finalState(seqListFrom([], 2));
    for (const bad of [0, -1]) {
      const out = seqListDelete(empty, bad);
      expect(out.ok).toBe(false);
    }
    const s2 = finalState(seqListFrom([1, 2]));
    expect(seqListDelete(s2, 5).ok).toBe(false);
  });
});

describe('seqListFind', () => {
  it('找到存在的值（首个匹配）', () => {
    const s = finalState(seqListFrom([5, 3, 5]));
    const out = seqListFind(s, 5);
    // 最后一个 visit 步骤即命中步骤
    const hit = out.steps.find((st) => st.type === 'visit');
    expect(hit).toBeDefined();
    expect(hit?.highlight).toContain('a0');
    expect(hit?.metrics?.comparisons).toBe(1);
  });

  it('不存在的值走完全程并返回 -1', () => {
    const s = finalState(seqListFrom([1, 2, 3]));
    const out = seqListFind(s, 9);
    const last = out.steps[out.steps.length - 1]!;
    expect(last.title).toContain('-1');
    expect(out.steps.filter((st) => st.type === 'compare')).toHaveLength(3);
  });
});

describe('seqListSet', () => {
  it('修改成功', () => {
    const s = finalState(seqListFrom([1, 2, 3]));
    const out = seqListSet(s, 1, 20);
    expect(seqListValues(finalState(out))).toEqual([1, 20, 3]);
    // 写入步骤标题体现 2 → 20
    expect(out.steps.some((st) => st.title.includes('2 → 20'))).toBe(true);
  });

  it('越界修改失败', () => {
    const s = finalState(seqListFrom([1]));
    expect(seqListSet(s, 1, 9).ok).toBe(false);
    expect(seqListSet(s, -1, 9).ok).toBe(false);
  });
});

describe('seqListTraverse', () => {
  it('逐步访问全部元素', () => {
    const s = finalState(seqListFrom([7, 8, 9]));
    const out = seqListTraverse(s);
    const visits = out.steps.filter((st) => st.type === 'visit');
    expect(visits.map((st) => st.title.match(/输出 (\d+)/)?.[1]).map(Number)).toEqual([7, 8, 9]);
  });
});

describe('步骤快照不可变性', () => {
  it('终态被冻结，外部无法篡改已记录步骤', () => {
    const out = seqListFrom([1, 2]);
    const snap = finalState(out);
    expect(() => {
      snap.cells[0]!.value = 999;
    }).toThrow();
    expect(seqListValues(finalState(out))).toEqual([1, 2]);
  });
});

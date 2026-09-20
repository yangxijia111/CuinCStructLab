import { describe, expect, it } from 'vitest';
import { seededRandom } from '../utils/misc';
import type { TreeState } from '../types';
import { BST_C_CODE, bstDelete, bstFrom, bstInorder, bstInsert, bstSearch, emptyBST } from './bst';

function finalState(outcome: { steps: { afterState: TreeState }[] }): TreeState {
  const last = outcome.steps[outcome.steps.length - 1];
  if (last === undefined) throw new Error('没有步骤');
  return last.afterState;
}

function assertCodeLines(steps: { codeLine: number }[]): void {
  for (const [i, step] of steps.entries()) {
    expect(step.codeLine, `step${i}`).toBeLessThanOrEqual(BST_C_CODE.length);
    expect(step.codeLine, `step${i}`).toBeGreaterThanOrEqual(0);
  }
}

/** 断言树是合法 BST（所有节点左 < 根 < 右） */
function assertBST(state: TreeState): void {
  for (const node of Object.values(state.nodes)) {
    if (node.left !== null) {
      const l = state.nodes[node.left];
      expect(l?.value, `节点${node.value}左孩子`).toBeLessThan(node.value);
    }
    if (node.right !== null) {
      const r = state.nodes[node.right];
      expect(r?.value, `节点${node.value}右孩子`).toBeGreaterThan(node.value);
    }
  }
}

const CLASSIC = [8, 3, 10, 1, 6, 14, 4, 7, 13];

describe('bstInsert', () => {
  it('插入后中序严格递增', () => {
    let s = emptyBST();
    for (const v of [5, 3, 8, 1, 4, 7, 9]) {
      const out = bstInsert(s, v);
      expect(out.ok).toBe(true);
      s = finalState(out);
    }
    expect(bstInorder(s)).toEqual([1, 3, 4, 5, 7, 8, 9]);
    assertBST(s);
  });

  it('重复值不插入', () => {
    const s = finalState(bstFrom([5, 3, 8]));
    const out = bstInsert(s, 5);
    expect(out.steps[out.steps.length - 1]?.title).toContain('不插入重复值');
    expect(bstInorder(finalState(out))).toEqual([3, 5, 8]);
    expect(Object.keys(finalState(out).nodes)).toHaveLength(3);
  });

  it('插入路径有比较步骤', () => {
    const out = bstInsert(finalState(bstFrom([8, 3, 10])), 6);
    expect(out.steps.filter((st) => st.type === 'compare').length).toBeGreaterThanOrEqual(2);
    assertCodeLines(out.steps);
  });
});

describe('bstSearch', () => {
  it('存在：找到', () => {
    const s = finalState(bstFrom(CLASSIC));
    const out = bstSearch(s, 6);
    expect(out.steps[out.steps.length - 1]?.title).toContain('找到了 6');
  });

  it('不存在：走到空', () => {
    const s = finalState(bstFrom(CLASSIC));
    const out = bstSearch(s, 99);
    expect(out.steps[out.steps.length - 1]?.title).toContain('不在');
    assertCodeLines(out.steps);
  });

  it('空树查找直接失败', () => {
    const out = bstSearch(emptyBST(), 1);
    expect(out.steps[out.steps.length - 1]?.title).toContain('不在');
  });
});

describe('bstDelete 三情形', () => {
  it('情形一：删除叶节点', () => {
    const s = finalState(bstFrom(CLASSIC));
    const out = bstDelete(s, 4); // 4 是叶子
    expect(out.ok).toBe(true);
    expect(out.steps.some((st) => st.title.includes('情形一'))).toBe(true);
    const fs = finalState(out);
    expect(bstInorder(fs)).toEqual([1, 3, 6, 7, 8, 10, 13, 14]);
    assertBST(fs);
  });

  it('情形二：删除只有右孩子的节点', () => {
    // 构造：10 只有右孩子 14
    const s = finalState(bstFrom([10, 5, 14]));
    const out = bstDelete(s, 5); // 5 是叶子…
    expect(out.steps.some((st) => st.title.includes('情形一'))).toBe(true);
  });

  it('情形二：单孩子节点删除（构造 8(左3(左1),右10)删 3 → 1 顶替）', () => {
    const s = finalState(bstFrom([8, 3, 10, 1]));
    const out = bstDelete(s, 3); // 3 只有左孩子 1
    expect(out.ok).toBe(true);
    expect(out.steps.some((st) => st.title.includes('情形二'))).toBe(true);
    const fs = finalState(out);
    expect(bstInorder(fs)).toEqual([1, 8, 10]);
    assertBST(fs);
  });

  it('情形三：删除双子节点（用中序前驱）', () => {
    const s = finalState(bstFrom(CLASSIC));
    const out = bstDelete(s, 8); // 根，双子
    expect(out.ok).toBe(true);
    expect(out.steps.some((st) => st.title.includes('情形三'))).toBe(true);
    expect(out.steps.some((st) => st.title.includes('中序前驱是 7'))).toBe(true);
    const fs = finalState(out);
    expect(bstInorder(fs)).toEqual([1, 3, 4, 6, 7, 10, 13, 14]);
    assertBST(fs);
  });

  it('删除不存在值失败', () => {
    const s = finalState(bstFrom([5, 3, 8]));
    const out = bstDelete(s, 100);
    expect(out.ok).toBe(false);
    expect(bstInorder(finalState(out))).toEqual([3, 5, 8]);
  });

  it('删除到空树', () => {
    let s = finalState(bstFrom([5]));
    s = finalState(bstDelete(s, 5));
    expect(s.root).toBeNull();
    expect(Object.keys(s.nodes)).toHaveLength(0);
    const out = bstDelete(s, 5);
    expect(out.ok).toBe(false);
  });

  it('随机压力：边删边验证 BST 性质', () => {
    const rnd = seededRandom(2026);
    let s = emptyBST();
    const values: number[] = [];
    for (let i = 0; i < 40; i++) {
      const v = Math.floor(rnd() * 100);
      values.push(v);
      s = finalState(bstInsert(s, v));
      assertBST(s);
    }
    // 打乱后全部删除
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [values[i], values[j]] = [values[j]!, values[i]!];
    }
    const unique = [...new Set(values)];
    for (const v of unique) {
      const out = bstDelete(s, v);
      expect(out.ok, `删除 ${v}`).toBe(true);
      s = finalState(out);
      assertBST(s);
    }
    expect(Object.keys(s.nodes)).toHaveLength(0);
    expect(s.root).toBeNull();
  });

  it('全部 codeLine 在代码范围内', () => {
    const s = finalState(bstFrom(CLASSIC));
    assertCodeLines(bstDelete(s, 8).steps);
    assertCodeLines(bstDelete(s, 4).steps);
    assertCodeLines(bstInsert(s, 99).steps);
    assertCodeLines(bstSearch(s, 6).steps);
  });
});

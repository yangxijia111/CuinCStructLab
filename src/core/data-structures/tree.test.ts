import { describe, expect, it } from 'vitest';
import type { TreeState } from '../types';
import {
  TREE_C_CODE,
  treeDestroy,
  treeFrom,
  treeFromArray,
  treeLevelOrder,
  treeTraverse,
} from './tree';

function finalState(outcome: { steps: { afterState: TreeState }[] }): TreeState {
  const last = outcome.steps[outcome.steps.length - 1];
  if (last === undefined) throw new Error('没有步骤');
  return last.afterState;
}

function outputOf(outcome: { steps: { afterState: TreeState }[] }): number[] {
  return finalState(outcome).visitValues ?? [];
}

function assertCodeLines(steps: { codeLine: number }[]): void {
  for (const [i, step] of steps.entries()) {
    expect(step.codeLine, `step${i}`).toBeLessThanOrEqual(TREE_C_CODE.length);
    expect(step.codeLine, `step${i}`).toBeGreaterThanOrEqual(0);
  }
}

/** 经典教学树：
 *        8
 *       / \
 *      3   10
 *     / \
 *    1   6          */
const TREE = [8, 3, 10, 1, 6];

/** 斜树：1 → 2 → 3（全右） */
const SKEW = [1, null, 2, null, null, null, 3];

describe('遍历结果正确性', () => {
  it('经典树：pre=8 3 1 6 10，in=1 3 6 8 10，post=1 6 3 10 8', () => {
    const s = treeFromArray(TREE);
    expect(outputOf(treeTraverse(s, 'preorder'))).toEqual([8, 3, 1, 6, 10]);
    expect(outputOf(treeTraverse(s, 'inorder'))).toEqual([1, 3, 6, 8, 10]);
    expect(outputOf(treeTraverse(s, 'postorder'))).toEqual([1, 6, 3, 10, 8]);
  });

  it('层序：8 3 10 1 6', () => {
    const out = treeLevelOrder(treeFromArray(TREE));
    expect(outputOf(out)).toEqual([8, 3, 10, 1, 6]);
    assertCodeLines(out.steps);
  });

  it('单节点与空树', () => {
    expect(outputOf(treeTraverse(treeFromArray([42]), 'preorder'))).toEqual([42]);
    expect(outputOf(treeTraverse(treeFromArray([42]), 'inorder'))).toEqual([42]);
    expect(outputOf(treeTraverse(treeFromArray([42]), 'postorder'))).toEqual([42]);
    expect(outputOf(treeLevelOrder(treeFromArray([42])))).toEqual([42]);
    const empty = treeFromArray([]);
    expect(outputOf(treeTraverse(empty, 'preorder'))).toEqual([]);
    expect(outputOf(treeLevelOrder(treeFromArray([])))).toEqual([]);
  });

  it('斜树', () => {
    const s = treeFromArray(SKEW);
    expect(outputOf(treeTraverse(s, 'preorder'))).toEqual([1, 2, 3]);
    expect(outputOf(treeTraverse(s, 'inorder'))).toEqual([1, 2, 3]);
    expect(outputOf(treeTraverse(s, 'postorder'))).toEqual([3, 2, 1]);
    expect(outputOf(treeLevelOrder(s))).toEqual([1, 2, 3]);
  });

  it('完全树', () => {
    const s = treeFromArray([4, 2, 6, 1, 3, 5, 7]);
    expect(outputOf(treeTraverse(s, 'preorder'))).toEqual([4, 2, 1, 3, 6, 5, 7]);
    expect(outputOf(treeTraverse(s, 'inorder'))).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(outputOf(treeTraverse(s, 'postorder'))).toEqual([1, 3, 2, 5, 7, 6, 4]);
    expect(outputOf(treeLevelOrder(s))).toEqual([4, 2, 6, 1, 3, 5, 7]);
  });
});

describe('调用栈平衡', () => {
  it('每个 call 步骤最终都有对应 return，结束时栈为空', () => {
    for (const order of ['preorder', 'inorder', 'postorder'] as const) {
      const out = treeTraverse(treeFromArray(TREE), order);
      assertCodeLines(out.steps);
      const calls = out.steps.filter((st) => st.type === 'call').length;
      const returns = out.steps.filter((st) => st.type === 'return').length;
      // call 只统计非 NULL 调用；NULL 调用只产生一条 return 步骤
      expect(returns).toBeGreaterThanOrEqual(calls);
      // 最后一步 callStack 为空
      const last = out.steps[out.steps.length - 1]!;
      expect(last.callStack).toEqual([]);
      // 中间任一步的栈深度不超过节点数
      for (const st of out.steps) {
        expect(st.callStack.length).toBeLessThanOrEqual(5);
      }
    }
  });

  it('先序遍历展示调用栈帧名 preorder(node=8)', () => {
    const out = treeTraverse(treeFromArray(TREE), 'preorder');
    const call8 = out.steps.find((st) => st.type === 'call' && st.title.includes('8'));
    expect(call8?.callStack[0]?.fn).toBe('preorder(node=8)');
  });
});

describe('treeFrom', () => {
  it('构建后节点数正确', () => {
    const out = treeFrom(TREE);
    expect(Object.keys(finalState(out).nodes)).toHaveLength(5);
    expect(finalState(out).root).toBe('t0');
  });

  it('支持 null 空位', () => {
    const s = treeFromArray([1, null, 2]);
    expect(s.nodes['t0']?.right).toBe('t2');
    expect(s.nodes['t0']?.left).toBeNull();
  });
});

describe('treeDestroy', () => {
  it('后序释放全部节点', () => {
    const out = treeDestroy(treeFromArray(TREE));
    const frees = out.steps.filter((st) => st.type === 'free');
    expect(frees).toHaveLength(5);
    // 第一个释放的是 1（最左叶子，后序）
    expect(frees[0]?.title).toContain('1');
    // 最后释放的是根 8
    expect(frees[frees.length - 1]?.title).toContain('8');
    expect(finalState(out).root).toBeNull();
    assertCodeLines(out.steps);
  });
});

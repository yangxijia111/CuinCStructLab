/**
 * P6 集成测试：树/BST/堆/图实验室。
 */
import { describe, expect, it } from 'vitest';
import { ADVANCED_LABS } from '../src/visualization/labs-advanced';
import { C_PROGRAMS } from '../src/content';

function runOp(
  op: { run(s: unknown, p: Record<string, string>): { steps: Array<{ codeLine: number }>; state: unknown; ok: boolean } },
  state: unknown,
  params: Record<string, string>,
): { steps: Array<{ codeLine: number }>; state: unknown; ok: boolean } {
  return op.run(state, params);
}

describe('进阶实验室', () => {
  it('四个实验室均可初始化', () => {
    expect(ADVANCED_LABS.length).toBe(4);
    for (const lab of ADVANCED_LABS) {
      expect(lab.parseInit(lab.initPlaceholder)).toBeDefined();
      expect(lab.ops.length).toBeGreaterThan(0);
      for (const op of lab.ops) {
        expect(C_PROGRAMS[op.codeId], `${lab.id}/${op.id}`).toBeDefined();
      }
    }
  });

  it('树：先/中/后/层序遍历输出正确（8 3 10 1 6）', () => {
    const lab = ADVANCED_LABS.find((l) => l.id === 'tree')!;
    const state = lab.parseInit('8 3 10 1 6');
    const out = (order: string): number[] =>
      runOp(lab.ops[0] as never, state, { order }).state instanceof Object
        ? (finalVisitValues(runOp(lab.ops[0] as never, state, { order })) ?? [])
        : [];
    expect(out('pre')).toEqual([8, 3, 1, 6, 10]);
    expect(out('in')).toEqual([1, 3, 6, 8, 10]);
    expect(out('post')).toEqual([1, 6, 3, 10, 8]);
    const level = runOp(lab.ops.find((o) => o.id === 'tree-level')! as never, state, {});
    expect(finalVisitValues(level) ?? []).toEqual([8, 3, 10, 1, 6]);
    // 遍历步骤含调用栈
    const pre = runOp(lab.ops[0] as never, state, { order: 'pre' });
    expect(pre.steps.some((s) => 'callStack' in s)).toBe(true);
  });

  it('BST：插入/查找/删除三情形步骤与终态', () => {
    const lab = ADVANCED_LABS.find((l) => l.id === 'bst')!;
    const init = lab.parseInit('8 3 10 1 6 14 4 7 13');
    const insert = runOp(lab.ops.find((o) => o.id === 'bst-insert')! as never, init, { value: '5' });
    expect(insert.ok).toBe(true);
    const search = runOp(lab.ops.find((o) => o.id === 'bst-search')! as never, init, { value: '6' });
    expect(search.steps.some((s) => (s as { title?: string }).title?.includes('找到了 6'))).toBe(true);
    for (const [opId, value] of [
      ['bst-delete-leaf', '4'],
      ['bst-delete-one-child', '3'],
      ['bst-delete-two-children', '8'],
    ] as const) {
      const r = runOp(lab.ops.find((o) => o.id === opId)! as never, init, { value });
      expect(r.ok, opId).toBe(true);
      expect(r.steps.length).toBeGreaterThan(0);
    }
  });

  it('堆：插入/删除/建堆', () => {
    const lab = ADVANCED_LABS.find((l) => l.id === 'heap')!;
    const init = lab.parseInit('4 10 3 5 1');
    const ins = runOp(lab.ops.find((o) => o.id === 'heap-insert')! as never, init, { value: '9' });
    expect(ins.ok).toBe(true);
    const del = runOp(lab.ops.find((o) => o.id === 'heap-delete')! as never, init, {});
    expect(del.ok).toBe(true);
    const hy = runOp(lab.ops.find((o) => o.id === 'heap-heapify')! as never, init, { data: '4 10 3 5 1' });
    expect(hy.steps.length).toBeGreaterThan(0);
  });

  it('图：DFS/BFS 输出顺序', () => {
    const lab = ADVANCED_LABS.find((l) => l.id === 'graph')!;
    const init = lab.parseInit('A B C D E;A-B A-C B-D C-D D-E');
    const dfs = runOp(lab.ops.find((o) => o.id === 'graph-dfs')! as never, init, { start: 'A' });
    const dfsState = dfs.state as { visited: string[] };
    expect(dfsState.visited).toEqual(['A', 'B', 'D', 'C', 'E']);
    const bfs = runOp(lab.ops.find((o) => o.id === 'graph-bfs')! as never, init, { start: 'A' });
    const bfsState = bfs.state as { visited: string[] };
    expect(bfsState.visited).toEqual(['A', 'B', 'C', 'D', 'E']);
    // 添加节点
    const add = runOp(lab.ops.find((o) => o.id === 'graph-edit')! as never, init, { label: 'F' });
    expect(Object.keys((add.state as { nodes: Record<string, unknown> }).nodes)).toContain('F');
  });
});

/** 从终态取 visitValues */
function finalVisitValues(r: { state: unknown }): number[] | undefined {
  return (r.state as { visitValues?: number[] }).visitValues;
}

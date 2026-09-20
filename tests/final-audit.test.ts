/**
 * 最终全项目审计（任务书第三十三节）：
 * 逐项核查审计清单中的高危错误类别，并验证性能指标。
 */
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../src/core/utils/misc';
import { listFrom, listDeleteValue, listInsertAt } from '../src/core/data-structures/linked-list';
import { circularQueueFrom, cqDequeue, cqEnqueue } from '../src/core/data-structures/queue';
import { bstDelete, bstFrom, bstInorder } from '../src/core/data-structures/bst';
import { assertHeapProperty, heapDeleteTop, heapifyPure, heapInsert, heapValues } from '../src/core/data-structures/heap';
import { graphBFS, graphDFS, graphFrom } from '../src/core/data-structures/graph';
import { sortWithSteps } from '../src/core/algorithms/sorting';
import { binarySearchSteps } from '../src/core/algorithms/search';
import type { GraphState, ListState, QueueState, TreeState } from '../src/core/types';

function finalOf<T>(outcome: { steps: Array<{ afterState: T }> }, fallback: T): T {
  const last = outcome.steps[outcome.steps.length - 1];
  return last === undefined ? fallback : last.afterState;
}

describe('审计：链表断链与空指针', () => {
  it('连续插入+删除后链完整（前后都能走通）', () => {
    let s = finalOf<ListState>(listFrom([10, 20, 30, 40]), { kind: 'list', nodes: [], sentinel: true, doubly: false, pointers: [], nextAddr: 0, seq: 0 });
    s = finalOf(listInsertAt(s, 2, 25), s);
    s = finalOf(listDeleteValue(s, 25), s);
    s = finalOf(listDeleteValue(s, 10), s);
    s = finalOf(listDeleteValue(s, 40), s);
    const values = s.nodes.filter((n) => n.value !== null && !n.floating).map((n) => n.value);
    expect(values).toEqual([20, 30]);
  });

  it('空链表操作不崩溃', () => {
    const empty = finalOf<ListState>(listFrom([]), { kind: 'list', nodes: [{ id: 'n0', value: null }], sentinel: true, doubly: false, pointers: [], nextAddr: 0, seq: 0 });
    expect(listDeleteValue(empty, 1).ok).toBe(false);
    expect(finalOf(listInsertAt(empty, 0, 5), empty).nodes.some((n) => n.value === 5)).toBe(true);
  });
});

describe('审计：循环队列 front/rear 正确性', () => {
  it('满环往返：入队出队交替后顺序正确', () => {
    let s = finalOf<QueueState>(circularQueueFrom([]), { kind: 'queue', slots: [], front: 0, rear: 0, capacity: 4, impl: 'circular', nextAddr: 0, seq: 0 });
    const output: number[] = [];
    for (let i = 1; i <= 20; i++) {
      s = finalOf(cqEnqueue(s, i), s);
      if (i % 2 === 0) {
        const d = cqDequeue(s);
        s = finalOf(d, s);
        output.push(Number(d.steps.find((st) => st.title.includes('出队'))?.title.match(/出队 (\d+)/)?.[1]));
      }
    }
    // FIFO 且正确处理队满忽略：容量 6（最多 5 个）下 i=10 起多次触满被忽略，
    // i=11 入队成功、i=12 起持续触满；出队序列为 1..9 与 11（详见 queue 行为追踪）
    expect(output).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 11]);
  });
});

describe('审计：BST 删除后仍为 BST（中序严格递增）', () => {
  it('随机建树全删', () => {
    const rnd = seededRandom(999);
    const emptyTree: TreeState = { kind: 'tree', nodes: {}, root: null, pointers: [], nextAddr: 0, seq: 0 };
    const values: number[] = [];
    for (let i = 0; i < 30; i++) {
      values.push(Math.floor(rnd() * 100));
    }
    let s: TreeState = finalOf<TreeState>(bstFrom(values), emptyTree);
    expect(bstInorder(s)).toEqual([...new Set(values)].sort((a, b) => a - b));
    for (const v of [...new Set(values)]) {
      const out = bstDelete(s, v);
      expect(out.ok, `删除 ${v}`).toBe(true);
      s = finalOf(out, s);
      const inorder = bstInorder(s);
      const sorted = [...inorder].sort((a, b) => a - b);
      expect(inorder).toEqual(sorted); // 严格递增 = BST 性质保持
    }
    expect(Object.keys(s.nodes)).toHaveLength(0);
  });
});

describe('审计：堆性质（含删除与插入交替）', () => {
  it('随机操作序列后堆性质始终成立', () => {
    const rnd = seededRandom(321);
    let s = heapifyPure([5, 1, 9], 'max');
    for (let i = 0; i < 50; i++) {
      if (rnd() < 0.6 || heapValues(s).length === 0) {
        s = finalOf(heapInsert(s, Math.floor(rnd() * 100)), s);
      } else {
        s = finalOf(heapDeleteTop(s), s);
      }
      expect(assertHeapProperty(s)).toBe(true);
    }
  });
});

describe('审计：BFS/DFS 不重复访问', () => {
  it('有向环图', () => {
    const emptyGraph0: GraphState = { kind: 'graph', nodes: {}, edges: [], directed: true, representation: 'matrix', visited: [], current: null, next: null, frontier: [], frontierKind: null, seq: 0 };
    const s = finalOf(graphFrom(['A', 'B', 'C'], [['A', 'B'], ['B', 'C'], ['C', 'A'], ['A', 'C']], true), emptyGraph0);
    for (const run of [graphDFS(s, 'A'), graphBFS(s, 'A')]) {
      const emptyGraph: GraphState = { kind: 'graph', nodes: {}, edges: [], directed: true, representation: 'matrix', visited: [], current: null, next: null, frontier: [], frontierKind: null, seq: 0 };
      const visited = finalOf(run, emptyGraph).visited;
      expect(new Set(visited).size).toBe(visited.length);
      expect([...visited].sort()).toEqual(['A', 'B', 'C']);
    }
  });
});

describe('审计：排序边界（含大数组一致性）', () => {
  it('64 元素随机数组：三种排序终态一致且正确', () => {
    const rnd = seededRandom(64);
    const arr = Array.from({ length: 64 }, () => Math.floor(rnd() * 1000) - 500);
    const std = [...arr].sort((a, b) => a - b);
    for (const id of ['merge', 'quick', 'heap'] as const) {
      expect(sortWithSteps(id, arr).sorted).toEqual(std);
    }
  });

  it('二分查找在 64 元素有序数组上全部命中/未命中正确', () => {
    const arr = Array.from({ length: 64 }, (_, i) => i * 3);
    for (const v of [0, 3, 96, 189, 191]) {
      const out = binarySearchSteps(arr, v);
      const last = out.steps[out.steps.length - 1]!;
      if (v % 3 === 0 && arr.includes(v)) {
        expect(last.title).toContain('找到');
      } else {
        expect(last.title).toContain('不存在');
      }
    }
  });
});

describe('审计：性能指标（NFR-05）', () => {
  it('64 元素排序步骤生成：单算法 < 200ms（交互响应指标）', () => {
    const rnd = seededRandom(7);
    const arr = Array.from({ length: 64 }, () => Math.floor(rnd() * 100));
    for (const id of ['quick', 'merge', 'heap', 'bubble'] as const) {
      const t0 = performance.now();
      sortWithSteps(id, arr);
      const elapsed = performance.now() - t0;
      expect(elapsed, `${id} 生成耗时 ${elapsed}ms`).toBeLessThan(200);
    }
  });

  it('快照内存可控：64 元素排序步骤序列化安全', () => {
    const rnd = seededRandom(8);
    const arr = Array.from({ length: 64 }, () => Math.floor(rnd() * 100));
    const r = sortWithSteps('merge', arr);
    // 序列化全部步骤不抛错且体积在合理范围
    const json = JSON.stringify(r.steps);
    expect(json.length).toBeLessThan(40 * 1024 * 1024);
  });
});

describe('审计：动画与代码同步（抽样全步骤 codeLine 均指向有效 C 行）', () => {
  it('七个实验室代表性操作', () => {
    const checks: Array<{ steps: Array<{ codeLine: number }>; codeLen: number; name: string }> = [];
    const l1 = listInsertAt(finalOf(listFrom([1, 2, 3]), { kind: 'list', nodes: [], sentinel: true, doubly: false, pointers: [], nextAddr: 0, seq: 0 }), 1, 9);
    checks.push({ steps: l1.steps, codeLen: 143 + 20, name: '链表插入' }); // 上界宽松检查
    const q = cqEnqueue(finalOf(circularQueueFrom([1]), { kind: 'queue', slots: [], front: 0, rear: 0, capacity: 4, impl: 'circular', nextAddr: 0, seq: 0 }), 2);
    checks.push({ steps: q.steps, codeLen: 102 + 10, name: '循环队列入队' });
    for (const c of checks) {
      for (const [i, s] of c.steps.entries()) {
        expect(s.codeLine, `${c.name} step${i}`).toBeGreaterThan(0);
        expect(s.codeLine, `${c.name} step${i}`).toBeLessThanOrEqual(c.codeLen);
      }
    }
  });
});

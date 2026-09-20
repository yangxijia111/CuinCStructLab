import { describe, expect, it } from 'vitest';
import { DOUBLY_LIST_C_CODE, doublyDeleteValue, doublyListFrom, doublyPushFront } from '../src/core/data-structures/doubly-list';
import { STACK_C_CODE, arrayStackFrom, arrayStackPop, arrayStackPush, bracketMatchDemo } from '../src/core/data-structures/stack';
import { QUEUE_C_CODE, circularQueueFrom, cqDequeue, cqEnqueue, lqDequeue, lqEnqueue, linkedQueueFrom } from '../src/core/data-structures/queue';
import { TREE_C_CODE, treeFromArray, treeTraverse, treeLevelOrder } from '../src/core/data-structures/tree';
import { BST_C_CODE, bstDelete, bstFrom, bstInsert, bstSearch } from '../src/core/data-structures/bst';
import { HEAP_C_CODE, heapDeleteTop, heapInsert, heapifyPure } from '../src/core/data-structures/heap';
import { GRAPH_C_CODE, graphBFS, graphDFS, graphFrom } from '../src/core/data-structures/graph';
import { sortWithSteps } from '../src/core/algorithms/sorting';
import { SORT_C_CODES, type SortId } from '../src/core/algorithms/sorting-codes';

function report(name: string, code: string[], steps: Array<{ codeLine: number }>): void {
  const seen = new Map<number, string>();
  for (const s of steps) {
    if (s.codeLine > 0 && !seen.has(s.codeLine)) {
      seen.set(s.codeLine, (code[s.codeLine - 1] ?? 'OUT-OF-RANGE').trim().slice(0, 60));
    }
  }
  console.log(`\n=== ${name} (${code.length} 行) ===`);
  for (const [ln, text] of [...seen.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${ln}: ${text}`);
  }
}

function finalOf<T>(outcome: { steps: Array<{ afterState: T }> }, fallback: T): T {
  const last = outcome.steps[outcome.steps.length - 1];
  return last === undefined ? fallback : last.afterState;
}

describe('行号审计', () => {
  it('打印各模块 codeLine 指向', () => {
    report('doubly pushFront', DOUBLY_LIST_C_CODE, doublyPushFront(finalOf(doublyListFrom([10, 20]), finalOf(doublyListFrom([]), { kind: 'list', nodes: [], sentinel: true, doubly: true, pointers: [], nextAddr: 0, seq: 0 })), 5).steps);
    report('doubly delete', DOUBLY_LIST_C_CODE, doublyDeleteValue(finalOf(doublyListFrom([10, 20, 30]), { kind: 'list', nodes: [], sentinel: true, doubly: true, pointers: [], nextAddr: 0, seq: 0 }), 20).steps);
    report('stack push', STACK_C_CODE, arrayStackPush(finalOf(arrayStackFrom([1]), arrayStackFrom([]).steps[0]!.afterState), 2).steps);
    report('stack pop', STACK_C_CODE, arrayStackPop(finalOf(arrayStackFrom([1, 2]), arrayStackFrom([]).steps[0]!.afterState)).steps);
    report('bracket', STACK_C_CODE, bracketMatchDemo('{[()]}').steps);
    report('cq enqueue', QUEUE_C_CODE, cqEnqueue(finalOf(circularQueueFrom([1, 2]), circularQueueFrom([]).steps[0]!.afterState), 3).steps);
    report('cq dequeue', QUEUE_C_CODE, cqDequeue(finalOf(circularQueueFrom([1, 2]), circularQueueFrom([]).steps[0]!.afterState)).steps);
    report('lq enqueue', QUEUE_C_CODE, lqEnqueue(finalOf(linkedQueueFrom([1]), linkedQueueFrom([]).steps[0]!.afterState), 2).steps);
    report('lq dequeue', QUEUE_C_CODE, lqDequeue(finalOf(linkedQueueFrom([1, 2]), linkedQueueFrom([]).steps[0]!.afterState)).steps);
    report('tree preorder', TREE_C_CODE, treeTraverse(treeFromArray([8, 3, 10, 1, 6]), 'preorder').steps);
    report('tree level', TREE_C_CODE, treeLevelOrder(treeFromArray([8, 3, 10])).steps);
    report('bst insert', BST_C_CODE, bstInsert(finalOf(bstFrom([8, 3]), { kind: 'tree', nodes: {}, root: null, pointers: [], nextAddr: 0, seq: 0 }), 6).steps);
    report('bst search', BST_C_CODE, bstSearch(finalOf(bstFrom([8, 3, 10]), { kind: 'tree', nodes: {}, root: null, pointers: [], nextAddr: 0, seq: 0 }), 3).steps);
    report('bst delete', BST_C_CODE, bstDelete(finalOf(bstFrom([8, 3, 10, 1, 6, 14]), { kind: 'tree', nodes: {}, root: null, pointers: [], nextAddr: 0, seq: 0 }), 8).steps);
    report('heap insert', HEAP_C_CODE, heapInsert(heapifyPure([5, 3], 'max'), 9).steps);
    report('heap delete', HEAP_C_CODE, heapDeleteTop(heapifyPure([9, 3, 5], 'max')).steps);
    const g = finalOf(graphFrom(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']]), { kind: 'graph', nodes: {}, edges: [], directed: false, representation: 'matrix', visited: [], current: null, next: null, frontier: [], frontierKind: null, seq: 0 });
    report('graph dfs', GRAPH_C_CODE, graphDFS(g, 'A').steps);
    report('graph bfs', GRAPH_C_CODE, graphBFS(g, 'A').steps);
    for (const id of ['bubble', 'selection', 'insertion', 'quick'] as SortId[]) {
      report(`sort ${id}`, SORT_C_CODES[id], sortWithSteps(id, [5, 2, 9, 1]).steps);
    }
    expect(true).toBe(true);
  });
});

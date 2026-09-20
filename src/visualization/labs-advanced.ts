/**
 * 进阶实验室：树 / BST / 堆 / 图（P6）。
 */
import type { GraphState, HeapState, TreeState } from '../core/types';
import { treeFromArray, treeLevelOrder, treeTraverse } from '../core/data-structures/tree';
import { bstDelete, bstFrom, bstInsert, bstSearch, emptyBST } from '../core/data-structures/bst';
import { heapDeleteTop, heapInsert, heapify, heapifyPure } from '../core/data-structures/heap';
import { graphAddEdge, graphBFS, graphDFS, graphFrom, graphMoveNode, graphRemoveNode } from '../core/data-structures/graph';
import { opCode as opCodeBase, parseNumbers } from './labs';
import type { LabDef, LabOpDef } from './labs';

function finalOf<S>(outcome: { steps: Array<{ afterState: S }> }, fallback: S): S {
  const last = outcome.steps[outcome.steps.length - 1];
  return last === undefined ? fallback : last.afterState;
}

function num(params: Record<string, string>, key: string, def = 0): number {
  const v = Number(params[key]);
  return Number.isFinite(v) ? v : def;
}

/* ============ 树 ============ */

/** "8 3 10 1 6 null null" → 层序数组 */
function parseLevelOrder(text: string): Array<number | null> {
  return text
    .split(/[\s,]+/)
    .filter((t) => t.length > 0)
    .map((t) => (t === 'null' || t === 'n' ? null : Number(t)))
    .map((v) => (v !== null && Number.isFinite(v) ? v : null));
}

const TREE_LAB: LabDef<TreeState> = {
  id: 'tree',
  name: '二叉树',
  desc: '层序输入（null 为空位）。遍历时右侧显示递归调用栈。',
  initPlaceholder: '8 3 10 1 6',
  parseInit: (text) => treeFromArray(parseLevelOrder(text)),
  ops: [
    {
      id: 'tree-traverse',
      name: '遍历（先/中/后序 + 调用栈）',
      desc: 'preorder / inorder / postorder',
      params: [{ key: 'order', label: 'order（pre/in/post）', kind: 'text', default: 'pre' }],
      codeId: 'tree',
      run: (state, p) => {
        const s = state ?? treeFromArray([8, 3, 10, 1, 6]);
        const order = p.order === 'in' ? 'inorder' : p.order === 'post' ? 'postorder' : 'preorder';
        const out = treeTraverse(s, order);
        return { steps: out.steps, state: finalOf(out, s), ok: true };
      },
    },
    {
      id: 'tree-level',
      name: '层序遍历（队列）',
      desc: '',
      params: [],
      codeId: 'tree',
      run: (state) => {
        const s = state ?? treeFromArray([8, 3, 10, 1, 6]);
        const out = treeLevelOrder(s);
        return { steps: out.steps, state: finalOf(out, s), ok: true };
      },
    },
  ],
};

/* ============ BST ============ */

const BST_LAB: LabDef<TreeState> = {
  id: 'bst',
  name: 'BST',
  desc: '按插入顺序建树。删除演示三情形（叶/单子/双子用中序前驱）。',
  initPlaceholder: '8 3 10 1 6 14 4 7 13',
  parseInit: (text) => finalOf(bstFrom(parseNumbers(text)), emptyBST()),
  ops: [
    {
      id: 'bst-insert',
      name: '插入 insert(value)',
      desc: '小于往左大于往右',
      params: [{ key: 'value', label: '值', kind: 'number', default: '5' }],
      codeId: 'bst',
      run: (state, p) => {
        const out = bstInsert(state ?? emptyBST(), num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? emptyBST()), ok: out.ok };
      },
    },
    {
      id: 'bst-search',
      name: '查找 search(value)',
      desc: '每步排除一棵子树',
      params: [{ key: 'value', label: '值', kind: 'number', default: '6' }],
      codeId: 'bst',
      run: (state, p) => {
        const out = bstSearch(state ?? emptyBST(), num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? emptyBST()), ok: true };
      },
    },
    {
      id: 'bst-delete-leaf',
      name: '删除情形一：叶节点（如 4）',
      desc: '',
      params: [{ key: 'value', label: '要删的值', kind: 'number', default: '4' }],
      codeId: 'bst',
      run: (state, p) => {
        const out = bstDelete(state ?? finalOf(bstFrom([8, 3, 10, 1, 6, 14, 4, 7, 13]), emptyBST()), num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? emptyBST()), ok: out.ok };
      },
    },
    {
      id: 'bst-delete-one-child',
      name: '删除情形二：单孩子（建 8 3 10 1 后删 3）',
      desc: '孩子顶替',
      params: [{ key: 'value', label: '要删的值', kind: 'number', default: '3' }],
      codeId: 'bst',
      run: (state, p) => {
        const s = state ?? finalOf(bstFrom([8, 3, 10, 1]), emptyBST());
        const out = bstDelete(s, num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, s), ok: out.ok };
      },
    },
    {
      id: 'bst-delete-two-children',
      name: '删除情形三：双子节点（如删 8）',
      desc: '中序前驱顶值',
      params: [{ key: 'value', label: '要删的值', kind: 'number', default: '8' }],
      codeId: 'bst',
      run: (state, p) => {
        const out = bstDelete(state ?? finalOf(bstFrom([8, 3, 10, 1, 6, 14, 4, 7, 13]), emptyBST()), num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? emptyBST()), ok: out.ok };
      },
    },
  ],
};

/* ============ 堆 ============ */

const HEAP_LAB: LabDef<HeapState> = {
  id: 'heap',
  name: '堆',
  desc: '数组存储的完全二叉树。树 + 数组双视图。',
  initPlaceholder: '4 10 3 5 1',
  parseInit: (text) => heapifyPure(parseNumbers(text), 'max'),
  ops: [
    {
      id: 'heap-insert',
      name: '插入 insert(value)（上滤）',
      desc: '',
      params: [{ key: 'value', label: '值', kind: 'number', default: '9' }],
      codeId: 'heap',
      run: (state, p) => {
        const out = heapInsert(state ?? heapifyPure([], 'max'), num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? heapifyPure([], 'max')), ok: out.ok };
      },
    },
    {
      id: 'heap-delete',
      name: '删除堆顶（下滤）',
      desc: '',
      params: [],
      codeId: 'heap',
      run: (state) => {
        const out = heapDeleteTop(state ?? heapifyPure([1], 'max'));
        return { steps: out.steps, state: finalOf(out, state ?? heapifyPure([1], 'max')), ok: out.ok };
      },
    },
    {
      id: 'heap-heapify',
      name: 'Floyd 建堆 O(n)',
      desc: '从最后一个非叶节点倒序下滤',
      params: [{ key: 'data', label: '数组', kind: 'text', default: '4 10 3 5 1' }],
      codeId: 'heap',
      run: (_state, p) => {
        const arr = parseNumbers(p.data !== undefined && p.data.trim() !== '' ? p.data : '4 10 3 5 1');
        const out = heapify(arr, 'max');
        return { steps: out.steps, state: finalOf(out, heapifyPure(arr, 'max')), ok: true };
      },
    },
  ],
};

/* ============ 图 ============ */

/** "A B C;A-B B-C" → labels + edges */
function parseGraph(text: string): { labels: string[]; edges: Array<[string, string]> } {
  const [nodePart, edgePart] = text.split(';');
  const labels = (nodePart ?? '')
    .split(/[\s,]+/)
    .filter((t) => t.length > 0);
  const edges: Array<[string, string]> = [];
  for (const pair of (edgePart ?? '').split(/\s+/)) {
    const m = pair.match(/^(\w+)-(\w+)$/);
    if (m !== null && labels.includes(m[1]!) && labels.includes(m[2]!)) {
      edges.push([m[1]!, m[2]!]);
    }
  }
  return { labels, edges };
}

function emptyGraphState(): GraphState {
  return {
    kind: 'graph',
    nodes: {},
    edges: [],
    directed: false,
    representation: 'matrix',
    visited: [],
    current: null,
    next: null,
    frontier: [],
    frontierKind: null,
    seq: 1,
  };
}

const GRAPH_LAB: LabDef<GraphState> = {
  id: 'graph',
  name: '图',
  desc: '格式：顶点 ; 边（如 A B C D E;A-B A-C）。DFS 显示栈，BFS 显示队列。',
  initPlaceholder: 'A B C D E;A-B A-C B-D C-D D-E',
  parseInit: (text) => {
    const { labels, edges } = parseGraph(text);
    if (labels.length === 0) return emptyGraphState();
    return finalOf(graphFrom(labels, edges), emptyGraphState());
  },
  ops: [
    {
      id: 'graph-dfs',
      name: 'DFS 深度优先',
      desc: '递归栈',
      params: [{ key: 'start', label: '起点', kind: 'text', default: 'A' }],
      codeId: 'graph',
      run: (state, p) => {
        const s = state ?? emptyGraphState();
        const start = p.start !== undefined && p.start.trim() !== '' ? p.start.trim() : Object.keys(s.nodes)[0] ?? 'A';
        const out = graphDFS(s, start);
        return { steps: out.steps, state: finalOf(out, s), ok: true };
      },
    },
    {
      id: 'graph-bfs',
      name: 'BFS 广度优先',
      desc: '队列',
      params: [{ key: 'start', label: '起点', kind: 'text', default: 'A' }],
      codeId: 'graph',
      run: (state, p) => {
        const s = state ?? emptyGraphState();
        const start = p.start !== undefined && p.start.trim() !== '' ? p.start.trim() : Object.keys(s.nodes)[0] ?? 'A';
        const out = graphBFS(s, start);
        return { steps: out.steps, state: finalOf(out, s), ok: true };
      },
    },
    {
      id: 'graph-edit',
      name: '添加节点',
      desc: '',
      params: [{ key: 'label', label: '标签', kind: 'text', default: 'F' }],
      codeId: 'graph',
      run: (state, p) => {
        const s = state ?? emptyGraphState();
        const label = p.label?.trim() !== '' && p.label !== undefined ? p.label.trim() : 'F';
        // graphAddNode 是步骤版；取终态
        const out = graphAddNodeStep(s, label);
        return out;
      },
    },
    {
      id: 'graph-remove-node',
      name: '删除节点（级联删边）',
      desc: '',
      params: [{ key: 'label', label: '标签', kind: 'text', default: 'A' }],
      codeId: 'graph',
      run: (state, p) => {
        const s = state ?? emptyGraphState();
        const label = p.label !== undefined && p.label.trim() !== '' ? p.label.trim() : Object.keys(s.nodes)[0] ?? 'A';
        const out = graphRemoveNodeStep(s, label);
        return out;
      },
    },
    {
      id: 'graph-add-edge',
      name: '添加边 u-v',
      desc: '',
      params: [
        { key: 'u', label: 'u', kind: 'text', default: 'A' },
        { key: 'v', label: 'v', kind: 'text', default: 'E' },
      ],
      codeId: 'graph',
      run: (state, p) => {
        const s = state ?? emptyGraphState();
        const u = p.u?.trim() ?? 'A';
        const v = p.v?.trim() ?? 'E';
        const out = graphAddEdgeStep(s, u, v);
        return out;
      },
    },
  ],
};

import { graphAddNode } from '../core/data-structures/graph';

function graphAddNodeStep(s: GraphState, label: string): { steps: never[]; state: GraphState; ok: boolean } {
  const out = graphAddNode(s, label);
  return { steps: out.steps as never[], state: finalOf(out, s), ok: out.ok };
}
function graphRemoveNodeStep(s: GraphState, label: string): { steps: never[]; state: GraphState; ok: boolean } {
  const out = graphRemoveNode(s, label);
  return { steps: out.steps as never[], state: finalOf(out, s), ok: out.ok };
}
function graphAddEdgeStep(s: GraphState, u: string, v: string): { steps: never[]; state: GraphState; ok: boolean } {
  const out = graphAddEdge(s, u, v);
  return { steps: out.steps as never[], state: finalOf(out, s), ok: out.ok };
}

/** 拖动节点（直接状态更新，不产生步骤） */
export const graphMove = graphMoveNode;

export const ADVANCED_LABS = [TREE_LAB, BST_LAB, HEAP_LAB, GRAPH_LAB];

export { opCodeBase as opCode };
export type { LabOpDef };

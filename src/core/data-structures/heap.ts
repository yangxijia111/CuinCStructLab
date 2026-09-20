/**
 * 堆（数组实现的完全二叉树）：insert（上滤）/ deleteTop（下滤）/ heapify（Floyd 建堆）（DATA_STRUCTURE_SPEC §7）。
 * 下标关系（0-based）：parent(i) = (i-1)/2，children = 2i+1、2i+2。
 */
import { SimMem, StepRecorder, indexVar, intVar } from '../recorder';
import type { HeapState, Step, VizOutcome } from '../types';

/** 教学 C 代码（Step.codeLine 指向这里，1-based） */
export const HEAP_C_CODE: string[] = [
  '/* 最大堆（最小堆同理，比较方向反过来）*/',
  '#include <stdio.h>',
  '#include <stdlib.h>',
  '',
  '#define HEAP_CAP 64',
  '',
  'typedef struct {',
  '    int data[HEAP_CAP];  /* 数组存放，逻辑上是一棵完全二叉树 */',
  '    int size;            /* 当前元素个数 */',
  '} Heap;',
  '',
  '/* 下标关系（0-based）：parent(i) = (i-1)/2，left(i) = 2i+1，right(i) = 2i+2 */',
  'void swap(int *a, int *b) {',
  '    int tmp = *a;',
  '    *a = *b;',
  '    *b = tmp;',
  '}',
  '',
  '/* 初始化空堆 */',
  'void heapInit(Heap *h) {',
  '    h->size = 0;',
  '}',
  '',
  '/* 插入：放到数组末尾，一路向上和父节点比较（上滤 sift-up） */',
  'int heapInsert(Heap *h, int value) {',
  '    if (h->size == HEAP_CAP) {',
  '        return -1;        /* 堆满 */',
  '    }',
  '    int i = h->size;',
  '    h->data[i] = value;   /* 先放到最后一个位置 */',
  '    h->size = h->size + 1;',
  '    while (i > 0) {',
  '        int p = (i - 1) / 2;          /* 父节点下标 */',
  '        if (h->data[i] <= h->data[p]) {',
  '            break;                    /* 不再比父节点大：到位了 */',
  '        }',
  '        swap(&h->data[i], &h->data[p]);  /* 比父节点大：和父节点交换 */',
  '        i = p;                        /* 继续向上检查 */',
  '    }',
  '    return 0;',
  '}',
  '',
  '/* 下滤：让下标 i 的元素下沉到正确位置（子树中最大的孩子上来） */',
  'void siftDown(Heap *h, int i, int n) {',
  '    while (1) {',
  '        int largest = i;',
  '        int left = 2 * i + 1;',
  '        int right = 2 * i + 2;',
  '        if (left < n && h->data[left] > h->data[largest]) {',
  '            largest = left;',
  '        }',
  '        if (right < n && h->data[right] > h->data[largest]) {',
  '            largest = right;',
  '        }',
  '        if (largest == i) {',
  '            break;                    /* 比两个孩子都大：到位 */',
  '        }',
  '        swap(&h->data[i], &h->data[largest]);',
  '        i = largest;                  /* 继续向下检查 */',
  '    }',
  '}',
  '',
  '/* 删除堆顶：末尾元素补位，再下滤 */',
  'int heapDeleteTop(Heap *h, int *out) {',
  '    if (h->size == 0) {',
  '        return -1;        /* 空堆 */',
  '    }',
  '    *out = h->data[0];           /* 堆顶就是最大值 */',
  '    h->data[0] = h->data[h->size - 1];  /* 最后一个元素放到堆顶 */',
  '    h->size = h->size - 1;',
  '    siftDown(h, 0, h->size);     /* 从根开始下滤 */',
  '    return 0;',
  '}',
  '',
  '/* Floyd 建堆：从最后一个非叶节点开始，逐个下滤。O(n) */',
  'void heapify(Heap *h, int arr[], int n) {',
  '    h->size = n;',
  '    for (int i = 0; i < n; i++) {',
  '        h->data[i] = arr[i];',
  '    }',
  '    for (int i = n / 2 - 1; i >= 0; i--) {  /* 最后一个非叶节点是 n/2-1 */',
  '        siftDown(h, i, n);',
  '    }',
  '}',
];

/* ============ 状态构造 ============ */

export function emptyHeap(compare: 'max' | 'min' = 'max'): HeapState {
  return {
    kind: 'heap',
    order: [],
    nodes: {},
    root: null,
    compare,
    nextAddr: 0x8000,
    seq: 1,
  };
}

/** 堆的数组值序列（下标顺序） */
export function heapValues(state: HeapState): number[] {
  return state.order.map((id) => state.nodes[id]?.value ?? 0);
}

/** 从数组直接建堆状态（不做步骤；内部用 Floyd heapify 逻辑） */
export function heapifyPure(values: number[], compare: 'max' | 'min'): HeapState {
  const state = emptyHeap(compare);
  const n = values.length;
  const arr = [...values];
  const better = (a: number, b: number): boolean => (compare === 'max' ? a > b : a < b);
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    siftDownPure(arr, i, n, better);
  }
  state.order = arr.map((v, idx) => {
    const id = `h${idx}`;
    state.nodes[id] = { id, value: v, left: null, right: null };
    return id;
  });
  state.root = state.order[0] ?? null;
  state.seq = n + 1;
  return state;
}

/** 纯下滤（数组版），siftDownPure(arr, i, n, better) */
export function siftDownPure(arr: number[], i: number, n: number, better: (a: number, b: number) => boolean): void {
  for (;;) {
    let best = i;
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    if (l < n && better(arr[l]!, arr[best]!)) best = l;
    if (r < n && better(arr[r]!, arr[best]!)) best = r;
    if (best === i) break;
    [arr[i], arr[best]] = [arr[best]!, arr[i]!];
    i = best;
  }
}

/** 全量断言堆性质（父 ≥/≤ 子） */
export function assertHeapProperty(state: HeapState): boolean {
  const vals = heapValues(state);
  const better = (a: number, b: number): boolean => (state.compare === 'max' ? a >= b : a <= b);
  for (let i = 1; i < vals.length; i++) {
    const p = (i - 1) >> 1;
    if (!better(vals[p]!, vals[i]!)) return false;
  }
  return true;
}

function heapMem(state: HeapState): SimMem {
  const mem = new SimMem(state.nextAddr);
  mem.allocObject('arr', `int[${state.order.length}]`, '堆数组', 'int[]');
  mem.defineVar('h->size', String(state.order.length), 'int');
  return mem;
}

function makeNodeMap(order: string[], nodes: HeapState['nodes']): void {
  for (const [i, id] of order.entries()) {
    const node = nodes[id];
    if (node === undefined) continue;
    node.left = 2 * i + 1 < order.length ? (order[2 * i + 1] ?? null) : null;
    node.right = 2 * i + 2 < order.length ? (order[2 * i + 2] ?? null) : null;
  }
}

/* ============ 操作 ============ */

/** 插入（上滤） */
export function heapInsert(state: HeapState, value: number): VizOutcome<HeapState> {
  const rec = new StepRecorder<HeapState>(state);
  const mem = heapMem(state);
  const better = state.compare === 'max' ? (a: number, b: number) => a > b : (a: number, b: number) => a < b;
  const cmpWord = state.compare === 'max' ? '大' : '小';

  // 创建新节点放末尾
  const newId = `h${state.seq}`;
  rec.record({
    type: 'insert',
    title: `h->data[${state.order.length}] = ${value}（先放到数组末尾，堆可能暂时被破坏）`,
    description: `新元素先挂在完全二叉树的最后一个位置，size+1。`,
    beginnerNote: `完全二叉树用数组存的精髓：下标 i 的父节点是 (i-1)/2，不需要指针。新节点先放最后，再"爬"上去。`,
    codeLine: 31,
    variables: [indexVar('i', state.order.length), intVar('h->size', state.order.length + 1)],
    memory: mem.snapshot(),
    highlight: [newId],
    mutate: (s) => {
      s.seq += 1;
      s.nodes[newId] = { id: newId, value, left: null, right: null };
      s.order.push(newId);
      makeNodeMap(s.order, s.nodes);
    },
  });

  // 上滤
  let i = state.order.length;
  while (i > 0) {
    const p = (i - 1) >> 1;
    const childId = rec.state.order[i]!;
    const parentId = rec.state.order[p]!;
    const cv = rec.state.nodes[childId]!.value;
    const pv = rec.state.nodes[parentId]!.value;
    if (!better(cv, pv)) {
      rec.record({
        type: 'compare',
        title: `data[${i}](${cv}) 不比父节点 data[${p}](${pv}) ${cmpWord}：到位，停止上滤`,
        description: `父节点已经${state.compare === 'max' ? '不小于' : '不大于'}新元素，堆性质恢复。`,
        codeLine: 36,
        variables: [indexVar('i', i), indexVar('p', p)],
        memory: mem.snapshot(),
        highlight: [childId, parentId],
      });
      break;
    }
    rec.record({
      type: 'swap',
      title: `data[${i}](${cv}) 比父节点 data[${p}](${pv}) ${cmpWord}：swap 后继续向上`,
      description: `与父节点交换，新元素向上"冒"。`,
      beginnerNote: `上滤最多走树高步 = O(log n)。每次只和父节点比较，兄弟之间不比较。`,
      codeLine: 40,
      variables: [indexVar('i', i), indexVar('p', p)],
      memory: mem.snapshot(),
      highlight: [childId, parentId],
      metrics: { comparisons: 1, swaps: 1 },
      mutate: (s) => {
        const oi = s.order[i]!;
        s.order[i] = s.order[p]!;
        s.order[p] = oi;
        makeNodeMap(s.order, s.nodes);
      },
    });
    i = p;
  }

  return rec.finish();
}

/** 内部：下滤并记录步骤（从 i 开始，n 为有效长度） */
function siftDown(rec: StepRecorder<HeapState>, mem: SimMem, iStart: number, n: number): void {
  const better = rec.state.compare === 'max' ? (a: number, b: number) => a > b : (a: number, b: number) => a < b;
  const cmpWord = rec.state.compare === 'max' ? '大' : '小';
  let i = iStart;
  for (;;) {
    let best = i;
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    const iv = rec.state.nodes[rec.state.order[i]!]?.value ?? 0;
    let bestWord = '';
    if (l < n) {
      const lv = rec.state.nodes[rec.state.order[l]!]?.value ?? 0;
      if (better(lv, iv)) {
        best = l;
        bestWord = `左孩子 ${lv} 更${cmpWord}，`;
      }
    }
    if (r < n) {
      const rv = rec.state.nodes[rec.state.order[r]!]?.value ?? 0;
      const curBest = best === i ? iv : (rec.state.nodes[rec.state.order[best]!]?.value ?? 0);
      if (better(rv, curBest)) {
        best = r;
        bestWord = `右孩子 ${rv} 最${cmpWord}，`;
      }
    }
    if (best === i) {
      rec.record({
        type: 'compare',
        title: `data[${i}](${iv}) 已比两个孩子都${cmpWord}：到位，停止下滤`,
        description: '当前位置满足堆性质，下滤结束。',
        codeLine: 57,
        variables: [indexVar('i', i)],
        memory: mem.snapshot(),
        highlight: [rec.state.order[i]!],
      });
      break;
    }
    const bv = rec.state.nodes[rec.state.order[best]!]?.value ?? 0;
    rec.record({
      type: 'swap',
      title: `${bestWord}swap(data[${i}], data[${best}])：${iv} 与 ${bv} 交换`,
      description: `和更${cmpWord}的孩子交换，继续向下检查。`,
      codeLine: 60,
      variables: [indexVar('i', i), indexVar('largest', best)],
      memory: mem.snapshot(),
      highlight: [rec.state.order[i]!, rec.state.order[best]!],
      metrics: { comparisons: 1, swaps: 1 },
      mutate: (s) => {
        const oi = s.order[i]!;
        s.order[i] = s.order[best]!;
        s.order[best] = oi;
        makeNodeMap(s.order, s.nodes);
      },
    });
    i = best;
  }
}

/** 删除堆顶 */
export function heapDeleteTop(state: HeapState): VizOutcome<HeapState> {
  const rec = new StepRecorder<HeapState>(state);
  const mem = heapMem(state);

  if (state.order.length === 0) {
    rec.fail('空堆', 'h->size == 0，没有元素可删除。', 66);
    return rec.finish();
  }

  const topValue = state.nodes[state.order[0]!]!.value;
  rec.record({
    type: 'delete',
    title: `*out = h->data[0]：取出堆顶 ${topValue}（${state.compare === 'max' ? '最大' : '最小'}值）`,
    description: `堆顶永远是${state.compare === 'max' ? '最大' : '最小'}元素，O(1) 取出。`,
    codeLine: 70,
    variables: [intVar('*out', topValue)],
    memory: mem.snapshot(),
    highlight: [state.order[0]!],
  });

  if (state.order.length === 1) {
    rec.record({
      type: 'free',
      title: '堆空了，size = 0',
      description: '最后一个元素删除后堆为空。',
      codeLine: 72,
      memory: mem.snapshot(),
      mutate: (s) => {
        s.order = [];
        s.root = null;
      },
    });
    return rec.finish();
  }

  const lastValue = state.nodes[state.order[state.order.length - 1]!]!.value;
  rec.record({
    type: 'assign',
    title: `h->data[0] = h->data[size-1]：末尾元素 ${lastValue} 补到堆顶，size-1`,
    description: '删除堆顶后，把最后一个元素搬来补位，然后下滤恢复堆性质。',
    beginnerNote: '为什么用最后一个元素补位？因为只有它补上来，树才能保持"完全二叉树"的形状。',
    codeLine: 71,
    memory: mem.snapshot(),
    highlight: [state.order[0]!],
    mutate: (s) => {
      const lastId = s.order.pop()!;
      s.order[0] = lastId;
      makeNodeMap(s.order, s.nodes);
    },
  });

  siftDown(rec, mem, 0, rec.state.order.length);
  return rec.finish();
}

/** Floyd 建堆（O(n)，自底向上下滤） */
export function heapify(values: number[], compare: 'max' | 'min' = 'max'): VizOutcome<HeapState> {
  const rec = new StepRecorder<HeapState>(emptyHeap(compare));
  const mem = heapMem(rec.state);

  rec.record({
    type: 'init',
    title: `把数组 [${values.join(', ')}] 原样放入堆`,
    description: `建堆不排序，只要求每个父节点不小于（或不大于）孩子。先原样拷贝。`,
    codeLine: 78,
    memory: mem.snapshot(),
    highlight: values.map((_, i) => `h${i}`),
    mutate: (s) => {
      values.forEach((v, i) => {
        const id = `h${i}`;
        s.nodes[id] = { id, value: v, left: null, right: null };
        s.order.push(id);
      });
      makeNodeMap(s.order, s.nodes);
      s.seq = values.length + 1;
    },
  });

  const n = values.length;
  const firstNonLeaf = Math.floor(n / 2) - 1;
  rec.record({
    type: 'info',
    title: `从最后一个非叶节点 i = ${firstNonLeaf} 开始，倒着下滤到根`,
    description: `叶节点天然满足堆性质（没有孩子），只需要处理下标 0..${Math.max(firstNonLeaf, 0)}。这就是 Floyd 建堆 O(n) 的关键。`,
    beginnerNote: `n/2-1 是最后一个非叶节点：它是最后一个节点的父亲。倒序处理保证每个节点下滤时，它的子树已经是堆。`,
    codeLine: 83,
    memory: mem.snapshot(),
  });

  for (let i = firstNonLeaf; i >= 0; i--) {
    rec.record({
      type: 'move',
      title: `siftDown(h, ${i}, ${n})：处理下标 ${i}`,
      description: `对每个非叶节点执行下滤。`,
      codeLine: 84,
      memory: mem.snapshot(),
      highlight: [rec.state.order[i] ?? ''],
    });
    siftDown(rec, mem, i, n);
  }

  return rec.finish();
}

export type HeapStep = Step<HeapState>;

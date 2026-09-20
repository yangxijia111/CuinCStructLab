/**
 * 实验室定义：每个数据结构的初始状态构造 + 可执行操作（FR-LAB）。
 * 教学代码从 content/C_PROGRAMS 取（与 core 模块一致）。
 */
import type { ArrayState, ListState, QueueState, StackState as StackStateT, Step } from '../core/types';
import { C_PROGRAMS } from '../content';
import {
  emptySeqList,
  seqListDelete,
  seqListDestroy,
  seqListFind,
  seqListFrom,
  seqListInsert,
  seqListSet,
  seqListTraverse,
} from '../core/data-structures/seqlist';
import {
  emptyList,
  listDeleteAt,
  listDeleteValue,
  listDestroy,
  listFind,
  listFrom,
  listInsertAt,
  listPushBack,
  listPushFront,
  listSet,
  listTraverse,
} from '../core/data-structures/linked-list';
import {
  doublyDeleteValue,
  doublyDestroy,
  doublyListFrom,
  doublyPushBack,
  doublyPushFront,
  doublyTraverseBackward,
  doublyTraverseForward,
} from '../core/data-structures/doubly-list';
import {
  arrayStackFrom,
  arrayStackPeek,
  arrayStackPop,
  arrayStackPush,
  bracketMatchDemo,
  STACK_CAPACITY,
} from '../core/data-structures/stack';
import {
  circularQueueFrom,
  cqDequeue,
  cqEnqueue,
  emptyCircularQueue,
  lqDequeue,
  lqEnqueue,
  linkedQueueFrom,
  naiveOverflowDemo,
} from '../core/data-structures/queue';
import { StepRecorder, intVar, ptrVar } from '../core/recorder';

export interface ParamDef {
  key: string;
  label: string;
  kind: 'number' | 'text';
  placeholder?: string;
  default?: string;
}

export interface LabOpResult<S> {
  steps: Step<S>[];
  state: S;
  ok: boolean;
}

export interface LabOpDef<S> {
  id: string;
  name: string;
  desc: string;
  params: ParamDef[];
  codeId: string;
  run(state: S | null, params: Record<string, string>): LabOpResult<S>;
}

export interface LabDef<S> {
  id: string;
  name: string;
  desc: string;
  initPlaceholder: string;
  parseInit(text: string): S;
  buildInitSteps?(text: string): Step<S>[];
  ops: LabOpDef<S>[];
}

/** 解析 "10 20 30" 为数字数组 */
export function parseNumbers(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .filter((t) => t.length > 0)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

function finalOf<S>(outcome: { steps: Step<S>[] }, fallback: S): S {
  const last = outcome.steps[outcome.steps.length - 1];
  return last === undefined ? fallback : last.afterState;
}

function num(params: Record<string, string>, key: string, def = 0): number {
  const v = Number(params[key]);
  return Number.isFinite(v) ? v : def;
}

/** arrayStackFrom 的便捷状态提取 */
function stackStateOf(values: number[]): StackStateT {
  return arrayStackFrom(values).steps[0]!.afterState;
}

/* ============ 顺序表 ============ */

const SEQLIST_LAB: LabDef<ArrayState> = {
  id: 'seqlist',
  name: '顺序表',
  desc: '连续内存 + size/capacity。试试插入中间元素看数据如何搬移。',
  initPlaceholder: '10 20 30',
  parseInit: (text) => finalOf(seqListFrom(parseNumbers(text)), emptySeqList()),
  ops: [
    {
      id: 'seqlist-insert',
      name: '插入 insert(pos, value)',
      desc: '在 pos 处插入，观察从后往前的搬移',
      params: [
        { key: 'pos', label: '位置 pos', kind: 'number', default: '1' },
        { key: 'value', label: '值 value', kind: 'number', default: '15' },
      ],
      codeId: 'seqlist',
      run: (state, p) => {
        const out = seqListInsert(state ?? emptySeqList(), num(p, 'pos'), num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? emptySeqList()), ok: out.ok };
      },
    },
    {
      id: 'seqlist-delete',
      name: '删除 delete(pos)',
      desc: '删除 pos 处元素，观察前移覆盖',
      params: [{ key: 'pos', label: '位置 pos', kind: 'number', default: '0' }],
      codeId: 'seqlist',
      run: (state, p) => {
        const out = seqListDelete(state ?? emptySeqList(), num(p, 'pos'));
        return { steps: out.steps, state: finalOf(out, state ?? emptySeqList()), ok: out.ok };
      },
    },
    {
      id: 'seqlist-find',
      name: '查找 find(value)',
      desc: '从头扫描',
      params: [{ key: 'value', label: '查找值', kind: 'number', default: '20' }],
      codeId: 'seqlist',
      run: (state, p) => {
        const out = seqListFind(state ?? emptySeqList(), num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? emptySeqList()), ok: true };
      },
    },
    {
      id: 'seqlist-set',
      name: '修改 set(pos, value)',
      desc: '随机访问直达',
      params: [
        { key: 'pos', label: '位置', kind: 'number', default: '0' },
        { key: 'value', label: '新值', kind: 'number', default: '99' },
      ],
      codeId: 'seqlist',
      run: (state, p) => {
        const out = seqListSet(state ?? emptySeqList(), num(p, 'pos'), num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? emptySeqList()), ok: out.ok };
      },
    },
    {
      id: 'seqlist-traverse',
      name: '遍历 traverse',
      desc: '依次访问',
      params: [],
      codeId: 'seqlist',
      run: (state) => {
        const out = seqListTraverse(state ?? emptySeqList());
        return { steps: out.steps, state: finalOf(out, state ?? emptySeqList()), ok: true };
      },
    },
    {
      id: 'seqlist-grow',
      name: '满容量插入（触发扩容）',
      desc: '容量装满再插入，看搬家三部曲',
      params: [{ key: 'value', label: '插入值', kind: 'number', default: '7' }],
      codeId: 'seqlist',
      run: (state, p) => {
        const s = state ?? emptySeqList();
        // 先填满
        let filled = s;
        while (filled.size < filled.capacity) {
          filled = finalOf(seqListInsert(filled, filled.size, 1), filled);
        }
        const out = seqListInsert(filled, filled.size, num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, filled), ok: out.ok };
      },
    },
    {
      id: 'seqlist-destroy',
      name: '销毁 destroy',
      desc: 'free 数组',
      params: [],
      codeId: 'seqlist',
      run: (state) => {
        const out = seqListDestroy(state ?? emptySeqList());
        return { steps: out.steps, state: finalOf(out, state ?? emptySeqList()), ok: true };
      },
    },
  ],
};

/* ============ 单链表 ============ */

const LIST_LAB: LabDef<ListState> = {
  id: 'list',
  name: '单链表',
  desc: '带头节点。重点观察插入的两步接线与删除的绕过。',
  initPlaceholder: '10 20 30',
  parseInit: (text) => finalOf(listFrom(parseNumbers(text)), emptyList()),
  ops: [
    {
      id: 'list-push-front',
      name: '头插 pushFront(value)',
      desc: '新节点成为第一个数据节点',
      params: [{ key: 'value', label: '值', kind: 'number', default: '5' }],
      codeId: 'linked-list',
      run: (state, p) => {
        const out = listPushFront(state ?? emptyList(), num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? emptyList()), ok: out.ok };
      },
    },
    {
      id: 'list-push-back',
      name: '尾插 pushBack(value)',
      desc: '先走 current 到尾巴再接上',
      params: [{ key: 'value', label: '值', kind: 'number', default: '40' }],
      codeId: 'linked-list',
      run: (state, p) => {
        const out = listPushBack(state ?? emptyList(), num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? emptyList()), ok: out.ok };
      },
    },
    {
      id: 'list-insert',
      name: '指定位置插入 insertAt(pos, value)',
      desc: '10 20 30 在 pos=1 插 15 → 10 15 20 30',
      params: [
        { key: 'pos', label: '位置（0 起）', kind: 'number', default: '1' },
        { key: 'value', label: '值', kind: 'number', default: '15' },
      ],
      codeId: 'linked-list',
      run: (state, p) => {
        const out = listInsertAt(state ?? emptyList(), num(p, 'pos'), num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? emptyList()), ok: out.ok };
      },
    },
    {
      id: 'list-delete',
      name: '按值删除 deleteValue(value)',
      desc: 'prev 绕过 target + free',
      params: [{ key: 'value', label: '要删的值', kind: 'number', default: '20' }],
      codeId: 'linked-list',
      run: (state, p) => {
        const out = listDeleteValue(state ?? emptyList(), num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? emptyList()), ok: out.ok };
      },
    },
    {
      id: 'list-delete-at',
      name: '按下标删除 deleteAt(pos)',
      desc: '',
      params: [{ key: 'pos', label: '下标', kind: 'number', default: '0' }],
      codeId: 'linked-list',
      run: (state, p) => {
        const out = listDeleteAt(state ?? emptyList(), num(p, 'pos'));
        return { steps: out.steps, state: finalOf(out, state ?? emptyList()), ok: out.ok };
      },
    },
    {
      id: 'list-find',
      name: '查找 find(value)',
      desc: 'current 一步步走',
      params: [{ key: 'value', label: '值', kind: 'number', default: '30' }],
      codeId: 'linked-list',
      run: (state, p) => {
        const out = listFind(state ?? emptyList(), num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? emptyList()), ok: true };
      },
    },
    {
      id: 'list-set',
      name: '修改 set(from, to)',
      desc: '',
      params: [
        { key: 'from', label: '原值', kind: 'number', default: '20' },
        { key: 'to', label: '新值', kind: 'number', default: '99' },
      ],
      codeId: 'linked-list',
      run: (state, p) => {
        const out = listSet(state ?? emptyList(), num(p, 'from'), num(p, 'to'));
        return { steps: out.steps, state: finalOf(out, state ?? emptyList()), ok: out.ok };
      },
    },
    {
      id: 'list-traverse',
      name: '遍历 traverse',
      desc: 'current = current->next 逐格移动',
      params: [],
      codeId: 'linked-list',
      run: (state) => {
        const out = listTraverse(state ?? emptyList());
        return { steps: out.steps, state: finalOf(out, state ?? emptyList()), ok: true };
      },
    },
    {
      id: 'list-destroy',
      name: '销毁 destroy',
      desc: '先存 next 再 free',
      params: [],
      codeId: 'linked-list',
      run: (state) => {
        const out = listDestroy(state ?? emptyList());
        return { steps: out.steps, state: finalOf(out, state ?? emptyList()), ok: true };
      },
    },
  ],
};

/* ============ 双向链表 ============ */

const DOUBLY_LAB: LabDef<ListState> = {
  id: 'doubly',
  name: '双向链表',
  desc: 'prev/next 双指针：四步插入、两步绕过删除。',
  initPlaceholder: '10 20 30',
  parseInit: (text) => finalOf(doublyListFrom(parseNumbers(text)), finalOf(doublyListFrom([]), { ...emptyList(), doubly: true })),
  ops: [
    {
      id: 'doubly-insert',
      name: '头插 pushFront(value)',
      desc: '四步接线',
      params: [{ key: 'value', label: '值', kind: 'number', default: '5' }],
      codeId: 'doubly-list',
      run: (state, p) => {
        const out = doublyPushFront(state ?? { ...emptyList(), doubly: true }, num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? emptyList()), ok: out.ok };
      },
    },
    {
      id: 'doubly-push-back',
      name: '尾插 pushBack(value)',
      desc: '',
      params: [{ key: 'value', label: '值', kind: 'number', default: '40' }],
      codeId: 'doubly-list',
      run: (state, p) => {
        const out = doublyPushBack(state ?? { ...emptyList(), doubly: true }, num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? emptyList()), ok: out.ok };
      },
    },
    {
      id: 'doubly-delete',
      name: '按值删除 deleteValue(value)',
      desc: '两步绕过',
      params: [{ key: 'value', label: '要删的值', kind: 'number', default: '20' }],
      codeId: 'doubly-list',
      run: (state, p) => {
        const out = doublyDeleteValue(state ?? { ...emptyList(), doubly: true }, num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? emptyList()), ok: out.ok };
      },
    },
    {
      id: 'doubly-traverse',
      name: '正向遍历',
      desc: '沿 next',
      params: [],
      codeId: 'doubly-list',
      run: (state) => {
        const out = doublyTraverseForward(state ?? { ...emptyList(), doubly: true });
        return { steps: out.steps, state: finalOf(out, state ?? emptyList()), ok: true };
      },
    },
    {
      id: 'doubly-traverse-back',
      name: '反向遍历',
      desc: '先走尾再沿 prev 回来',
      params: [],
      codeId: 'doubly-list',
      run: (state) => {
        const out = doublyTraverseBackward(state ?? { ...emptyList(), doubly: true });
        return { steps: out.steps, state: finalOf(out, state ?? emptyList()), ok: true };
      },
    },
    {
      id: 'doubly-destroy',
      name: '销毁',
      desc: '',
      params: [],
      codeId: 'doubly-list',
      run: (state) => {
        const out = doublyDestroy(state ?? { ...emptyList(), doubly: true });
        return { steps: out.steps, state: finalOf(out, state ?? emptyList()), ok: true };
      },
    },
  ],
};

/* ============ 栈 ============ */

const STACK_LAB: LabDef<StackStateT> = {
  id: 'stack',
  name: '栈（顺序栈）',
  desc: `后进先出。容量 ${STACK_CAPACITY}。`,
  initPlaceholder: '1 2 3（自底向上）',
  parseInit: (text) => stackStateOf(parseNumbers(text)),
  ops: [
    {
      id: 'stack-push',
      name: '入栈 push(value)',
      desc: '先放元素再移 top',
      params: [{ key: 'value', label: '值', kind: 'number', default: '9' }],
      codeId: 'stack',
      run: (state, p) => {
        const out = arrayStackPush(state ?? stackStateOf([]), num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? stackStateOf([])), ok: out.ok };
      },
    },
    {
      id: 'stack-pop',
      name: '出栈 pop',
      desc: '先移 top 再取元素',
      params: [],
      codeId: 'stack',
      run: (state) => {
        const out = arrayStackPop(state ?? stackStateOf([]));
        return { steps: out.steps, state: finalOf(out, state ?? stackStateOf([])), ok: out.ok };
      },
    },
    {
      id: 'stack-peek',
      name: '看栈顶 peek',
      desc: '不弹出',
      params: [],
      codeId: 'stack',
      run: (state) => {
        const out = arrayStackPeek(state ?? stackStateOf([]));
        return { steps: out.steps, state: finalOf(out, state ?? stackStateOf([])), ok: out.ok };
      },
    },
    {
      id: 'bracket-match',
      name: '括号匹配演示',
      desc: '输入括号串，看栈的消长',
      params: [{ key: 'input', label: '括号串', kind: 'text', default: '{[()]}' }],
      codeId: 'stack',
      run: (state, p) => {
        const input = typeof p.input === 'string' && p.input.trim() !== '' ? p.input : '{[()]}';
        const demo = bracketMatchDemo(input);
        void state;
        return {
          steps: demo.steps,
          state: finalOf({ steps: demo.steps }, stackStateOf([])),
          ok: demo.matched,
        };
      },
    },
  ],
};

/* ============ 队列 ============ */

const QUEUE_LAB: LabDef<QueueState> = {
  id: 'queue',
  name: '循环队列',
  desc: '容量 6 的环（最多装 5 个）。重点看 rear 回绕。',
  initPlaceholder: '1 2 3',
  parseInit: (text) => finalOf(circularQueueFrom(parseNumbers(text)), emptyCircularQueue()),
  ops: [
    {
      id: 'queue-circular',
      name: '入队 enqueue(value)',
      desc: '放 rear 位置，取模后移',
      params: [{ key: 'value', label: '值', kind: 'number', default: '4' }],
      codeId: 'queue',
      run: (state, p) => {
        const out = cqEnqueue(state ?? emptyCircularQueue(), num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? emptyCircularQueue()), ok: out.ok };
      },
    },
    {
      id: 'queue-dequeue',
      name: '出队 dequeue',
      desc: '取 front 位置，取模后移',
      params: [],
      codeId: 'queue',
      run: (state) => {
        const out = cqDequeue(state ?? emptyCircularQueue());
        return { steps: out.steps, state: finalOf(out, state ?? emptyCircularQueue()), ok: out.ok };
      },
    },
    {
      id: 'queue-naive',
      name: '反面教材：朴素队列假溢出',
      desc: '装满→出队 3 个→再入队报"满"',
      params: [],
      codeId: 'queue',
      run: (state) => {
        const demo = naiveOverflowDemo(5);
        void state;
        return {
          steps: demo.steps,
          state: finalOf({ steps: demo.steps }, { kind: 'queue', slots: Array.from({ length: 5 }, () => null), front: 0, rear: 0, capacity: 5, impl: 'array', nextAddr: 0x8000, seq: 0 }),
          ok: false,
        };
      },
    },
  ],
};

const LINKED_QUEUE_LAB: LabDef<ListState> = {
  id: 'linked-queue',
  name: '链队列',
  desc: 'front/rear 双指针，注意两次空队特判。',
  initPlaceholder: '1 2 3',
  parseInit: (text) => finalOf(linkedQueueFrom(parseNumbers(text)), linkedQueueFrom([]).steps[0]!.afterState),
  ops: [
    {
      id: 'queue-linked',
      name: '入队 enqueue(value)',
      desc: '',
      params: [{ key: 'value', label: '值', kind: 'number', default: '4' }],
      codeId: 'queue',
      run: (state, p) => {
        const empty = linkedQueueFrom([]).steps[0]!.afterState;
        const out = lqEnqueue(state ?? empty, num(p, 'value'));
        return { steps: out.steps, state: finalOf(out, state ?? empty), ok: out.ok };
      },
    },
    {
      id: 'linked-dequeue',
      name: '出队 dequeue',
      desc: '',
      params: [],
      codeId: 'queue',
      run: (state) => {
        const empty = linkedQueueFrom([]).steps[0]!.afterState;
        const out = lqDequeue(state ?? empty);
        return { steps: out.steps, state: finalOf(out, state ?? empty), ok: out.ok };
      },
    },
  ],
};

/* ============ Ch0 指针演示（内存面板专用） ============ */

const MEMORY_LAB: LabDef<ArrayState> = {
  id: 'memory',
  name: '指针与内存',
  desc: 'Ch0：int a = 10; int *p = &a; 然后看 *p = 99。',
  initPlaceholder: '10（a 的值）',
  parseInit: (text) => {
    const v = parseNumbers(text)[0] ?? 10;
    return finalOf(memoryPointerDemo(v), { kind: 'array', label: 'a', cells: [{ id: 'a0', value: v, flags: [] }], size: 1, capacity: 1, nextAddr: 0x2100, seq: 1 });
  },
  ops: [
    {
      id: 'memory-pointer',
      name: '&a 与 *p',
      desc: '看 p 的值 = a 的地址',
      params: [{ key: 'value', label: 'a 的值', kind: 'number', default: '10' }],
      codeId: 'ch00-pointer',
      run: (_state, p) => {
        const v = num(p, 'value', 10);
        const out = memoryPointerDemo(v);
        const fs = finalOf(out, { kind: 'array', label: 'a', cells: [{ id: 'a0', value: v, flags: [] }], size: 1, capacity: 1, nextAddr: 0x2100, seq: 1 });
        return { steps: out.steps, state: fs, ok: true };
      },
    },
    {
      id: 'memory-pointer-deref',
      name: '*p = 99 之后',
      desc: '通过指针改写 a',
      params: [{ key: 'value', label: '写入的值', kind: 'number', default: '99' }],
      codeId: 'ch00-pointer',
      run: (_state, p) => {
        const v = num(p, 'value', 99);
        const out = memoryDerefDemo(v);
        const fs = finalOf(out, { kind: 'array', label: 'a', cells: [{ id: 'a0', value: v, flags: [] }], size: 1, capacity: 1, nextAddr: 0x2100, seq: 1 });
        return { steps: out.steps, state: fs, ok: true };
      },
    },
  ],
};

/** Ch0 演示：a 与 p 的地址关系 */
function memoryPointerDemo(value: number): { steps: Step<ArrayState>[] } {
  const base: ArrayState = {
    kind: 'array',
    label: 'a',
    cells: [],
    size: 0,
    capacity: 1,
    nextAddr: 0x2000,
    seq: 1,
  };
  const rec = new StepRecorder(base);
  // 手动构造内存面板步骤
  const memA = { id: 'a', name: 'a', addr: '0x2000', value: String(value), dtype: 'int' };
  const memP = { id: 'var:p', name: 'p', addr: '0x2008', value: 'NULL', dtype: 'int*' };
  rec.record({
    type: 'info',
    title: `int a = ${value};`,
    description: `变量 a 在栈上（模拟地址 0x2000），占 4 字节，值 ${value}。`,
    beginnerNote: '变量 = 内存里的一段空间。地址是这段空间的编号。',
    codeLine: 5,
    memory: { cells: [memA], simulated: true },
    variables: [intVar('a', value)],
    mutate: (s) => {
      s.cells = [{ id: 'a0', value, flags: [] }];
      s.size = 1;
    },
  });
  rec.record({
    type: 'assign',
    title: 'int *p = &a;',
    description: `p 是指针变量（模拟地址 0x2008），它的值是 a 的地址 0x2000。`,
    beginnerNote: '& 是取地址操作。p 自己也占内存（8 字节），它里面存的内容是 a 的地址。',
    codeLine: 6,
    memory: { cells: [memA, { ...memP, value: '0x2000' }], simulated: true },
    variables: [intVar('a', value), ptrVar('p', '0x2000', 'a0')],
    highlight: ['a0'],
  });
  rec.record({
    type: 'info',
    title: 'p ──→ a（箭头即"p 的值是 a 的地址"）',
    description: '顺着 p 里存的地址，就能找到 a。这就是所有链表 next 指针的原理。',
    beginnerNote: '链表节点的 next 就是一个 p：存的不是数据，而是"下一个节点在哪"。',
    codeLine: 10,
    memory: { cells: [memA, { ...memP, value: '0x2000' }], simulated: true },
    variables: [intVar('a', value), ptrVar('p', '0x2000', 'a0')],
    highlight: ['a0'],
  });
  return { steps: rec.finish().steps };
}

/** Ch0 演示：*p 改写 a */
function memoryDerefDemo(newValue: number): { steps: Step<ArrayState>[] } {
  const base: ArrayState = {
    kind: 'array',
    label: 'a',
    cells: [{ id: 'a0', value: 10, flags: [] }],
    size: 1,
    capacity: 1,
    nextAddr: 0x2000,
    seq: 1,
  };
  const rec = new StepRecorder(base);
  const memA = { id: 'a', name: 'a', addr: '0x2000', value: '10', dtype: 'int' };
  rec.record({
    type: 'info',
    title: '当前：a = 10，p 存着 a 的地址',
    description: 'p 的值是 0x2000（模拟），指向 a。',
    codeLine: 6,
    memory: { cells: [memA, { id: 'var:p', name: 'p', addr: '0x2008', value: '0x2000', dtype: 'int*' }], simulated: true },
    variables: [intVar('a', 10), ptrVar('p', '0x2000', 'a0')],
    highlight: ['a0'],
  });
  rec.record({
    type: 'assign',
    title: `*p = ${newValue}（顺着地址改写）`,
    description: `*p 读作"p 指向的东西"。对它赋值 = 直接改写 0x2000 处的内存。`,
    beginnerNote: '链表里 current->next = newNode 就是这种操作：顺地址找到字段并改写。',
    codeLine: 13,
    memory: {
      cells: [
        { ...memA, value: String(newValue) },
        { id: 'var:p', name: 'p', addr: '0x2008', value: '0x2000', dtype: 'int*' },
      ],
      simulated: true,
    },
    variables: [intVar('a', newValue), ptrVar('p', '0x2000', 'a0')],
    highlight: ['a0'],
    mutate: (s) => {
      s.cells[0]!.value = newValue;
      s.cells[0]!.flags = ['writing'];
    },
  });
  rec.record({
    type: 'info',
    title: `printf("a") → ${newValue}：a 被改了`,
    description: '通过指针改写，a 自己"毫不知情"地变了。这就是函数传地址能改外部变量的原因。',
    codeLine: 14,
    memory: {
      cells: [
        { ...memA, value: String(newValue) },
        { id: 'var:p', name: 'p', addr: '0x2008', value: '0x2000', dtype: 'int*' },
      ],
      simulated: true,
    },
    variables: [intVar('a', newValue), ptrVar('p', '0x2000', 'a0')],
    highlight: ['a0'],
    mutate: (s) => {
      s.cells[0]!.flags = [];
    },
  });
  return { steps: rec.finish().steps };
}

/* ============ 汇总 ============ */

/** 线性结构实验室（P5）。P6 追加 tree/bst/heap/graph，P7 追加 sorting。 */
export const LINEAR_LABS = [MEMORY_LAB, SEQLIST_LAB, LIST_LAB, DOUBLY_LAB, STACK_LAB, QUEUE_LAB, LINKED_QUEUE_LAB];

/** 由 vizOp id 找到所属 Lab 与操作（课程页 vizOps 的运行入口） */
export function findOp(opId: string): { lab: LabDef<never>; op: LabOpDef<never> } | null {
  for (const lab of LINEAR_LABS) {
    const op = lab.ops.find((o) => o.id === opId);
    if (op !== undefined) return { lab: lab as unknown as LabDef<never>, op: op as unknown as LabOpDef<never> };
  }
  return null;
}

/** 获取操作的教学代码 */
export function opCode(op: LabOpDef<unknown>): { title: string; lines: Array<{ text: string; note?: string }> } {
  const program = C_PROGRAMS[op.codeId];
  if (program === undefined) return { title: op.name, lines: [] };
  return {
    title: program.title,
    lines: program.lines.map((text, i) => ({ text, note: program.notes?.[i + 1] })),
  };
}

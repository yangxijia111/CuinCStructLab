/**
 * 队列：循环队列（留一空位判满）+ 链队列 + 朴素顺序队列假溢出演示（DATA_STRUCTURE_SPEC §5）。
 * 循环队列约定：front 指向队头元素；rear 指向下一个入队位置；(rear+1)%cap==front 为满。
 */
import { SimMem, StepRecorder, intVar, otherVar, ptrVar } from '../recorder';
import type { ListState, QueueState, Step, VizOutcome } from '../types';

export const QUEUE_CAPACITY = 6;

/** 教学 C 代码（Step.codeLine 指向这里，1-based） */
export const QUEUE_C_CODE: string[] = [
  '/* 队列：先进先出 FIFO */',
  '#include <stdio.h>',
  '#include <stdlib.h>',
  '',
  '#define QUEUE_CAP 6',
  '',
  '/* ---------- 循环队列：留一个空位区分空与满 ---------- */',
  'typedef struct {',
  '    int data[QUEUE_CAP];',
  '    int front;    /* 指向队头元素 */',
  '    int rear;     /* 指向下一个入队位置（空位） */',
  '} CircularQueue;',
  '',
  'void cqInit(CircularQueue *q) {',
  '    q->front = 0;',
  '    q->rear = 0;        /* front == rear 表示空 */',
  '}',
  '',
  'int cqIsEmpty(CircularQueue *q) {',
  '    return q->front == q->rear;',
  '}',
  '',
  '/* 牺牲一个格子：(rear+1)%QUEUE_CAP == front 表示满 */',
  'int cqIsFull(CircularQueue *q) {',
  '    return (q->rear + 1) % QUEUE_CAP == q->front;',
  '}',
  '',
  'int cqEnqueue(CircularQueue *q, int value) {',
  '    if (cqIsFull(q)) {',
  '        return -1;      /* 队满 */',
  '    }',
  '    q->data[q->rear] = value;',
  '    q->rear = (q->rear + 1) % QUEUE_CAP;   /* 回绕的关键：取模 */',
  '    return 0;',
  '}',
  '',
  'int cqDequeue(CircularQueue *q, int *out) {',
  '    if (cqIsEmpty(q)) {',
  '        return -1;      /* 队空 */',
  '    }',
  '    *out = q->data[q->front];',
  '    q->front = (q->front + 1) % QUEUE_CAP; /* 队头同样取模回绕 */',
  '    return 0;',
  '}',
  '',
  '/* ---------- 链队列：front 指向首节点，rear 指向尾节点 ---------- */',
  'typedef struct QNode {',
  '    int data;',
  '    struct QNode *next;',
  '} QNode;',
  '',
  'typedef struct {',
  '    QNode *front;',
  '    QNode *rear;',
  '} LinkedQueue;',
  '',
  'void lqInit(LinkedQueue *q) {',
  '    q->front = NULL;',
  '    q->rear = NULL;',
  '}',
  '',
  'int lqEnqueue(LinkedQueue *q, int value) {',
  '    QNode *node = (QNode *)malloc(sizeof(QNode));',
  '    if (node == NULL) {',
  '        return -1;',
  '    }',
  '    node->data = value;',
  '    node->next = NULL;',
  '    if (q->rear == NULL) {     /* 空队列：front/rear 都指向新节点 */',
  '        q->front = node;',
  '        q->rear = node;',
  '    } else {',
  '        q->rear->next = node;  /* 接到尾部 */',
  '        q->rear = node;        /* rear 后移 */',
  '    }',
  '    return 0;',
  '}',
  '',
  'int lqDequeue(LinkedQueue *q, int *out) {',
  '    if (q->front == NULL) {',
  '        return -1;             /* 空队列 */',
  '    }',
  '    QNode *node = q->front;',
  '    *out = node->data;',
  '    q->front = node->next;',
  '    if (q->front == NULL) {',
  '        q->rear = NULL;        /* 队列空了，rear 也要置空 */',
  '    }',
  '    free(node);',
  '    return 0;',
  '}',
  '',
  '/* ---------- 反面教材：朴素顺序队列的"假溢出" ----------',
  '   rear 只增不减，到数组顶就报满，哪怕前面出队腾出的空间全是空的 */',
  'int nqEnqueue(int *data, int *rear, int value) {',
  '    if (*rear == QUEUE_CAP - 1) {',
  '        return -1;   /* "假满"：front 前面可能还有很多空位！ */',
  '    }',
  '    *rear = *rear + 1;',
  '    data[*rear] = value;',
  '    return 0;',
  '}',
];

/* ============ 循环队列 ============ */

export function emptyCircularQueue(capacity = QUEUE_CAPACITY): QueueState {
  return {
    kind: 'queue',
    slots: Array.from({ length: capacity }, () => null),
    front: 0,
    rear: 0,
    capacity,
    impl: 'circular',
    nextAddr: 0x8000,
    seq: 0,
  };
}

/** 当前队列元素（从 front 到 rear 的环上取值） */
export function cqValues(state: QueueState): number[] {
  const out: number[] = [];
  let i = state.front;
  while (i !== state.rear) {
    const slot = state.slots[i];
    if (slot !== null) out.push(slot.value);
    i = (i + 1) % state.capacity;
  }
  return out;
}

/** 内部：用给定数据构建循环队列状态（不做步骤；供 Playground/测试） */
export function circularQueueFrom(values: number[], capacity = QUEUE_CAPACITY): VizOutcome<QueueState> {
  const rec = new StepRecorder<QueueState>(emptyCircularQueue(capacity));
  const mem = queueMem(rec.state);
  mem.defineVar('q->front', '0', 'int');
  mem.defineVar('q->rear', String(values.length % capacity), 'int');
  rec.record({
    type: 'create',
    title: `创建循环队列（容量 ${capacity}，实际最多装 ${capacity - 1} 个），元素 [${values.join(', ')}]`,
    description: `front = 0，rear = ${values.length % capacity}。注意容量 ${capacity} 的循环队列只能装 ${capacity - 1} 个元素——留一个空位区分"空"和"满"。`,
    beginnerNote:
      '如果不留空位，front == rear 既可能表示空也可能表示满，无法区分。牺牲一个格子后：front == rear 是空，(rear+1)%cap == front 是满。',
    codeLine: 16,
    variables: [intVar('q->front', 0), intVar('q->rear', values.length % capacity)],
    memory: mem.snapshot(),
    highlight: values.map((_, i) => `q${i}`),
    mutate: (s) => {
      values.forEach((v, i) => {
        s.slots[i] = { id: `q${i}`, value: v };
      });
      s.rear = values.length % capacity;
    },
  });
  return rec.finish();
}

function queueMem(state: QueueState): SimMem {
  const mem = new SimMem(state.nextAddr);
  mem.allocObject('arr', `int[${state.capacity}]`, `循环数组`, 'int[]');
  mem.defineVar('q->front', String(state.front), 'int');
  mem.defineVar('q->rear', String(state.rear), 'int');
  return mem;
}

export function cqEnqueue(state: QueueState, value: number): VizOutcome<QueueState> {
  const rec = new StepRecorder<QueueState>(state);
  const mem = queueMem(state);

  if ((state.rear + 1) % state.capacity === state.front) {
    rec.record({
      type: 'error',
      title: '队满：(rear+1) % QUEUE_CAP == front',
      description: `rear = ${state.rear}，(rear+1) % ${state.capacity} = ${(state.rear + 1) % state.capacity} == front = ${state.front}，牺牲的空位到了，队列已满。`,
      codeLine: 29,
      variables: [intVar('q->front', state.front), intVar('q->rear', state.rear)],
      memory: mem.snapshot(),
    });
    return rec.finish();
  }

  const slot = state.rear;
  rec.record({
    type: 'insert',
    title: `q->data[q->rear] = ${value}（放进 rear 指的空位，下标 ${slot}）`,
    description: `${value} 从队尾进入。`,
    codeLine: 32,
    variables: [intVar('q->rear', slot), intVar('value', value)],
    memory: mem.snapshot(),
    highlight: [`q${slot}`],
    mutate: (s) => {
      s.slots[slot] = { id: `q${s.seq}`, value };
      s.seq += 1;
    },
  });

  const newRear = (state.rear + 1) % state.capacity;
  const wrapped = newRear < state.rear;
  rec.record({
    type: wrapped ? 'wraparound' : 'assign',
    title: wrapped
      ? `q->rear = (rear+1) % QUEUE_CAP：${state.rear} → 0（回绕！）`
      : `q->rear = (rear+1) % QUEUE_CAP = ${newRear}`,
    description: wrapped
      ? `rear 从 ${state.rear} 加 1 后是 ${state.capacity}，对 ${state.capacity} 取模回到 0——数组被"卷成环"，新元素从头部继续入队。`
      : `rear 后移一格，指向下一个空位。当前队列：[${cqValues(rec.state).join(', ')}]。`,
    beginnerNote: wrapped
      ? '% 是取模（余数）：8 % 6 = 2，6 % 6 = 0。加 1 后越界就除以容量取余，下标永远落在 0..cap-1 之间，逻辑上形成一个环。'
      : '这一步 O(1)。循环队列 enqueue/dequeue 都是 O(1)。',
    codeLine: 33,
    variables: [intVar('q->front', state.front), intVar('q->rear', newRear)],
    memory: mem.snapshot(),
    highlight: wrapped ? [`q0`] : [`q${newRear}`],
    mutate: (s) => {
      s.rear = newRear;
    },
  });

  return rec.finish();
}

export function cqDequeue(state: QueueState): VizOutcome<QueueState> {
  const rec = new StepRecorder<QueueState>(state);
  const mem = queueMem(state);

  if (state.front === state.rear) {
    rec.record({
      type: 'error',
      title: '队空：front == rear',
      description: `front = rear = ${state.front}，队列里没有元素。`,
      codeLine: 38,
      variables: [intVar('q->front', state.front), intVar('q->rear', state.rear)],
      memory: mem.snapshot(),
    });
    return rec.finish();
  }

  const slot = state.front;
  const value = state.slots[slot]?.value ?? 0;
  rec.record({
    type: 'delete',
    title: `*out = q->data[q->front]，出队 ${value}（下标 ${slot}）`,
    description: `队头 ${value} 离开队列。`,
    codeLine: 41,
    variables: [otherVar('*out', String(value)), intVar('q->front', slot)],
    memory: mem.snapshot(),
    highlight: [`q${slot}`],
    mutate: (s) => {
      s.slots[slot] = null;
    },
  });

  const newFront = (state.front + 1) % state.capacity;
  const wrapped = newFront < state.front;
  rec.record({
    type: wrapped ? 'wraparound' : 'assign',
    title: wrapped
      ? `q->front = (front+1) % QUEUE_CAP：${state.front} → 0（回绕！）`
      : `q->front = (front+1) % QUEUE_CAP = ${newFront}`,
    description: wrapped
      ? `front 到达数组末尾后取模回到 0。剩余队列：[${cqValues(rec.state).join(', ')}]。`
      : `front 后移。剩余队列：[${cqValues(rec.state).join(', ')}]。`,
    codeLine: 42,
    variables: [intVar('q->front', newFront), intVar('q->rear', state.rear)],
    memory: mem.snapshot(),
    mutate: (s) => {
      s.front = newFront;
    },
  });

  return rec.finish();
}

/* ============ 链队列（复用 ListState） ============ */

export function emptyLinkedQueue(): ListState {
  return {
    kind: 'list',
    nodes: [],
    sentinel: false,
    doubly: false,
    pointers: [
      { name: 'front', target: null },
      { name: 'rear', target: null },
    ],
    nextAddr: 0x8000,
    seq: 1,
  };
}

export function linkedQueueFrom(values: number[]): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(emptyLinkedQueue());
  const mem = new SimMem(0x8000);
  for (const v of values) {
    const id = `n${rec.state.seq}`;
    mem.allocObject(id, `QNode(${v})`, `data=${v}`, 'QNode');
    rec.state.seq += 1;
    rec.state.nodes.push({ id, value: v });
  }
  const first = rec.state.nodes[0]?.id ?? null;
  const last = rec.state.nodes[rec.state.nodes.length - 1]?.id ?? null;
  mem.defineVar('q->front', first === null ? null : mem.addrOf(first), 'QNode*');
  mem.defineVar('q->rear', last === null ? null : mem.addrOf(last), 'QNode*');
  rec.record({
    type: 'create',
    title: `创建链队列 front → ${values.join(' → ')} → NULL ← rear`,
    description: 'front 指向队头（出队端），rear 指向队尾（入队端）。',
    codeLine: 52,
    variables: [ptrVar('q->front', first === null ? null : mem.addrOf(first), first), ptrVar('q->rear', last === null ? null : mem.addrOf(last), last)],
    memory: mem.snapshot(),
    highlight: rec.state.nodes.map((n) => n.id),
    mutate: (s) => {
      s.nextAddr = mem.heapTop;
    },
  });
  return rec.finish();
}

export function lqEnqueue(state: ListState, value: number): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = lqMem(state);
  const id = `n${rec.state.seq}`;
  const addr = mem.allocObject(id, `QNode(${value})`, `data=${value}, next=NULL`, 'QNode');
  const rearId = state.nodes[state.nodes.length - 1]?.id ?? null;
  const isEmpty = state.nodes.length === 0;

  rec.record({
    type: 'create',
    title: `node = malloc(sizeof(QNode))，data = ${value}（${addr}）`,
    description: '新节点 next 置 NULL——它将成为新的队尾。',
    codeLine: 60,
    variables: [ptrVar('node', addr, id), intVar('node->data', value)],
    memory: mem.snapshot(),
    highlight: [id],
    mutate: (s) => {
      s.seq += 1;
      s.nodes.push({ id, value, floating: true });
      s.nextAddr = mem.heapTop;
    },
  });

  if (isEmpty) {
    rec.record({
      type: 'insert',
      title: '队列为空：q->front = node; q->rear = node;（两个指针都指向唯一节点）',
      description: '空队列插入时 front 和 rear 要同时更新，这是最容易漏写的分支。',
      beginnerNote: '只更新 rear 的话 front 还是 NULL，出队时直接崩溃。链队列的空队特判必须背下来。',
      codeLine: 68,
      variables: [ptrVar('q->front', addr, id), ptrVar('q->rear', addr, id)],
      memory: mem.snapshot(),
      highlight: [id],
      mutate: (s) => {
        const node = s.nodes.find((n) => n.id === id);
        if (node !== undefined) delete node.floating;
        s.pointers = [
          { name: 'front', target: id },
          { name: 'rear', target: id },
        ];
      },
    });
  } else {
    rec.record({
      type: 'assign',
      title: `q->rear->next = node;（原队尾${rearId === null ? '' : `（值 ${state.nodes[state.nodes.length - 1]?.value}）`}接上新节点）`,
      description: '新节点挂到队尾后面。',
      codeLine: 71,
      variables: [ptrVar('q->rear', mem.addrOf(rearId ?? ''), rearId), ptrVar('node', addr, id)],
      memory: mem.snapshot(),
      highlight: [rearId ?? '', id].filter(Boolean),
      mutate: (s) => {
        const node = s.nodes.find((n) => n.id === id);
        if (node !== undefined) delete node.floating;
      },
    });
    rec.record({
      type: 'insert',
      title: 'q->rear = node;（rear 指向新队尾）',
      description: `${value} 入队完成。当前队列：[${state.nodes.map((n) => n.value).join(', ')}, ${value}]。`,
      codeLine: 72,
      variables: [ptrVar('q->rear', addr, id)],
      memory: mem.snapshot(),
      highlight: [id],
      mutate: (s) => {
        s.pointers = [{ name: 'front', target: s.nodes[0]?.id ?? null }, { name: 'rear', target: id }];
      },
    });
  }

  return rec.finish();
}

export function lqDequeue(state: ListState): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = lqMem(state);

  if (state.nodes.length === 0) {
    rec.fail('队空', 'q->front == NULL，队列里没有元素。', 78);
    return rec.finish();
  }

  const frontId = state.nodes[0]!.id;
  const value = state.nodes[0]!.value ?? 0;
  const nextId = state.nodes[1]?.id ?? null;

  rec.record({
    type: 'delete',
    title: `*out = node->data，出队 ${value}`,
    description: `队头节点（值 ${value}）的数据先取出。`,
    codeLine: 82,
    variables: [otherVar('*out', String(value)), ptrVar('q->front', mem.addrOf(frontId), frontId)],
    memory: mem.snapshot(),
    highlight: [frontId],
  });

  const becomesEmpty = state.nodes.length === 1;
  rec.record({
    type: 'assign',
    title: becomesEmpty
      ? 'q->front = node->next（NULL）；队列将空，还要 q->rear = NULL'
      : `q->front = node->next（指向值 ${state.nodes[1]?.value} 的节点）`,
    description: becomesEmpty
      ? '最后一个节点出队后 front 变 NULL，此时 rear 如果还指着旧节点就成了悬垂指针，必须一起置空。'
      : 'front 后移到下一个节点。',
    beginnerNote: becomesEmpty
      ? '这是链队列第二个必背特判：队列从 1 个元素变 0 个时，rear 也必须置 NULL，否则下次入队会解引用已释放的 rear。' : undefined,
    codeLine: becomesEmpty ? 85 : 83,
    variables: [ptrVar('q->front', nextId === null ? null : mem.addrOf(nextId), nextId)],
    memory: mem.snapshot(),
    highlight: [nextId ?? frontId],
    mutate: (s) => {
      s.pointers = [
        { name: 'front', target: nextId },
        { name: 'rear', target: becomesEmpty ? null : s.nodes[s.nodes.length - 1]?.id ?? null },
      ];
    },
  });

  mem.freeObject(frontId);
  rec.record({
    type: 'free',
    title: `free(node)（释放值 ${value} 的节点）`,
    description: '出队节点必须释放。',
    codeLine: 87,
    memory: mem.snapshot(),
    highlight: [frontId],
    mutate: (s) => {
      s.nodes = s.nodes.filter((n) => n.id !== frontId);
      s.nextAddr = mem.heapTop;
    },
  });

  return rec.finish();
}

function lqMem(state: ListState): SimMem {
  const mem = new SimMem(state.nextAddr);
  for (const n of state.nodes) {
    if (n.freed) continue;
    mem.allocObject(n.id, `QNode(${n.value})`, `data=${n.value}`, 'QNode');
  }
  mem.defineVar('q->front', state.nodes[0] !== undefined ? mem.addrOf(state.nodes[0].id) : null, 'QNode*');
  const last = state.nodes[state.nodes.length - 1];
  mem.defineVar('q->rear', last === undefined ? null : mem.addrOf(last.id), 'QNode*');
  return mem;
}

/* ============ 假溢出演示（朴素顺序队列） ============ */

/**
 * 演示朴素顺序队列的假溢出：装满 → 出队 3 个 → 再入队报"满"，
 * 尽管数组前面有 3 个空位。用于对比引出循环队列。
 */
export function naiveOverflowDemo(capacity = 5): { steps: Step<QueueState>[]; failedAt: string } {
  const rec = new StepRecorder<QueueState>({
    kind: 'queue',
    slots: Array.from({ length: capacity }, () => null),
    front: 0,
    rear: -1,
    capacity,
    impl: 'array',
    nextAddr: 0x8000,
    seq: 0,
  });
  const mem = queueMem(rec.state);

  const push = (v: number) => {
    const r = rec.state.rear;
    if (r === capacity - 1) {
      rec.record({
        type: 'error',
        title: `入队 ${v} 失败：rear == QUEUE_CAP-1，报"满"（假溢出！）`,
        description: `但看画面：front = ${rec.state.front}，前面明明有 ${rec.state.front} 个空位！这就是"假溢出"——空间没用完却不能再用。解决：循环队列。`,
        beginnerNote: '朴素顺序队列 rear 只会一路上涨，前面的空位永远浪费。循环队列用取模让 rear 能"回头"。',
        codeLine: 98,
        variables: [intVar('*rear', r), intVar('front', rec.state.front)],
        memory: mem.snapshot(),
      });
      return false;
    }
    const nr = r + 1;
    rec.record({
      type: 'insert',
      title: `data[++rear] = ${v}（rear：${r} → ${nr}）`,
      description: '朴素顺序队列：rear 只增不减。',
      codeLine: 102,
      variables: [intVar('*rear', nr)],
      memory: mem.snapshot(),
      highlight: [`q${nr}`],
      mutate: (s) => {
        s.rear = nr;
        s.slots[nr] = { id: `q${s.seq}`, value: v };
        s.seq += 1;
      },
    });
    return true;
  };

  const pop = () => {
    const f = rec.state.front;
    const v = rec.state.slots[f]?.value ?? 0;
    rec.record({
      type: 'delete',
      title: `出队 ${v}（front：${f} → ${f + 1}），下标 ${f} 的格子空出来了`,
      description: '出队只动 front。空出来的格子在朴素实现里永远不会被复用。',
      codeLine: 96,
      variables: [intVar('front', f + 1)],
      memory: mem.snapshot(),
      highlight: [`q${f}`],
      mutate: (s) => {
        s.front += 1;
        s.slots[f] = null;
      },
    });
  };

  push(10);
  push(20);
  push(30);
  push(40);
  push(50); // rear 到达 capacity-1：数组"顶"
  pop();
  pop();
  pop(); // front 前进，空出 3 格
  const ok = push(99); // rear 已在 capacity-1，报"满"——假溢出！

  return {
    steps: rec.finish().steps,
    failedAt: ok ? '' : 'front 前有 3 个空位，却报队列已满',
  };
}

export type QueueStep = Step<QueueState>;

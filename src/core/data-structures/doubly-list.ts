/**
 * 双向链表（带头节点）：模型 + 教学步骤生成（DATA_STRUCTURE_SPEC §3）。
 * 教学重点：prev/next 双指针的四步插入与两步绕过删除。
 * 复用 ListState（doubly = true）。
 */
import { SimMem, StepRecorder, intVar, ptrVar } from '../recorder';
import type { ListState, ListNodeV, Step, VizOutcome } from '../types';

/** 教学 C 代码（Step.codeLine 指向这里，1-based） */
export const DOUBLY_LIST_C_CODE: string[] = [
  '/* 双向链表（带头节点）*/',
  '#include <stdio.h>',
  '#include <stdlib.h>',
  '',
  'typedef struct DNode {',
  '    int data;             /* 数据域 */',
  '    struct DNode *prev;   /* 前驱指针：指向上一个节点 */',
  '    struct DNode *next;   /* 后继指针：指向下一个节点 */',
  '} DNode;',
  '',
  'DNode *head;    /* 头指针：指向头节点 */',
  '',
  '/* 初始化：头节点的 prev/next 都置 NULL */',
  'int listInit(void) {',
  '    head = (DNode *)malloc(sizeof(DNode));',
  '    if (head == NULL) {',
  '        return -1;',
  '    }',
  '    head->prev = NULL;',
  '    head->next = NULL;',
  '    return 0;',
  '}',
  '',
  '/* 头插：新节点成为第一个数据节点（注意四步顺序） */',
  'int listPushFront(int value) {',
  '    DNode *newNode = (DNode *)malloc(sizeof(DNode));',
  '    if (newNode == NULL) {',
  '        return -1;',
  '    }',
  '    newNode->data = value;',
  '    newNode->prev = head;            /* ① 新节点前驱 = 头节点 */',
  '    newNode->next = head->next;      /* ② 新节点后继 = 原首节点 */',
  '    if (head->next != NULL) {',
  '        head->next->prev = newNode;  /* ③ 原首节点前驱 = 新节点 */',
  '    }',
  '    head->next = newNode;            /* ④ 头节点后继 = 新节点 */',
  '    return 0;',
  '}',
  '',
  '/* 尾插：先走到尾巴，再两步接上 */',
  'int listPushBack(int value) {',
  '    DNode *tail = head;',
  '    while (tail->next != NULL) {',
  '        tail = tail->next;',
  '    }',
  '    DNode *newNode = (DNode *)malloc(sizeof(DNode));',
  '    if (newNode == NULL) {',
  '        return -1;',
  '    }',
  '    newNode->data = value;',
  '    newNode->next = NULL;      /* 新节点是最后一个 */',
  '    newNode->prev = tail;      /* ① 新节点前驱 = 原尾节点 */',
  '    tail->next = newNode;      /* ② 原尾节点后继 = 新节点 */',
  '    return 0;',
  '}',
  '',
  '/* 删除第一个值为 value 的节点：前驱、后继互相绕过 */',
  'int listDeleteValue(int value) {',
  '    DNode *target = head->next;',
  '    while (target != NULL && target->data != value) {',
  '        target = target->next;',
  '    }',
  '    if (target == NULL) {',
  '        return -1;                      /* 没找到 */',
  '    }',
  '    if (target->prev != NULL) {',
  '        target->prev->next = target->next;   /* ① 前驱绕过 */',
  '    }',
  '    if (target->next != NULL) {',
  '        target->next->prev = target->prev;   /* ② 后继绕过 */',
  '    }',
  '    free(target);',
  '    return 0;',
  '}',
  '',
  '/* 正向遍历 */',
  'void traverseForward(void) {',
  '    DNode *current = head->next;',
  '    while (current != NULL) {',
  '        printf("%d <-> ", current->data);',
  '        current = current->next;',
  '    }',
  '    printf("NULL\\n");',
  '}',
  '',
  '/* 反向遍历：先走到尾巴，再一路走 prev */',
  'void traverseBackward(void) {',
  '    DNode *current = head;',
  '    while (current->next != NULL) {',
  '        current = current->next;    /* 先走到最后一个 */',
  '    }',
  '    while (current != head) {       /* 走回头节点为止 */',
  '        printf("%d <-> ", current->data);',
  '        current = current->prev;',
  '    }',
  '    printf("(head)\\n");',
  '}',
  '',
  '/* 销毁：与单向链表相同，先存 next 再 free */',
  'void listDestroy(void) {',
  '    DNode *current = head;',
  '    while (current != NULL) {',
  '        DNode *next = current->next;',
  '        free(current);',
  '        current = next;',
  '    }',
  '    head = NULL;',
  '}',
];

/* ============ 状态构造与读取 ============ */

export function emptyDoublyList(): ListState {
  return {
    kind: 'list',
    nodes: [{ id: 'n0', value: null }],
    sentinel: true,
    doubly: true,
    pointers: [{ name: 'head', target: 'n0' }],
    nextAddr: 0x8000,
    seq: 1,
  };
}

export function doublyListFrom(values: number[]): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(emptyDoublyList());
  const mem = new SimMem(0x8000);
  mem.allocObject('n0', '头节点', 'prev=NULL, next=NULL', 'DNode');
  mem.defineVar('head', mem.addrOf('n0'), 'DNode*');
  for (const v of values) {
    const id = `n${rec.state.seq}`;
    rec.state.seq += 1;
    mem.allocObject(id, `DNode(${v})`, `data=${v}`, 'DNode');
    rec.state.nodes.push({ id, value: v });
  }
  updateDoublyMemNext(mem, rec.state);
  rec.record({
    type: 'create',
    title: `创建双向链表 head <-> ${values.join(' <-> ')} <-> NULL`,
    description: `每个节点有 prev/next 两个指针，相邻节点互相指向。共 ${values.length} 个数据节点。`,
    beginnerNote: '双向链表每个节点多花一个指针的内存，换来"可以往回走"：找前驱 O(1)，单向链表要重新从头找。',
    codeLine: 16,
    variables: [ptrVar('head', mem.addrOf('n0'), 'n0')],
    memory: mem.snapshot(),
    highlight: rec.state.nodes.map((n) => n.id),
    mutate: (s) => {
      s.nextAddr = mem.heapTop;
    },
  });
  return rec.finish();
}

export function doublyListValues(state: ListState): number[] {
  return state.nodes.filter((n) => n.value !== null && !n.floating && !n.freed).map((n) => n.value as number);
}

function chainOf(state: ListState): ListNodeV[] {
  return state.nodes.filter((n) => !n.floating && !n.freed);
}

function nextOf(state: ListState, id: string): string | null {
  const chain = chainOf(state);
  const i = chain.findIndex((n) => n.id === id);
  return i >= 0 && i < chain.length - 1 ? (chain[i + 1]!.id ?? null) : null;
}

function prevOf(state: ListState, id: string): string | null {
  const chain = chainOf(state);
  const i = chain.findIndex((n) => n.id === id);
  return i > 0 ? (chain[i - 1]!.id ?? null) : null;
}

function nodeValue(state: ListState, id: string): number | string {
  return state.nodes.find((n) => n.id === id)?.value ?? '?';
}

function rebuildDoublyMem(state: ListState, extra: Array<{ name: string; target: string | null }> = []): SimMem {
  const mem = new SimMem(state.nextAddr);
  for (const n of state.nodes) {
    if (n.freed) continue;
    mem.allocObject(n.id, n.value === null ? '头节点' : `DNode(${n.value})`, '', 'DNode');
  }
  updateDoublyMemNext(mem, state);
  mem.defineVar('head', mem.addrOf('n0'), 'DNode*');
  for (const p of extra) mem.defineVar(p.name, p.target === null ? null : mem.addrOf(p.target), 'DNode*');
  return mem;
}

function updateDoublyMemNext(mem: SimMem, state: ListState): void {
  const chain = chainOf(state);
  for (const [i, n] of chain.entries()) {
    const prev = i > 0 ? (mem.addrOf(chain[i - 1]!.id) ?? 'NULL') : 'NULL';
    const next = i < chain.length - 1 ? (mem.addrOf(chain[i + 1]!.id) ?? 'NULL') : 'NULL';
    const data = n.value === null ? '-' : String(n.value);
    mem.setObjectValue(n.id, `data=${data}, prev=${prev}, next=${next}`);
  }
}

/* ============ 操作 ============ */

/** 内部：分配新节点（floating） */
function allocDNode(rec: StepRecorder<ListState>, mem: SimMem, value: number, codeLine: number): string {
  const id = `n${rec.state.seq}`;
  const addr = mem.allocObject(id, `DNode(${value})`, `data=${value}, prev=?, next=?`, 'DNode');
  mem.defineVar('newNode', addr, 'DNode*');
  rec.record({
    type: 'create',
    title: `newNode = malloc(sizeof(DNode))（${addr}，模拟地址）`,
    description: `申请一个双向节点，data = ${value}，prev/next 待接线。`,
    codeLine,
    variables: [ptrVar('newNode', addr, id), intVar('newNode->data', value)],
    memory: mem.snapshot(),
    highlight: [id],
    mutate: (s) => {
      s.seq += 1;
      s.nodes.push({ id, value, floating: true });
      s.nextAddr = mem.heapTop;
    },
  });
  return id;
}

/** 内部：四步接线（在 nodeId 之后插入 newNode） */
function linkDoublyAfter(
  rec: StepRecorder<ListState>,
  mem: SimMem,
  nodeId: string,
  newNodeId: string,
  lines: { p1: number; p2: number; p3: number; p4: number },
  nodeName = 'head',
): void {
  const st = rec.state;
  const oldNext = nextOf(st, nodeId);

  const steps: Array<{ line: number; code: string; desc: string }> = [
    {
      line: lines.p1,
      code: `newNode->prev = ${nodeName};`,
      desc: `新节点的前驱指向${nodeName === 'head' ? '头节点' : `值 ${nodeValue(st, nodeId)} 的节点`}。`,
    },
    {
      line: lines.p2,
      code:
        oldNext === null
          ? `newNode->next = ${nodeName}->next;（NULL）`
          : `newNode->next = ${nodeName}->next;（值 ${nodeValue(st, oldNext)} 的节点）`,
      desc: '新节点的后继先抓住原来的下一个节点。',
    },
  ];
  if (oldNext !== null) {
    steps.push({
      line: lines.p3,
      code: `${nodeName}->next->prev = newNode;`,
      desc: `原下一个节点（值 ${nodeValue(st, oldNext)}）的 prev 改指新节点。这步单向链表没有——双向链表两边都要改。`,
    });
  }
  steps.push({
    line: lines.p4,
    code: `${nodeName}->next = newNode;`,
    desc: '最后让前一个节点改指新节点，四步完成，prev/next 全部一致。',
  });

  for (const [i, meta] of steps.entries()) {
    const isLast = i === steps.length - 1;
    rec.record({
      type: isLast ? 'insert' : 'assign',
      title: meta.code,
      description: meta.desc,
      codeLine: meta.line,
      variables: [
        ptrVar('newNode', mem.addrOf(newNodeId), newNodeId),
        ptrVar(nodeName === 'head' ? 'head' : nodeName, mem.addrOf(nodeId), nodeId),
      ],
      memory: mem.snapshot(),
      highlight: [newNodeId, nodeId, oldNext ?? ''].filter(Boolean),
      mutate: (s) => {
        if (isLast) {
          const ni = s.nodes.findIndex((n) => n.id === newNodeId);
          if (ni >= 0) {
            const [node] = s.nodes.splice(ni, 1);
            if (node !== undefined) {
              delete node.floating;
              const pi = s.nodes.findIndex((n) => n.id === nodeId);
              s.nodes.splice(pi + 1, 0, node);
            }
          }
          s.pointers = [{ name: 'head', target: 'n0' }];
          s.nextAddr = mem.heapTop;
        }
      },
    });
  }
}

/** 头插 */
export function doublyPushFront(state: ListState, value: number): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = rebuildDoublyMem(state);
  const id = allocDNode(rec, mem, value, 26);
  linkDoublyAfter(rec, mem, 'n0', id, { p1: 29, p2: 30, p3: 32, p4: 34 });
  return rec.finish();
}

/** 尾插 */
export function doublyPushBack(state: ListState, value: number): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = rebuildDoublyMem(state);

  rec.record({
    type: 'move',
    title: 'DNode *tail = head;',
    description: '从头部出发找尾巴。',
    codeLine: 38,
    variables: [ptrVar('tail', mem.addrOf('n0'), 'n0')],
    memory: mem.snapshot(),
    highlight: ['n0'],
    mutate: (s) => {
      s.pointers.push({ name: 'tail', target: 'n0' });
    },
  });

  let cur = 'n0';
  for (;;) {
    const next = nextOf(rec.state, cur);
    if (next === null) break;
    rec.record({
      type: 'move',
      title: 'tail = tail->next;',
      description: `tail 移动到值 ${nodeValue(rec.state, next)} 的节点。`,
      codeLine: 40,
      variables: [ptrVar('tail', mem.addrOf(next), next)],
      memory: mem.snapshot(),
      highlight: [next],
      mutate: (s) => {
        const p = s.pointers.find((x) => x.name === 'tail');
        if (p !== undefined) p.target = next;
      },
    });
    cur = next;
  }

  const id = allocDNode(rec, mem, value, 43);
  // 尾插只有两步：prev 指向 tail，tail->next = newNode（next 为 NULL 无需第③步）
  linkDoublyAfter(rec, mem, cur, id, { p1: 48, p2: 49, p3: 48, p4: 49 }, 'tail');
  return rec.finish();
}

/** 删除第一个值为 value 的节点 */
export function doublyDeleteValue(state: ListState, value: number): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = rebuildDoublyMem(state);

  rec.record({
    type: 'move',
    title: 'DNode *target = head->next;',
    description: '双向链表删除可以直接从目标出发（不需要 prev 指针），因为 target->prev 自带前驱。',
    codeLine: 56,
    variables: [ptrVar('target', mem.addrOf(nextOf(state, 'n0') ?? ''), nextOf(state, 'n0'))],
    memory: mem.snapshot(),
    mutate: (s) => {
      s.pointers.push({ name: 'target', target: nextOf(state, 'n0') });
    },
  });

  let cur = nextOf(state, 'n0');
  for (;;) {
    if (cur === null) {
      rec.fail('没找到', `链表中不存在值为 ${value} 的节点。`, 61);
      return rec.finish();
    }
    const v = nodeValue(rec.state, cur);
    if (v === value) {
      rec.record({
        type: 'visit',
        title: `target->data（${v}）== ${value}，找到目标`,
        description: '准备执行两步绕过。',
        codeLine: 57,
        variables: [ptrVar('target', mem.addrOf(cur), cur)],
        memory: mem.snapshot(),
        highlight: [cur],
      });
      break;
    }
    const next = nextOf(rec.state, cur);
    rec.record({
      type: 'compare',
      title: `target->data（${v}）!= ${value}，继续走`,
      description: 'target 后移。',
      codeLine: 57,
      variables: [ptrVar('target', next === null ? null : mem.addrOf(next), next)],
      memory: mem.snapshot(),
      highlight: [next ?? cur],
      mutate: (s) => {
        const p = s.pointers.find((x) => x.name === 'target');
        if (p !== undefined) p.target = next;
      },
    });
    cur = next;
  }

  const targetId = cur as string;
  const prevId = prevOf(rec.state, targetId);
  const nextId = nextOf(rec.state, targetId);

  rec.record({
    type: 'assign',
    title:
      prevId === null
        ? 'target->prev 是 NULL，跳过第①步'
        : `target->prev->next = target->next（前驱的 next 绕过目标${nextId === null ? '指向 NULL' : `指向值 ${nodeValue(rec.state, nextId)} 的节点`}）`,
    description: '第①步：让目标的前驱不再指向它。',
    codeLine: 65,
    variables: [ptrVar('target', mem.addrOf(targetId), targetId)],
    memory: mem.snapshot(),
    highlight: [targetId, prevId ?? '', nextId ?? ''].filter(Boolean),
    mutate: (s) => {
      // 展示前驱 next 箭头改向（由渲染器按数组顺序渲染，这里先标记 dying）
      if (prevId !== null) s.pointers.push({ name: 'prev->next', target: nextId, ghost: true });
    },
  });

  rec.record({
    type: 'assign',
    title:
      nextId === null
        ? 'target->next 是 NULL，跳过第②步'
        : `target->next->prev = target->prev（后继的 prev 绕过目标${prevId === null ? '指向 NULL' : `指向值 ${nodeValue(rec.state, prevId)} 的节点`}）`,
    description: '第②步：让目标的后继也不再指向它。两步之后目标完全脱链。',
    codeLine: 68,
    variables: [ptrVar('target', mem.addrOf(targetId), targetId)],
    memory: mem.snapshot(),
    highlight: [targetId, prevId ?? '', nextId ?? ''].filter(Boolean),
    mutate: (s) => {
      const ti = s.nodes.findIndex((n) => n.id === targetId);
      if (ti >= 0) {
        const [node] = s.nodes.splice(ti, 1);
        if (node !== undefined) {
          node.floating = true;
          s.nodes.push(node);
        }
      }
      s.pointers = s.pointers.filter((p) => p.name !== 'prev->next');
    },
  });

  mem.freeObject(targetId);
  rec.record({
    type: 'free',
    title: `free(target)（释放值 ${nodeValue(rec.state, targetId)} 的节点）`,
    description: '脱链节点必须释放。双向链表删除只需改两个指针，比单向少走一遍找前驱。',
    codeLine: 70,
    memory: mem.snapshot(),
    highlight: [targetId],
    mutate: (s) => {
      s.nodes = s.nodes.filter((n) => n.id !== targetId);
      s.pointers = [{ name: 'head', target: 'n0' }];
      s.nextAddr = mem.heapTop;
    },
  });

  return rec.finish();
}

/** 正向遍历 */
export function doublyTraverseForward(state: ListState): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = rebuildDoublyMem(state);
  const seen: number[] = [];
  let cur = nextOf(state, 'n0');
  while (cur !== null) {
    const v = nodeValue(rec.state, cur) as number;
    seen.push(v);
    rec.record({
      type: 'visit',
      title: `printf 输出 ${v}`,
      description: `正向（沿 next）已输出：${seen.join(' <-> ')}`,
      codeLine: 77,
      variables: [ptrVar('current', mem.addrOf(cur), cur)],
      memory: mem.snapshot(),
      highlight: [cur],
      mutate: (s) => {
        s.pointers = [{ name: 'head', target: 'n0' }, { name: 'current', target: cur }];
      },
    });
    cur = nextOf(rec.state, cur);
  }
  rec.record({
    type: 'info',
    title: 'current == NULL，正向遍历结束',
    description: `正向结果：${seen.join(' <-> ')} <-> NULL`,
    codeLine: 80,
    memory: mem.snapshot(),
  });
  return rec.finish();
}

/** 反向遍历（教学重点：沿 prev 往回走） */
export function doublyTraverseBackward(state: ListState): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = rebuildDoublyMem(state);

  rec.record({
    type: 'move',
    title: 'DNode *current = head; 然后一路 next 走到尾巴',
    description: '反向遍历要先花 O(n) 走到最后一个节点。',
    codeLine: 85,
    variables: [ptrVar('current', mem.addrOf('n0'), 'n0')],
    memory: mem.snapshot(),
    mutate: (s) => {
      s.pointers.push({ name: 'current', target: 'n0' });
    },
  });

  let cur = 'n0';
  while (nextOf(rec.state, cur) !== null) {
    cur = nextOf(rec.state, cur) as string;
    rec.record({
      type: 'move',
      title: 'current = current->next;（找尾巴）',
      description: `走到值 ${nodeValue(rec.state, cur)} 的节点。`,
      codeLine: 86,
      variables: [ptrVar('current', mem.addrOf(cur), cur)],
      memory: mem.snapshot(),
      highlight: [cur],
      mutate: (s) => {
        const p = s.pointers.find((x) => x.name === 'current');
        if (p !== undefined) p.target = cur;
      },
    });
  }

  const seen: number[] = [];
  while (cur !== 'n0') {
    const v = nodeValue(rec.state, cur) as number;
    seen.push(v);
    rec.record({
      type: 'visit',
      title: `printf 输出 ${v}`,
      description: `反向（沿 prev）已输出：${seen.join(' <-> ')}`,
      codeLine: 89,
      variables: [ptrVar('current', mem.addrOf(cur), cur)],
      memory: mem.snapshot(),
      highlight: [cur],
    });
    const prev = prevOf(rec.state, cur);
    if (prev === null) break;
    rec.record({
      type: 'move',
      title: 'current = current->prev;',
      description: `沿 prev 指针回退到值 ${nodeValue(rec.state, prev)} 的节点。`,
      beginnerNote: 'prev 里存的是前一个节点的地址。这就是双向链表的价值：不需要重新从头找。',
      codeLine: 90,
      variables: [ptrVar('current', mem.addrOf(prev), prev)],
      memory: mem.snapshot(),
      highlight: [prev],
      mutate: (s) => {
        const p = s.pointers.find((x) => x.name === 'current');
        if (p !== undefined) p.target = prev;
      },
    });
    cur = prev;
  }

  rec.record({
    type: 'info',
    title: 'current == head，反向遍历结束',
    description: `反向结果：${seen.join(' <-> ')} <-> (head)`,
    codeLine: 92,
    memory: mem.snapshot(),
  });
  return rec.finish();
}

/** 销毁 */
export function doublyDestroy(state: ListState): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = rebuildDoublyMem(state);
  let cur: string | null = 'n0';
  while (cur !== null) {
    const next = nextOf(rec.state, cur);
    const v = nodeValue(rec.state, cur);
    mem.freeObject(cur);
    rec.record({
      type: 'free',
      title: `free(current)（释放${v === '-' ? '头节点' : `值 ${v} 的节点`}，先记下 next = ${next === null ? 'NULL' : `值 ${nodeValue(rec.state, next)}`}）`,
      description: '与单向链表一致：先保存 next，再 free。',
      codeLine: 99,
      memory: mem.snapshot(),
      highlight: [cur],
      mutate: (s) => {
        s.nodes = s.nodes.filter((n) => n.id !== cur);
        s.pointers = [{ name: 'head', target: next ?? null }];
      },
    });
    cur = next;
  }
  rec.record({
    type: 'info',
    title: 'head = NULL，销毁完成',
    description: '全部节点已释放。',
    codeLine: 102,
    memory: mem.snapshot(),
  });
  return rec.finish();
}

export type DoublyListStep = Step<ListState>;

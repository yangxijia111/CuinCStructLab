/**
 * 单链表（带头节点）：模型 + 教学步骤生成（DATA_STRUCTURE_SPEC §2）。
 * 教学重点：每一步指针发生了什么变化（插入三步、删除绕过、遍历 current 移动）。
 */
import { SimMem, StepRecorder, intVar, ptrVar } from '../recorder';
import type { ListState, ListNodeV, PointerLabel, Step, VizOutcome } from '../types';

/** 教学 C 代码（Step.codeLine 指向这里，1-based） */
export const LINKED_LIST_C_CODE: string[] = [
  '/* 单链表（带头节点）*/',
  '#include <stdio.h>',
  '#include <stdlib.h>',
  '',
  'typedef struct Node {',
  '    int data;             /* 数据域 */',
  '    struct Node *next;    /* 指针域：存下一个节点的地址 */',
  '} Node;',
  '',
  'Node *head;    /* 头指针：指向头节点（哨兵），哨兵本身不存数据 */',
  '',
  '/* 初始化：创建头节点，next 置 NULL */',
  'int listInit(void) {',
  '    head = (Node *)malloc(sizeof(Node));',
  '    if (head == NULL) {',
  '        return -1;',
  '    }',
  '    head->next = NULL;',
  '    return 0;',
  '}',
  '',
  '/* 头插：新节点成为第一个数据节点 */',
  'int listPushFront(int value) {',
  '    Node *newNode = (Node *)malloc(sizeof(Node));',
  '    if (newNode == NULL) {',
  '        return -1;',
  '    }',
  '    newNode->data = value;',
  '    newNode->next = head->next;   /* ① 新节点先抓住原来的第一个节点 */',
  '    head->next = newNode;         /* ② 头节点再改指新节点 */',
  '    return 0;',
  '}',
  '',
  '/* 尾插：走到链表末尾，接在最后 */',
  'int listPushBack(int value) {',
  '    Node *newNode = (Node *)malloc(sizeof(Node));',
  '    if (newNode == NULL) {',
  '        return -1;',
  '    }',
  '    newNode->data = value;',
  '    newNode->next = NULL;         /* 新节点将是最后一个，next = NULL */',
  '    Node *current = head;',
  '    while (current->next != NULL) {   /* 只要还有下一个就继续走 */',
  '        current = current->next;',
  '    }',
  '    current->next = newNode;      /* 接上尾巴 */',
  '    return 0;',
  '}',
  '',
  '/* 在下标 pos 的数据节点之前插入（0 <= pos） */',
  'int listInsertAt(int pos, int value) {',
  '    if (pos < 0) {',
  '        return -1;',
  '    }',
  '    Node *prev = head;',
  '    for (int i = 0; i < pos && prev->next != NULL; i++) {',
  '        prev = prev->next;        /* 走到 pos 的前一个位置 */',
  '    }',
  '    Node *newNode = (Node *)malloc(sizeof(Node));',
  '    if (newNode == NULL) {',
  '        return -1;',
  '    }',
  '    newNode->data = value;',
  '    newNode->next = prev->next;   /* ① 先接后 */',
  '    prev->next = newNode;         /* ② 再接前 */',
  '    return 0;',
  '}',
  '',
  '/* 删除第一个值为 value 的节点 */',
  'int listDeleteValue(int value) {',
  '    Node *prev = head;',
  '    while (prev->next != NULL && prev->next->data != value) {',
  '        prev = prev->next;        /* prev 始终停在目标的前一个 */',
  '    }',
  '    if (prev->next == NULL) {',
  '        return -1;                /* 走到头也没找到 */',
  '    }',
  '    Node *target = prev->next;    /* 目标节点 */',
  '    prev->next = target->next;    /* 绕过 target：链保持连续的关键 */',
  '    free(target);                 /* 释放被删节点，防止泄漏 */',
  '    return 0;',
  '}',
  '',
  '/* 删除下标 pos 的节点 */',
  'int listDeleteAt(int pos) {',
  '    if (pos < 0) {',
  '        return -1;',
  '    }',
  '    Node *prev = head;',
  '    for (int i = 0; i < pos && prev->next != NULL; i++) {',
  '        prev = prev->next;',
  '    }',
  '    if (prev->next == NULL) {',
  '        return -1;                /* pos 越界 */',
  '    }',
  '    Node *target = prev->next;',
  '    prev->next = target->next;',
  '    free(target);',
  '    return 0;',
  '}',
  '',
  '/* 查找第一个值为 value 的节点，找不到返回 NULL */',
  'Node *listFind(int value) {',
  '    Node *current = head->next;   /* 从第一个数据节点出发 */',
  '    while (current != NULL) {',
  '        if (current->data == value) {',
  '            return current;',
  '        }',
  '        current = current->next;',
  '    }',
  '    return NULL;',
  '}',
  '',
  '/* 遍历打印：10 -> 20 -> NULL */',
  'void listTraverse(void) {',
  '    Node *current = head->next;',
  '    while (current != NULL) {',
  '        printf("%d -> ", current->data);',
  '        current = current->next;',
  '    }',
  '    printf("NULL\\n");',
  '}',
  '',
  '/* 把第一个值为 from 的节点改成 to */',
  'int listSet(int from, int to) {',
  '    Node *p = listFind(from);',
  '    if (p == NULL) {',
  '        return -1;',
  '    }',
  '    p->data = to;',
  '    return 0;',
  '}',
  '',
  '/* 销毁：逐个释放。必须先记住 next 再 free */',
  'void listDestroy(void) {',
  '    Node *current = head;',
  '    while (current != NULL) {',
  '        Node *next = current->next;  /* free 之后就取不到 next 了，先存下来 */',
  '        free(current);',
  '        current = next;',
  '    }',
  '    head = NULL;',
  '}',
];

/* ============ 状态构造与读取 ============ */

/** 空链表（含哨兵头节点 n0） */
export function emptyList(): ListState {
  return {
    kind: 'list',
    nodes: [{ id: 'n0', value: null }],
    sentinel: true,
    doubly: false,
    pointers: [{ name: 'head', target: 'n0' }],
    nextAddr: 0x8000,
    seq: 1,
  };
}

/** 快速构建（单步 create；哨兵 + 数据节点） */
export function listFrom(values: number[]): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(emptyList());
  const mem = new SimMem(0x8000);
  mem.allocObject('n0', '头节点', 'data=-, next=NULL', 'Node');
  mem.defineVar('head', mem.addrOf('n0'), 'Node*');
  for (const v of values) {
    const id = `n${rec.state.seq}`;
    mem.allocObject(id, `Node(${v})`, `data=${v}`, 'Node');
    rec.state.seq += 1;
    rec.state.nodes.push({ id, value: v });
  }
  // 让内存面板 value 显示 next 链
  updateMemNextChain(mem, rec.state);
  rec.record({
    type: 'create',
    title: `创建链表 head -> ${values.join(' -> ')} -> NULL`,
    description: `分配了头节点和 ${values.length} 个数据节点，每个节点的 next 指向下一个，末尾 next = NULL。`,
    beginnerNote:
      '每个节点是独立的一块堆内存，靠 next 指针串起来。头节点（哨兵）不存数据，好处是：插入/删除第一个元素时不用特殊处理 head 本身。',
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

/** 链上有效值序列（跳过哨兵与 floating） */
export function listValues(state: ListState): number[] {
  return state.nodes.filter((n) => n.value !== null && !n.floating && !n.freed).map((n) => n.value as number);
}

/** 从状态重建内存面板（每个节点一格 + 指针变量） */
export function rebuildListMem(state: ListState, extraPtrs: PointerLabel[] = []): SimMem {
  const mem = new SimMem(state.nextAddr);
  for (const n of state.nodes) {
    if (n.freed) continue;
    const next = nextOf(state, n);
    mem.allocObject(
      n.id,
      n.value === null ? '头节点' : `Node(${n.value})`,
      next === null ? 'data=-, next=NULL' : `data=${n.value}, next=…`,
      'Node',
    );
  }
  updateMemNextChain(mem, state);
  mem.defineVar('head', state.nodes[0] !== undefined ? mem.addrOf('n0') : null, 'Node*');
  for (const p of extraPtrs) {
    mem.defineVar(p.name, p.target === null ? null : mem.addrOf(p.target), 'Node*');
  }
  return mem;
}

/** 让内存面板每个节点的 value 显示完整 next 地址链 */
function updateMemNextChain(mem: SimMem, state: ListState): void {
  for (const n of state.nodes) {
    if (n.freed) continue;
    const next = nextOf(state, n);
    const nextDesc = next === null ? 'NULL' : (mem.addrOf(next) ?? '?');
    const dataDesc = n.value === null ? '-' : String(n.value);
    mem.setObjectValue(n.id, `data=${dataDesc}, next=${nextDesc}`);
  }
}

/** 求节点在链上的下一个节点（floating 节点按数组中位置近似） */
function nextOf(state: ListState, node: ListNodeV): string | null {
  const chain = state.nodes.filter((n) => !n.floating && !n.freed);
  const idx = chain.indexOf(node);
  if (idx >= 0 && idx < chain.length - 1) return chain[idx + 1]!.id;
  return null;
}

/* ============ 操作 ============ */

/** 内部：分配一个新节点并记录 create 步骤（floating 状态） */
function allocNode(
  rec: StepRecorder<ListState>,
  mem: SimMem,
  value: number,
  codeLine: number,
): string {
  const id = `n${rec.state.seq}`;
  const addr = mem.allocObject(id, `Node(${value})`, `data=${value}, next=?`, 'Node');
  mem.defineVar('newNode', addr, 'Node*');
  rec.record({
    type: 'create',
    title: `newNode = malloc(sizeof(Node))，得到节点 ${addr}（模拟地址）`,
    description: `在堆上申请一个 Node 大小的内存，填入 data = ${value}。此时它还没有接入链表。`,
    beginnerNote:
      'sizeof(Node) 不是"两个成员的字节数想当然"，而是编译器按对齐规则算出的完整大小。malloc 返回地址，用 newNode 保存；用完必须 free。',
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

/** 内部：接线步骤——newNode->next = prev->next; prev->next = newNode */
function linkAfter(
  rec: StepRecorder<ListState>,
  mem: SimMem,
  prevId: string,
  newNodeId: string,
  codeLineStep1: number,
  codeLineStep2: number,
  prevName = 'prev',
): void {
  const state = rec.state;
  const prevNode = state.nodes.find((n) => n.id === prevId);
  const oldNext = prevNode === undefined ? null : nextOf(state, prevNode);

  rec.record({
    type: 'assign',
    title: `${prevName === 'prev' ? 'newNode->next' : 'newNode->next'} = ${prevName}->next${oldNext === null ? '(NULL)' : ''}`,
    description:
      oldNext === null
        ? `${prevName} 原来是最后一个节点，newNode->next = NULL。先让新节点抓住后方，此时链还没断。`
        : `newNode 的 next 先指向 ${prevName} 原来的下一个（值为 ${nodeValue(state, oldNext)}）。顺序不能反：如果先执行下一步，老节点就再也找不回来了（断链）。`,
    beginnerNote: `这一步是"先接后"。想象插队：新人先拉住前面同学的下一个（B 的手），队伍还没乱。`,
    codeLine: codeLineStep1,
    variables: [
      ptrVar('newNode', mem.addrOf(newNodeId), newNodeId),
      ptrVar(prevName, mem.addrOf(prevId), prevId),
    ],
    memory: mem.snapshot(),
    highlight: [newNodeId, oldNext ?? ''].filter(Boolean),
    mutate: (s) => {
      // 幽灵指针展示新箭头（ghost）
      const idx = s.pointers.findIndex((p) => p.name === 'newNode->next');
      const ghost: PointerLabel = { name: 'newNode->next', target: oldNext, ghost: true };
      if (idx >= 0) s.pointers[idx] = ghost;
      else s.pointers.push(ghost);
    },
  });

  rec.record({
    type: 'insert',
    title: `${prevName}->next = newNode（新节点正式入链）`,
    description: `${prevName} 改指 newNode。两步都完成后，newNode 稳稳插在中间，链没有断。`,
    beginnerNote: `这一步是"再接前"。前一个同学放开 B、改拉新人，插队完成。若把这步放前面：prev->next 先指向 newNode，后面节点全部丢失。`,
    codeLine: codeLineStep2,
    variables: [
      ptrVar('newNode', mem.addrOf(newNodeId), newNodeId),
      ptrVar(prevName, mem.addrOf(prevId), prevId),
    ],
    memory: mem.snapshot(),
    highlight: [newNodeId, prevId],
    mutate: (s) => {
      // 正式入链：从末尾 floating 移到 prev 之后
      const ni = s.nodes.findIndex((n) => n.id === newNodeId);
      if (ni >= 0) {
        const [node] = s.nodes.splice(ni, 1);
        if (node !== undefined) {
          delete node.floating;
          const pi = s.nodes.findIndex((n) => n.id === prevId);
          s.nodes.splice(pi + 1, 0, node);
        }
      }
      // 清理临时指针，恢复仅含 head 的基础形态
      const others = s.pointers.filter(
        (p) => p.name !== 'head' && p.name !== 'newNode' && p.name !== 'newNode->next' && p.name !== prevName,
      );
      s.pointers = [{ name: 'head', target: 'n0' }, ...others];
      s.nextAddr = mem.heapTop;
    },
  });
}

function nodeValue(state: ListState, id: string): number | string {
  const node = state.nodes.find((n) => n.id === id);
  return node?.value ?? '?';
}

/** 头插 */
export function listPushFront(state: ListState, value: number): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = rebuildListMem(state);
  const id = allocNode(rec, mem, value, 27);
  linkAfter(rec, mem, 'n0', id, 32, 33, 'head');
  return rec.finish();
}

/** 尾插 */
export function listPushBack(state: ListState, value: number): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = rebuildListMem(state);

  // current = head，走到尾
  rec.record({
    type: 'move',
    title: 'Node *current = head;',
    description: '从哨兵出发找尾巴。',
    codeLine: 41,
    variables: [ptrVar('current', mem.addrOf('n0'), 'n0')],
    memory: mem.snapshot(),
    highlight: ['n0'],
    mutate: (s) => {
      s.pointers.push({ name: 'current', target: 'n0' });
    },
  });

  let curId = 'n0';
  for (;;) {
    const next = nextOf(rec.state, nodeById(rec.state, curId));
    if (next === null) {
      rec.record({
        type: 'compare',
        title: 'current->next == NULL，到尾巴了',
        description: `当前停在${curId === 'n0' ? '头节点' : `值为 ${nodeValue(rec.state, curId)} 的节点`}，它的 next 是 NULL。`,
        codeLine: 42,
        variables: [ptrVar('current', mem.addrOf(curId), curId)],
        memory: mem.snapshot(),
        highlight: [curId],
      });
      break;
    }
    const stepTo = next;
    rec.record({
      type: 'compare',
      title: 'current->next != NULL，还没到尾',
      description: `下一个节点存在（值 ${nodeValue(rec.state, stepTo)}），继续走。`,
      codeLine: 42,
      variables: [ptrVar('current', mem.addrOf(curId), curId)],
      memory: mem.snapshot(),
      highlight: [curId, stepTo],
      mutate: (s) => {
        const p = s.pointers.find((x) => x.name === 'current');
        if (p !== undefined) p.target = stepTo;
      },
    });
    rec.record({
      type: 'move',
      title: 'current = current->next;',
      description: `current 移动到值为 ${nodeValue(rec.state, stepTo)} 的节点。`,
      beginnerNote: `current->next 保存的是下一个节点的地址。把它赋给 current，current 就"向前走了一步"。注意只能一步步走，链表不能像数组那样直接跳到第 i 个。`,
      codeLine: 43,
      variables: [ptrVar('current', mem.addrOf(stepTo), stepTo)],
      memory: mem.snapshot(),
      highlight: [stepTo],
      mutate: (s) => {
        const p = s.pointers.find((x) => x.name === 'current');
        if (p !== undefined) p.target = stepTo;
      },
    });
    curId = stepTo;
  }

  const id = allocNode(rec, mem, value, 33);
  linkAfter(rec, mem, curId, id, 44, 49, 'current');
  return rec.finish();
}

/** 在下标 pos 插入（0-based，插入后新节点位于 pos） */
export function listInsertAt(state: ListState, pos: number, value: number): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = rebuildListMem(state);

  if (pos < 0) {
    rec.fail('参数错误', `pos = ${pos} 不合法，必须 pos >= 0。`, 50);
    return rec.finish();
  }

  rec.record({
    type: 'move',
    title: 'Node *prev = head;',
    description: `要在下标 ${pos} 插入，需要先走到 ${pos} 的前一个节点。`,
    codeLine: 54,
    variables: [ptrVar('prev', mem.addrOf('n0'), 'n0'), intVar('pos', pos)],
    memory: mem.snapshot(),
    highlight: ['n0'],
    mutate: (s) => {
      s.pointers.push({ name: 'prev', target: 'n0' });
    },
  });

  let prevId = 'n0';
  for (let i = 0; i < pos; i++) {
    const next = nextOf(rec.state, nodeById(rec.state, prevId));
    if (next === null) {
      rec.record({
        type: 'info',
        title: `prev->next == NULL，链只有 ${i} 个节点，pos = ${pos} 夹取为末尾插入`,
        description: '教学实现里越界时静默尾插；工程上建议返回错误。',
        codeLine: 55,
        variables: [ptrVar('prev', mem.addrOf(prevId), prevId)],
        memory: mem.snapshot(),
        highlight: [prevId],
      });
      break;
    }
    const stepTo = next;
    rec.record({
      type: 'move',
      title: `prev = prev->next;（第 ${i + 1} 步，走到值 ${nodeValue(rec.state, stepTo)}）`,
      description: `循环 i 从 0 到 pos-1，共走 ${pos} 步，让 prev 停在插入点的前一个。`,
      codeLine: 59,
      variables: [ptrVar('prev', mem.addrOf(stepTo), stepTo), intVar('i', i)],
      memory: mem.snapshot(),
      highlight: [stepTo],
      mutate: (s) => {
        const p = s.pointers.find((x) => x.name === 'prev');
        if (p !== undefined) p.target = stepTo;
      },
    });
    prevId = stepTo;
  }

  const id = allocNode(rec, mem, value, 61);
  linkAfter(rec, mem, prevId, id, 67, 68, 'prev');
  return rec.finish();
}

/** 内部：按值定位 prev（目标前驱）并记录移动步骤；返回 {prevId, targetId | null} */
function locatePrev(
  rec: StepRecorder<ListState>,
  mem: SimMem,
  value: number,
  findCodeLine: number,
): { prevId: string; targetId: string | null } {
  rec.record({
    type: 'move',
    title: 'Node *prev = head;',
    description: '删除需要停在目标的前一个节点，才能改写它的 next。',
    codeLine: findCodeLine,
    variables: [ptrVar('prev', mem.addrOf('n0'), 'n0')],
    memory: mem.snapshot(),
    highlight: ['n0'],
    mutate: (s) => {
      s.pointers.push({ name: 'prev', target: 'n0' });
    },
  });

  let prevId = 'n0';
  for (;;) {
    const next = nextOf(rec.state, nodeById(rec.state, prevId));
    const match = next === null ? false : nodeValue(rec.state, next) === value;
    if (next === null || match) break;
    const stepTo = next;
    rec.record({
      type: 'compare',
      title: `prev->next->data（${nodeValue(rec.state, stepTo)}） != ${value}，继续走`,
      description: '目标不在当前位置，prev 向后移动。',
      codeLine: findCodeLine + 1,
      variables: [ptrVar('prev', mem.addrOf(stepTo), stepTo)],
      memory: mem.snapshot(),
      highlight: [stepTo],
      mutate: (s) => {
        const p = s.pointers.find((x) => x.name === 'prev');
        if (p !== undefined) p.target = stepTo;
      },
    });
    prevId = stepTo;
  }
  return { prevId, targetId: nextOf(rec.state, nodeById(rec.state, prevId)) };
}

/** 内部：绕过并释放 target */
function unlinkAndFree(
  rec: StepRecorder<ListState>,
  mem: SimMem,
  prevId: string,
  targetId: string,
  bypassLine: number,
  freeLine: number,
): void {
  const targetNext = nextOf(rec.state, nodeById(rec.state, targetId));

  rec.record({
    type: 'assign',
    title: `prev->next = target->next${targetNext === null ? '(NULL)' : `（值为 ${nodeValue(rec.state, targetNext)} 的节点）`}`,
    description: `prev 的 next 跳过 target 直指后方。这一步之后 target 已脱离链表，但内存还在（浮动展示）。`,
    beginnerNote: `删除链表节点不是"擦掉它"，而是让前驱绕过它。从这一刻起，再没有任何指针指向 target，它成了"孤儿节点"——所以下一步必须 free。`,
    codeLine: bypassLine,
    variables: [ptrVar('prev', mem.addrOf(prevId), prevId), ptrVar('target', mem.addrOf(targetId), targetId)],
    memory: mem.snapshot(),
    highlight: [prevId, targetId, targetNext ?? ''].filter(Boolean),
    mutate: (s) => {
      const ti = s.nodes.findIndex((n) => n.id === targetId);
      if (ti >= 0) {
        const [node] = s.nodes.splice(ti, 1);
        if (node !== undefined) {
          node.floating = true;
          s.nodes.push(node);
        }
      }
    },
  });

  mem.freeObject(targetId);
  rec.record({
    type: 'free',
    title: `free(target)：释放值为 ${nodeValue(rec.state, targetId)} 的节点`,
    description: '被绕过的节点必须 free 归还系统，否则内存泄漏。',
    beginnerNote: 'free 之后 target 里的旧地址还在（悬垂指针），绝不能再解引用。这里 target 是局部变量，函数返回后自然消失。',
    codeLine: freeLine,
    variables: [ptrVar('prev', mem.addrOf(prevId), prevId)],
    memory: mem.snapshot(),
    highlight: [targetId],
    mutate: (s) => {
      s.nodes = s.nodes.filter((n) => n.id !== targetId);
      s.pointers = [{ name: 'head', target: 'n0' }];
      s.nextAddr = mem.heapTop;
    },
  });
}

/** 删除第一个值为 value 的节点 */
export function listDeleteValue(state: ListState, value: number): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = rebuildListMem(state);

  const { prevId, targetId } = locatePrev(rec, mem, value, 69);
  if (targetId === null) {
    rec.fail('没找到', `链表中不存在值为 ${value} 的节点，删除失败。`, 74);
    return rec.finish();
  }
  rec.record({
    type: 'visit',
    title: `prev->next->data == ${value}，找到目标（值为 ${value} 的节点）`,
    description: `target 确认为值为 ${value} 的节点，准备绕过它。`,
    codeLine: 77,
    variables: [ptrVar('prev', mem.addrOf(prevId), prevId), ptrVar('target', mem.addrOf(targetId), targetId)],
    memory: mem.snapshot(),
    highlight: [targetId],
    mutate: (s) => {
      s.pointers.push({ name: 'target', target: targetId });
    },
  });
  unlinkAndFree(rec, mem, prevId, targetId, 80, 81);
  return rec.finish();
}

/** 删除下标 pos 的节点 */
export function listDeleteAt(state: ListState, pos: number): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = rebuildListMem(state);

  if (pos < 0) {
    rec.fail('参数错误', `pos = ${pos} 不合法，必须 pos >= 0。`, 85);
    return rec.finish();
  }

  rec.record({
    type: 'move',
    title: 'Node *prev = head;',
    description: `要删下标 ${pos}，先让 prev 走到它前一个。`,
    codeLine: 89,
    variables: [ptrVar('prev', mem.addrOf('n0'), 'n0'), intVar('pos', pos)],
    memory: mem.snapshot(),
    highlight: ['n0'],
    mutate: (s) => {
      s.pointers.push({ name: 'prev', target: 'n0' });
    },
  });

  let prevId = 'n0';
  for (let i = 0; i < pos; i++) {
    const next = nextOf(rec.state, nodeById(rec.state, prevId));
    if (next === null) break;
    const stepTo = next;
    rec.record({
      type: 'move',
      title: `prev = prev->next;（走到值 ${nodeValue(rec.state, stepTo)}）`,
      description: `第 ${i + 1} 步移动。`,
      codeLine: 93,
      variables: [ptrVar('prev', mem.addrOf(stepTo), stepTo), intVar('i', i)],
      memory: mem.snapshot(),
      highlight: [stepTo],
      mutate: (s) => {
        const p = s.pointers.find((x) => x.name === 'prev');
        if (p !== undefined) p.target = stepTo;
      },
    });
    prevId = stepTo;
  }

  const targetId = nextOf(rec.state, nodeById(rec.state, prevId));
  if (targetId === null) {
    rec.fail('下标越界', `pos = ${pos} 超出范围（链表长度 = ${listValues(state).length}）。`, 96);
    return rec.finish();
  }
  rec.record({
    type: 'visit',
    title: `target = prev->next（值为 ${nodeValue(rec.state, targetId)} 的节点）`,
    description: 'target 就是要删除的节点。',
    codeLine: 99,
    variables: [ptrVar('prev', mem.addrOf(prevId), prevId), ptrVar('target', mem.addrOf(targetId), targetId)],
    memory: mem.snapshot(),
    highlight: [targetId],
    mutate: (s) => {
      s.pointers.push({ name: 'target', target: targetId });
    },
  });
  unlinkAndFree(rec, mem, prevId, targetId, 100, 101);
  return rec.finish();
}

/** 查找 */
export function listFind(state: ListState, value: number): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = rebuildListMem(state);

  const first = nextOf(state, nodeById(state, 'n0'));
  rec.record({
    type: 'move',
    title: 'Node *current = head->next;',
    description: '查找从第一个数据节点开始（头节点不存数据）。',
    codeLine: 107,
    variables: [ptrVar('current', first === null ? null : mem.addrOf(first), first)],
    memory: mem.snapshot(),
    highlight: first === null ? [] : [first],
    mutate: (s) => {
      s.pointers.push({ name: 'current', target: first });
    },
  });

  let cur = first;
  while (cur !== null) {
    const v = nodeValue(rec.state, cur);
    const hit = v === value;
    rec.record({
      type: hit ? 'visit' : 'compare',
      title: `current->data（${v}）== ${value} ？${hit ? '找到了' : '不相等'}`,
      description: hit ? `值为 ${value} 的节点找到，返回 current。` : '不是目标，current 继续后移。',
      codeLine: 109,
      variables: [ptrVar('current', mem.addrOf(cur), cur), intVar('value', value)],
      memory: mem.snapshot(),
      highlight: [cur],
    });
    if (hit) break;
    const next = nextOf(rec.state, nodeById(rec.state, cur));
    if (next === null) {
      rec.record({
        type: 'info',
        title: 'current == NULL，查找结束：不存在',
        description: `走到链表末尾也没有 ${value}，返回 NULL。`,
        codeLine: 113,
        variables: [ptrVar('current', null)],
        memory: mem.snapshot(),
        mutate: (s) => {
          const p = s.pointers.find((x) => x.name === 'current');
          if (p !== undefined) p.target = null;
        },
      });
      break;
    }
    rec.record({
      type: 'move',
      title: 'current = current->next;',
      description: `current 移动到值为 ${nodeValue(rec.state, next)} 的节点。`,
      beginnerNote: '链表查找只能顺藤摸瓜：拿到当前节点 next 里存的地址，才能走到下一个节点。',
      codeLine: 111,
      variables: [ptrVar('current', mem.addrOf(next), next)],
      memory: mem.snapshot(),
      highlight: [next],
      mutate: (s) => {
        const p = s.pointers.find((x) => x.name === 'current');
        if (p !== undefined) p.target = next;
      },
    });
    cur = next;
  }

  return rec.finish();
}

/** 修改第一个值为 from 的节点为 to */
export function listSet(state: ListState, from: number, to: number): VizOutcome<ListState> {
  const find = listFind(state, from);
  const hitStep = [...find.steps].reverse().find((st) => st.type === 'visit');
  if (hitStep === undefined) {
    // 没找到：复用查找步骤后补一条失败步骤
    const rec = new StepRecorder<ListState>(state);
    for (const step of find.steps) rec.appendRaw(step);
    rec.fail('没找到', `链表中不存在值为 ${from} 的节点，修改失败。`, 125);
    return rec.finish();
  }

  const rec = new StepRecorder<ListState>(state);
  // 只复用到命中为止的查找步骤
  for (const step of find.steps.slice(0, find.steps.indexOf(hitStep) + 1)) rec.appendRaw(step);
  const target = hitStep.highlight[0];
  if (target === undefined) {
    rec.fail('内部错误', '未定位到目标节点。', 0);
    return rec.finish();
  }
  const mem = rebuildListMem(rec.state, [{ name: 'current', target }]);
  mem.setObjectName(target, `Node(${to})`);
  rec.record({
    type: 'assign',
    title: `current->data：${from} → ${to}`,
    description: '通过 current 指针改写数据域。',
    codeLine: 128,
    variables: [ptrVar('current', mem.addrOf(target), target)],
    memory: mem.snapshot(),
    highlight: [target],
    mutate: (s) => {
      const node = s.nodes.find((n) => n.id === target);
      if (node !== undefined) node.value = to;
      s.pointers = [{ name: 'head', target: 'n0' }];
    },
  });
  return rec.finish();
}

/** 遍历 */
export function listTraverse(state: ListState): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = rebuildListMem(state);

  const seen: number[] = [];
  let cur = nextOf(state, nodeById(state, 'n0'));
  rec.record({
    type: 'move',
    title: 'Node *current = head->next;',
    description: '遍历从第一个数据节点开始。',
    codeLine: 119,
    variables: [ptrVar('current', cur === null ? null : mem.addrOf(cur), cur)],
    memory: mem.snapshot(),
    mutate: (s) => {
      s.pointers.push({ name: 'current', target: cur });
    },
  });

  while (cur !== null) {
    const v = nodeValue(rec.state, cur) as number;
    seen.push(v);
    rec.record({
      type: 'visit',
      title: `printf("%d -> ", current->data) 输出 ${v}`,
      description: `已输出：${seen.join(' -> ')} -> …`,
      codeLine: 121,
      variables: [ptrVar('current', mem.addrOf(cur), cur)],
      memory: mem.snapshot(),
      highlight: [cur],
    });
    const next = nextOf(rec.state, nodeById(rec.state, cur));
    if (next === null) break;
    rec.record({
      type: 'move',
      title: 'current = current->next;',
      description: `current 从值 ${v} 的节点移动到值 ${nodeValue(rec.state, next)} 的节点。`,
      beginnerNote: `current 当前指向值为 ${v} 的节点。current->next 保存下一个节点的地址。执行后，current 将移动到值为 ${nodeValue(rec.state, next)} 的节点。`,
      codeLine: 122,
      variables: [ptrVar('current', mem.addrOf(next), next)],
      memory: mem.snapshot(),
      highlight: [next],
      mutate: (s) => {
        const p = s.pointers.find((x) => x.name === 'current');
        if (p !== undefined) p.target = next;
      },
    });
    cur = next;
  }

  rec.record({
    type: 'info',
    title: 'current == NULL，遍历结束，输出 NULL',
    description:
      seen.length === 0
        ? '链表为空，current 一开始就是 NULL，直接输出 NULL。'
        : `完整输出：${seen.join(' -> ')} -> NULL`,
    codeLine: 123,
    variables: [ptrVar('current', null)],
    memory: mem.snapshot(),
    mutate: (s) => {
      const p = s.pointers.find((x) => x.name === 'current');
      if (p !== undefined) p.target = null;
    },
  });

  return rec.finish();
}

/** 销毁：逐节点 free，重点演示"先存 next 再 free" */
export function listDestroy(state: ListState): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = rebuildListMem(state);

  let cur = state.nodes[0] !== undefined ? 'n0' : null;
  while (cur !== null) {
    const next = nextOf(rec.state, nodeById(rec.state, cur));
    const v = nodeValue(rec.state, cur);
    rec.record({
      type: 'assign',
      title: `Node *next = current->next;（先记住${next === null ? ' NULL' : `值 ${nodeValue(rec.state, next)}`}）`,
      description: 'free 之后再读 current->next 就是访问已释放内存（未定义行为），所以必须先把地址存进局部变量 next。',
      codeLine: 141,
      variables: [ptrVar('current', mem.addrOf(cur), cur), ptrVar('next', next === null ? null : mem.addrOf(next), next)],
      memory: mem.snapshot(),
      highlight: [cur, next ?? ''].filter(Boolean),
      mutate: (s) => {
        s.pointers = [
          { name: 'head', target: s.nodes[0]?.id ?? null },
          { name: 'current', target: cur },
          { name: 'next', target: next },
        ];
      },
    });
    mem.freeObject(cur);
    rec.record({
      type: 'free',
      title: `free(current)（释放${v === '-' ? '头节点' : `值 ${v} 的节点`}）`,
      description: '释放当前节点。',
      codeLine: 142,
      variables: [ptrVar('next', next === null ? null : mem.addrOf(next), next)],
      memory: mem.snapshot(),
      highlight: [cur],
      mutate: (s) => {
        s.nodes = s.nodes.filter((n) => n.id !== cur);
        s.pointers = [{ name: 'next', target: next }, { name: 'head', target: next ?? null }];
      },
    });
    cur = next;
  }

  rec.record({
    type: 'info',
    title: 'head = NULL，销毁完成',
    description: '所有节点已释放，头指针置 NULL。共释放了全部堆内存，无泄漏。',
    codeLine: 145,
    variables: [ptrVar('head', null)],
    memory: mem.snapshot(),
  });

  return rec.finish();
}

function nodeById(state: ListState, id: string): ListNodeV {
  const node = state.nodes.find((n) => n.id === id);
  if (node === undefined) throw new Error(`节点不存在: ${id}`);
  return node;
}

export type LinkedListStep = Step<ListState>;

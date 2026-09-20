/**
 * 栈：顺序栈 + 链栈 + 括号匹配应用（DATA_STRUCTURE_SPEC §4）。
 * 顺序栈约定：top 指向栈顶元素的"下一个空位"（top=0 为空栈），教学中显式说明。
 */
import { SimMem, StepRecorder, intVar, otherVar, ptrVar } from '../recorder';
import type { ListState, StackState, Step, VizOutcome } from '../types';
import { emptyList } from './linked-list';

/** 顺序栈教学容量 */
export const STACK_CAPACITY = 8;

/** 教学 C 代码（Step.codeLine 指向这里，1-based） */
export const STACK_C_CODE: string[] = [
  '/* 栈：后进先出 LIFO。先看顺序栈（数组），再看链栈 */',
  '#include <stdio.h>',
  '#include <stdlib.h>',
  '',
  '#define STACK_CAP 8    /* 教学用固定容量 */',
  '',
  '/* ---------- 顺序栈 ---------- */',
  'typedef struct {',
  '    int data[STACK_CAP];  /* 存数据的数组 */',
  '    int top;              /* 栈顶下标：指向栈顶元素的下一个空位 */',
  '} ArrayStack;',
  '',
  'void stackInit(ArrayStack *s) {',
  '    s->top = 0;           /* top = 0 表示空栈 */',
  '}',
  '',
  'int stackIsEmpty(ArrayStack *s) {',
  '    return s->top == 0;',
  '}',
  '',
  'int stackIsFull(ArrayStack *s) {',
  '    return s->top == STACK_CAP;',
  '}',
  '',
  '/* 入栈：先放元素，top 再上移 */',
  'int stackPush(ArrayStack *s, int value) {',
  '    if (stackIsFull(s)) {',
  '        return -1;        /* 栈满，放不进 */',
  '    }',
  '    s->data[s->top] = value;',
  '    s->top = s->top + 1;',
  '    return 0;',
  '}',
  '',
  '/* 出栈：top 先下移，再取元素 */',
  'int stackPop(ArrayStack *s, int *out) {',
  '    if (stackIsEmpty(s)) {',
  '        return -1;        /* 空栈，没得弹 */',
  '    }',
  '    s->top = s->top - 1;',
  '    *out = s->data[s->top];',
  '    return 0;',
  '}',
  '',
  '/* 看栈顶（不弹出） */',
  'int stackPeek(ArrayStack *s, int *out) {',
  '    if (stackIsEmpty(s)) {',
  '        return -1;',
  '    }',
  '    *out = s->data[s->top - 1];',
  '    return 0;',
  '}',
  '',
  '/* ---------- 链栈：新节点头插，top 恒指向栈顶 ---------- */',
  'typedef struct StackNode {',
  '    int data;',
  '    struct StackNode *next;',
  '} StackNode;',
  '',
  'StackNode *top = NULL;   /* 直接用栈顶指针表示整条栈 */',
  '',
  'int linkedPush(int value) {',
  '    StackNode *node = (StackNode *)malloc(sizeof(StackNode));',
  '    if (node == NULL) {',
  '        return -1;',
  '    }',
  '    node->data = value;',
  '    node->next = top;    /* 新节点指向原栈顶 */',
  '    top = node;          /* top 改指新节点：它就是新栈顶 */',
  '    return 0;',
  '}',
  '',
  'int linkedPop(int *out) {',
  '    if (top == NULL) {',
  '        return -1;       /* 空栈 */',
  '    }',
  '    StackNode *node = top;',
  '    *out = node->data;',
  '    top = node->next;    /* 栈顶下移一个 */',
  '    free(node);          /* 释放旧栈顶 */',
  '    return 0;',
  '}',
  '',
  '/* ---------- 应用：括号匹配 ----------',
  '   思路：遇左括号入栈；遇右括号弹栈配对；结束后栈空 = 匹配 */',
  'int bracketMatch(const char *s) {',
  '    ArrayStack st;',
  '    stackInit(&st);',
  '    for (int i = 0; s[i] != \'\\0\'; i++) {',
  '        char c = s[i];',
  '        if (c == \'(\' || c == \'[\' || c == \'{\') {',
  '            stackPush(&st, c);       /* 左括号入栈等待配对 */',
  '        } else if (c == \')\' || c == \']\' || c == \'}\') {',
  '            if (stackIsEmpty(&st)) {',
  '                return 0;            /* 右括号多了 */',
  '            }',
  '            int left;',
  '            stackPop(&st, &left);',
  '            if ((c == \')\' && left != \'(\') ||',
  '                (c == \']\' && left != \'[\') ||',
  '                (c == \'}\' && left != \'{\')) {',
  '                return 0;            /* 类型不匹配 */',
  '            }',
  '        }',
  '    }',
  '    return stackIsEmpty(&st);        /* 栈非空 = 左括号多了 */',
  '}',
];

/* ============ 顺序栈 ============ */

export function emptyArrayStack(capacity = STACK_CAPACITY): StackState {
  return {
    kind: 'stack',
    frames: [],
    capacity,
    impl: 'array',
    nextAddr: 0x8000,
    seq: 0,
  };
}

/** 快速构建（自底向上填入） */
export function arrayStackFrom(values: Array<number | string>, capacity = STACK_CAPACITY): VizOutcome<StackState> {
  const rec = new StepRecorder<StackState>(emptyArrayStack(capacity));
  const mem = new SimMem(0x8000);
  mem.allocObject('arr', `int[${STACK_CAPACITY}]`, '栈的数组', 'int[]');
  mem.defineVar('s.top', String(values.length), 'int');
  rec.record({
    type: 'create',
    title: `创建顺序栈，已压入 [${values.join(', ')}]`,
    description: `top = ${values.length}，指向栈顶元素的下一个空位。`,
    codeLine: 14,
    variables: [intVar('s.top', values.length)],
    memory: mem.snapshot(),
    highlight: values.map((_, i) => `f${i}`),
    mutate: (s) => {
      s.frames = values.map((v, i) => ({ id: `f${i}`, label: String(v) }));
    },
  });
  return rec.finish();
}

export function arrayStackPush(state: StackState, value: number): VizOutcome<StackState> {
  const rec = new StepRecorder<StackState>(state);
  const mem = stackMem(state);

  if (state.frames.length >= (state.capacity ?? STACK_CAPACITY)) {
    rec.record({
      type: 'error',
      title: '栈满（overflow）',
      description: `top == STACK_CAP（${state.capacity}），数组没有空位了。顺序栈的固有限制：需要预先知道最大深度。`,
      codeLine: 28,
      variables: [intVar('s.top', state.frames.length)],
      memory: mem.snapshot(),
      mutate: (s) => {
        s.overflow = true;
      },
    });
    return rec.finish();
  }

  const idx = state.frames.length;
  rec.record({
    type: 'insert',
    title: `s->data[s->top] = ${value}（放在 top 指的空位）`,
    description: `元素 ${value} 压入下标 ${idx}。`,
    beginnerNote: `top 就是"下一个空位的下标"。放进去之后 top 还没动，所以要再看下一步。`,
    codeLine: 31,
    variables: [intVar('s.top', idx), intVar('value', value)],
    memory: mem.snapshot(),
    highlight: [`f${idx}`],
    mutate: (s) => {
      s.frames.push({ id: `f${idx}`, label: String(value) });
    },
  });

  rec.record({
    type: 'assign',
    title: `s->top = ${idx + 1}（top 上移一格）`,
    description: `栈顶指针上移，${value} 成为新栈顶。push 完成，栈深度 ${idx + 1}。`,
    codeLine: 32,
    variables: [intVar('s.top', idx + 1)],
    memory: mem.snapshot(),
    highlight: [`f${idx}`],
    mutate: (s) => {
      s.overflow = false;
    },
  });

  return rec.finish();
}

export function arrayStackPop(state: StackState): VizOutcome<StackState> {
  const rec = new StepRecorder<StackState>(state);
  const mem = stackMem(state);

  if (state.frames.length === 0) {
    rec.fail('空栈下溢（underflow）', 'top == 0，栈里没有元素可弹出。写代码时必须先判空！', 38);
    return rec.finish();
  }

  const idx = state.frames.length - 1;
  const value = state.frames[idx]!.label;
  rec.record({
    type: 'assign',
    title: `s->top = ${idx}（top 先下移，指向栈顶元素）`,
    description: '出栈顺序与入栈相反：先把 top 降下来，栈顶元素才"露出来"。',
    codeLine: 41,
    variables: [intVar('s.top', idx)],
    memory: mem.snapshot(),
    highlight: [`f${idx}`],
  });

  rec.record({
    type: 'delete',
    title: `*out = s->data[s->top]，弹出 ${value}`,
    description: `读出下标 ${idx} 的值 ${value}，该格从此视为无效（下次 push 会覆盖它）。`,
    codeLine: 42,
    variables: [otherVar('*out', value), intVar('s.top', idx)],
    memory: mem.snapshot(),
    highlight: [`f${idx}`],
    mutate: (s) => {
      s.frames.pop();
    },
  });

  return rec.finish();
}

export function arrayStackPeek(state: StackState): VizOutcome<StackState> {
  const rec = new StepRecorder<StackState>(state);
  const mem = stackMem(state);
  if (state.frames.length === 0) {
    rec.fail('空栈', '栈为空，没有栈顶可看。', 49);
    return rec.finish();
  }
  const idx = state.frames.length - 1;
  const value = state.frames[idx]!.label;
  rec.record({
    type: 'visit',
    title: `*out = s->data[s->top - 1]，栈顶是 ${value}（top 不动）`,
    description: 'peek 只看不弹：top 保持不变，元素还在栈里。',
    codeLine: 51,
    variables: [otherVar('*out', value), intVar('s.top', idx + 1)],
    memory: mem.snapshot(),
    highlight: [`f${idx}`],
  });
  return rec.finish();
}

function stackMem(state: StackState): SimMem {
  const mem = new SimMem(state.nextAddr);
  mem.allocObject('arr', `int[${state.capacity ?? STACK_CAPACITY}]`, `栈深 ${state.frames.length}`, 'int[]');
  mem.defineVar('s.top', String(state.frames.length), 'int');
  return mem;
}

/* ============ 链栈 ============ */

export function emptyLinkedStack(): ListState {
  return {
    kind: 'list',
    nodes: [],
    sentinel: false,
    doubly: false,
    pointers: [{ name: 'top', target: null }],
    nextAddr: 0x8000,
    seq: 1,
  };
}

export function linkedStackFrom(values: number[]): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(emptyLinkedStack());
  const mem = new SimMem(0x8000);
  // 头插语义：values 顺序入栈后，栈顶是最后一个
  for (const v of values) {
    const id = `n${rec.state.seq}`;
    mem.allocObject(id, `Node(${v})`, `data=${v}`, 'StackNode');
    rec.state.seq += 1;
    rec.state.nodes.unshift({ id, value: v });
  }
  mem.defineVar('top', rec.state.nodes[0] !== undefined ? mem.addrOf(rec.state.nodes[0].id) : null, 'StackNode*');
  rec.record({
    type: 'create',
    title: `创建链栈（栈顶 → ${values.join(' → ')} → NULL）`,
    description: `链栈没有容量上限（受限于内存）。top 指向栈顶节点。`,
    codeLine: 63,
    variables: [ptrVar('top', mem.addrOf(rec.state.nodes[0]?.id ?? ''), rec.state.nodes[0]?.id)],
    memory: mem.snapshot(),
    highlight: rec.state.nodes.map((n) => n.id),
    mutate: (s) => {
      s.nextAddr = mem.heapTop;
    },
  });
  return rec.finish();
}

export function linkedStackPush(state: ListState, value: number): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = listStackMem(state);
  const id = `n${rec.state.seq}`;
  const addr = mem.allocObject(id, `Node(${value})`, `data=${value}, next=?`, 'StackNode');

  rec.record({
    type: 'create',
    title: `node = malloc(sizeof(StackNode))（${addr}）`,
    description: `新节点 data = ${value}。`,
    codeLine: 63,
    variables: [ptrVar('node', addr, id), intVar('node->data', value)],
    memory: mem.snapshot(),
    highlight: [id],
    mutate: (s) => {
      s.seq += 1;
      s.nodes.unshift({ id, value, floating: true });
      s.nextAddr = mem.heapTop;
    },
  });

  const oldTop = state.nodes[0]?.id ?? null;
  rec.record({
    type: 'assign',
    title: `node->next = top;（新节点指向原栈顶${oldTop === null ? ' NULL' : ''}）`,
    description: '新节点先接住原来的栈顶，成为它下面一层。',
    codeLine: 67,
    variables: [ptrVar('node', addr, id), ptrVar('top', oldTop === null ? null : mem.addrOf(oldTop), oldTop)],
    memory: mem.snapshot(),
    highlight: [id, oldTop ?? ''].filter(Boolean),
    mutate: (s) => {
      const node = s.nodes.find((n) => n.id === id);
      if (node !== undefined) delete node.floating;
    },
  });

  rec.record({
    type: 'insert',
    title: 'top = node;（新节点成为栈顶）',
    description: `top 改指新节点，${value} 成为新栈顶。`,
    codeLine: 68,
    variables: [ptrVar('top', addr, id)],
    memory: mem.snapshot(),
    highlight: [id],
    mutate: (s) => {
      s.pointers = [{ name: 'top', target: id }];
    },
  });

  return rec.finish();
}

export function linkedStackPop(state: ListState): VizOutcome<ListState> {
  const rec = new StepRecorder<ListState>(state);
  const mem = listStackMem(state);

  if (state.nodes.length === 0) {
    rec.fail('空栈下溢', 'top == NULL，链栈为空，不能弹出。', 73);
    return rec.finish();
  }

  const topId = state.nodes[0]!.id;
  const value = state.nodes[0]!.value ?? 0;
  const nextId = state.nodes[1]?.id ?? null;

  rec.record({
    type: 'assign',
    title: `*out = node->data，取出栈顶 ${value}`,
    description: `栈顶节点（值 ${value}）的数据先读出来。`,
    codeLine: 75,
    variables: [otherVar('*out', String(value)), ptrVar('top', mem.addrOf(topId), topId)],
    memory: mem.snapshot(),
    highlight: [topId],
  });

  rec.record({
    type: 'move',
    title: `top = node->next;（栈顶下移到${nextId === null ? ' NULL' : `值 ${state.nodes[1]?.value} 的节点`}）`,
    description: 'top 指向原栈顶的下一个。',
    codeLine: 76,
    variables: [ptrVar('top', nextId === null ? null : mem.addrOf(nextId), nextId)],
    memory: mem.snapshot(),
    highlight: [nextId ?? topId],
    mutate: (s) => {
      s.pointers = [{ name: 'top', target: nextId }];
    },
  });

  mem.freeObject(topId);
  rec.record({
    type: 'free',
    title: `free(node)（释放值 ${value} 的节点）`,
    description: '链栈弹出必须释放节点，否则每次 push/pop 都泄漏一个节点。',
    codeLine: 77,
    memory: mem.snapshot(),
    highlight: [topId],
    mutate: (s) => {
      s.nodes = s.nodes.filter((n) => n.id !== topId);
      s.nextAddr = mem.heapTop;
    },
  });

  return rec.finish();
}

function listStackMem(state: ListState): SimMem {
  const mem = new SimMem(state.nextAddr);
  for (const n of state.nodes) {
    if (n.freed) continue;
    mem.allocObject(n.id, `Node(${n.value})`, `data=${n.value}`, 'StackNode');
  }
  mem.defineVar('top', state.nodes[0] !== undefined ? mem.addrOf(state.nodes[0].id) : null, 'StackNode*');
  return mem;
}

/* ============ 括号匹配 ============ */

const LEFTS = new Set(['(', '[', '{']);
const RIGHTS = new Set([')', ']', '}']);
const PAIR: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

/**
 * 括号匹配完整演示：返回步骤 + 匹配结果。
 * state 为演示用的顺序栈初始状态（通常为空栈）。
 */
export function bracketMatchDemo(input: string): {
  steps: Step<StackState>[];
  matched: boolean;
  reason: string;
  finalText: string;
} {
  const rec = new StepRecorder<StackState>(emptyArrayStack());
  const mem = stackMem(rec.state);
  const chars: string[] = [];
  for (const ch of input) chars.push(ch); // 逐字符收集（括号匹配输入按 Unicode 码点切分即可）
  let matched = true;
  let reason = '';

  rec.record({
    type: 'init',
    title: '扫描整个字符串，左括号入栈、右括号弹栈配对',
    description: `输入：${input === '' ? '（空串）' : input}`,
    codeLine: 84,
    memory: mem.snapshot(),
  });

  for (const [i, c] of chars.entries()) {
    const posDesc = `s[${i}] = '${c}'`;
    if (LEFTS.has(c)) {
      const idx = rec.state.frames.length;
      rec.record({
        type: 'insert',
        title: `${posDesc} 是左括号 → 入栈`,
        description: `'${c}' 压入栈顶等待未来配对。`,
        codeLine: 89,
        variables: [intVar('i', i), otherVar('c', `'${c}'`), intVar('st.top', idx + 1)],
        memory: mem.snapshot(),
        highlight: [`f${idx}`],
        mutate: (s) => {
          s.frames.push({ id: `f${s.frames.length}`, label: c });
        },
      });
    } else if (RIGHTS.has(c)) {
      if (rec.state.frames.length === 0) {
        matched = false;
        reason = `第 ${i + 1} 个字符 '${c}' 找不到配对的左括号（栈已空，右括号多了）`;
        rec.record({
          type: 'error',
          title: `${posDesc} 是右括号，但栈是空的`,
          description: `${reason}。返回 0，匹配失败。`,
          codeLine: 92,
          variables: [intVar('i', i)],
          memory: mem.snapshot(),
        });
        break;
      }
      const idx = rec.state.frames.length - 1;
      const left = rec.state.frames[idx]!.label;
      const ok = PAIR[c] === left;
      rec.record({
        type: 'delete',
        title: `${posDesc} 是右括号 → 弹出栈顶 '${left}' 配对${ok ? '成功' : '失败'}`,
        description: ok
          ? `'${left}' 与 '${c}' 是一对，消掉。`
          : `'${left}' 与 '${c}' 不是一对（类型不匹配），返回 0。`,
        codeLine: 96,
        variables: [intVar('i', i), otherVar('left', `'${left}'`)],
        memory: mem.snapshot(),
        highlight: [`f${idx}`],
        mutate: (s) => {
          s.frames.pop();
        },
      });
      if (!ok) {
        matched = false;
        reason = `第 ${i + 1} 个字符 '${c}' 与栈顶 '${left}' 类型不匹配`;
        break;
      }
    } else {
      rec.record({
        type: 'info',
        title: `${posDesc} 不是括号，跳过`,
        description: '只处理三种括号字符。',
        codeLine: 86,
        memory: mem.snapshot(),
      });
    }
  }

  if (matched && rec.state.frames.length > 0) {
    matched = false;
    reason = `扫描结束但栈里还有 ${rec.state.frames.length} 个左括号没被配对（左括号多了）`;
    rec.record({
      type: 'error',
      title: '字符串结束，栈非空',
      description: `${reason}。返回 0，匹配失败。`,
      codeLine: 104,
      memory: mem.snapshot(),
    });
  }

  if (matched) {
    rec.record({
      type: 'info',
      title: '扫描结束且栈空：匹配成功',
      description: '每个左括号都找到了同类型的右括号，返回 1。',
      codeLine: 104,
      memory: mem.snapshot(),
    });
  }

  return {
    steps: rec.finish().steps,
    matched,
    reason: matched ? '所有括号正确配对' : reason,
    finalText: input,
  };
}

export type StackStep = Step<StackState>;
export { emptyList };

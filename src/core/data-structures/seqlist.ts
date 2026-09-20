/**
 * 顺序表 SeqList：模型 + 教学步骤生成（DATA_STRUCTURE_SPEC §1）。
 * 教学 C 代码与步骤映射在同文件维护，保证 codeLine 永不漂移（C_CODE_SPEC §4）。
 */
import { SimMem, StepRecorder, indexVar, intVar, otherVar, ptrVar, sizeVar } from '../recorder';
import type { ArrayCell, ArrayState, Step, VizOutcome } from '../types';
import { buildLineMap } from '../utils/code-lines';

/** 教学 C 代码（行号从 1 开始，Step.codeLine 指向这里） */
export const SEQ_LIST_C_CODE: string[] = [
  '/* 顺序表 SeqList：基于动态数组的线性表 */',
  '#include <stdio.h>',
  '#include <stdlib.h>',
  '',
  'typedef struct {',
  '    int *data;      /* 指向堆上数组的指针 */',
  '    int size;       /* 当前元素个数 */',
  '    int capacity;   /* 数组容量 */',
  '} SeqList;',
  '',
  '/* 初始化：申请初始容量，返回 0 表示成功 */',
  'int seqListInit(SeqList *L, int initCapacity) {',
  '    L->data = (int *)malloc(initCapacity * sizeof(int));',
  '    if (L->data == NULL) {',
  '        return -1;    /* 内存申请失败 */',
  '    }',
  '    L->size = 0;',
  '    L->capacity = initCapacity;',
  '    return 0;',
  '}',
  '',
  '/* 扩容（内部函数）：申请两倍大的新数组，搬移后释放旧数组 */',
  'static int grow(SeqList *L) {',
  '    int newCap = L->capacity * 2;',
  '    int *newData = (int *)malloc(newCap * sizeof(int));',
  '    if (newData == NULL) {',
  '        return -1;',
  '    }',
  '    for (int i = 0; i < L->size; i++) {',
  '        newData[i] = L->data[i];    /* 逐个搬移到新数组 */',
  '    }',
  '    free(L->data);                 /* 释放旧数组 */',
  '    L->data = newData;',
  '    L->capacity = newCap;',
  '    return 0;',
  '}',
  '',
  '/* 在下标 pos 处插入 value（合法范围 0 <= pos <= size） */',
  'int seqListInsert(SeqList *L, int pos, int value) {',
  '    if (pos < 0 || pos > L->size) {',
  '        return -1;                 /* 下标越界 */',
  '    }',
  '    if (L->size == L->capacity) {',
  '        if (grow(L) != 0) {',
  '            return -1;             /* 扩容失败 */',
  '        }',
  '    }',
  '    /* 从后往前挪动，为 pos 腾出空位 */',
  '    for (int i = L->size - 1; i >= pos; i--) {',
  '        L->data[i + 1] = L->data[i];',
  '    }',
  '    L->data[pos] = value;',
  '    L->size = L->size + 1;',
  '    return 0;',
  '}',
  '',
  '/* 删除下标 pos 处的元素，返回 0 表示成功 */',
  'int seqListDelete(SeqList *L, int pos) {',
  '    if (pos < 0 || pos >= L->size) {',
  '        return -1;                 /* 下标越界 */',
  '    }',
  '    /* 从前往后挪动，覆盖被删元素 */',
  '    for (int i = pos; i < L->size - 1; i++) {',
  '        L->data[i] = L->data[i + 1];',
  '    }',
  '    L->size = L->size - 1;',
  '    return 0;',
  '}',
  '',
  '/* 查找 value 首次出现的下标，不存在返回 -1 */',
  'int seqListFind(SeqList *L, int value) {',
  '    for (int i = 0; i < L->size; i++) {',
  '        if (L->data[i] == value) {',
  '            return i;',
  '        }',
  '    }',
  '    return -1;',
  '}',
  '',
  '/* 把下标 pos 的值改为 value */',
  'int seqListSet(SeqList *L, int pos, int value) {',
  '    if (pos < 0 || pos >= L->size) {',
  '        return -1;                 /* 下标越界 */',
  '    }',
  '    L->data[pos] = value;',
  '    return 0;',
  '}',
  '',
  '/* 遍历打印所有元素 */',
  'void seqListTraverse(SeqList *L) {',
  '    for (int i = 0; i < L->size; i++) {',
  '        printf("%d ", L->data[i]);',
  '    }',
  '    printf("\\n");',
  '}',
  '',
  '/* 销毁：释放堆上的数组，把指针置 NULL */',
  'void seqListDestroy(SeqList *L) {',
  '    free(L->data);',
  '    L->data = NULL;',
  '    L->size = 0;',
  '    L->capacity = 0;',
  '}',
];

/** 关键行号表（按代码文本定位，杜绝硬编码漂移） */
const L = buildLineMap(SEQ_LIST_C_CODE, {
  initFn: 'int seqListInit(',
  initMalloc: 'L->data = (int *)malloc(initCapacity',
  initSize: 'L->size = 0;',
  initCap: 'L->capacity = initCapacity;',
  growMalloc: 'int *newData = (int *)malloc(newCap',
  growMove: 'newData[i] = L->data[i];',
  growFree: 'free(L->data);',
  insertFn: 'int seqListInsert(',
  insertRange: 'if (pos < 0 || pos > L->size)',
  insertFull: 'if (L->size == L->capacity)',
  insertMove: 'L->data[i + 1] = L->data[i];',
  insertWrite: 'L->data[pos] = value;',
  insertSize: 'L->size = L->size + 1;',
  deleteFn: 'int seqListDelete(',
  deleteRange: 'if (pos < 0 || pos >= L->size)',
  deleteMove: 'L->data[i] = L->data[i + 1];',
  deleteSize: 'L->size = L->size - 1;',
  findFn: 'int seqListFind(',
  findCmp: 'if (L->data[i] == value)',
  findMiss: 'return -1;',
  setFn: 'int seqListSet(',
  setRange: 'if (pos < 0 || pos >= L->size)',
  setWrite: 'L->data[pos] = value;',
  traverseFn: 'void seqListTraverse(',
  traversePrint: 'printf("%d ", L->data[i]);',
  destroyFn: 'void seqListDestroy(',
  destroyFree: 'free(L->data);',
  destroyNull: 'L->data = NULL;',
});

/** 从终态提取纯值序列（测试与断言用） */
export function seqListValues(state: ArrayState): number[] {
  return state.cells.slice(0, state.size).map((c) => c.value ?? 0);
}

function makeCells(capacity: number): ArrayCell[] {
  return Array.from({ length: capacity }, (_, i) => ({ id: `a${i}`, value: null, flags: [] }));
}

/** 构造一个空顺序表初始状态（不产生步骤；供 Playground 快速搭建） */
export function emptySeqList(capacity = 4): ArrayState {
  return {
    kind: 'array',
    label: 'L.data',
    cells: makeCells(capacity),
    size: 0,
    capacity,
    nextAddr: 0x8000,
    seq: capacity,
  };
}

/** 快速构建含初始数据的顺序表（单步 create，供 Playground 初始化） */
export function seqListFrom(values: number[], capacity?: number): VizOutcome<ArrayState> {
  const cap = Math.max(capacity ?? values.length, values.length, 1);
  const rec = new StepRecorder<ArrayState>(emptySeqList(cap));
  const mem = new SimMem(0x8000);
  rec.record({
    type: 'create',
    title: `创建顺序表 L，装入 [${values.join(', ')}]`,
    description: `malloc 了容量为 ${cap} 的 int 数组，L.data 指向它，size = ${values.length}。`,
    beginnerNote:
      '顺序表 = 一块连续内存 + 记录长度的 size。data 是指针，保存数组第一个格子的地址；访问 L.data[i] 就是"从起点向后数 i 格"。',
    codeLine: L.initMalloc,
    variables: [ptrVar('L.data', '0x8000', 'arr'), sizeVar('L.size', values.length), intVar('L.capacity', cap)],
    memory: mem.snapshot(),
    highlight: values.map((_, i) => `a${i}`),
    mutate: (s) => {
      values.forEach((v, i) => {
        s.cells[i]!.value = v;
      });
      s.size = values.length;
    },
  });
  return rec.finish();
}

/* ============ 操作（每个返回步骤序列） ============ */

export interface SeqListCtx {
  rec: StepRecorder<ArrayState>;
  mem: SimMem;
}

/** 初始化顺序表（完整 malloc 流程演示） */
export function seqListInit(initCapacity = 4): VizOutcome<ArrayState> {
  const rec = new StepRecorder<ArrayState>(emptySeqList(0));
  const mem = new SimMem(0x8000);
  mem.defineVar('L.data', null, 'int*');
  mem.defineVar('L.size', '0', 'int');
  mem.defineVar('L.capacity', '0', 'int');

  rec.record({
    type: 'init',
    title: '定义 SeqList L（此时 data 还是野的 NULL）',
    description: '栈上定义结构体变量 L，三个成员尚未赋值，先把 data 置为 NULL 表示"还没有数组"。',
    codeLine: L.initFn,
    variables: [ptrVar('L.data', null), sizeVar('L.size', 0), intVar('L.capacity', 0)],
    memory: mem.snapshot(),
    mutate: (s) => {
      s.capacity = 0;
      s.size = 0;
    },
  });

  const arrAddr = mem.allocObject('arr', `int[${initCapacity}]`, `容量 ${initCapacity} 的 int 数组`, 'int[]');
  rec.record({
    type: 'create',
    title: `malloc(initCapacity * sizeof(int))，得到 ${arrAddr}`,
    description: `向系统申请能装 ${initCapacity} 个 int 的连续内存，起始地址 ${arrAddr}（模拟地址）赋给 L.data。`,
    beginnerNote:
      'malloc 的参数是"字节数"：initCapacity * sizeof(int) 才是正确写法。返回值是 void* 指针，C 中赋给 int* 无需强转，但必须检查是否为 NULL。',
    codeLine: L.initMalloc,
    variables: [ptrVar('L.data', arrAddr, 'arr'), sizeVar('L.size', 0), intVar('L.capacity', initCapacity)],
    memory: mem.snapshot(),
    highlight: ['arr'],
    mutate: (s) => {
      s.cells = makeCells(initCapacity);
      s.capacity = initCapacity;
      s.size = 0;
    },
  });

  rec.record({
    type: 'assign',
    title: 'L.size = 0; L.capacity = initCapacity;',
    description: '记录当前元素个数与容量，初始化完成。',
    codeLine: L.initSize,
    variables: [ptrVar('L.data', arrAddr, 'arr'), sizeVar('L.size', 0), intVar('L.capacity', initCapacity)],
    memory: mem.snapshot(),
  });

  return rec.finish();
}

/** 内部：扩容并生成搬移步骤 */
function grow(rec: StepRecorder<ArrayState>, mem: SimMem): void {
  const state = rec.state;
  const oldCap = state.capacity;
  const newCap = oldCap * 2;
  const oldAddr = mem.addrOf('arr');

  const newArrAddr = mem.allocObject('arrNew', `int[${newCap}]`, `容量 ${newCap} 的新数组`, 'int[]');
  rec.record({
    type: 'grow',
    title: `容量满了：malloc 新数组（容量 ×2 = ${newCap}），地址 ${newArrAddr}`,
    description: `旧容量 ${oldCap} 已装满。申请一块两倍大的新内存 ${newArrAddr}（模拟地址），接下来要把旧数据搬过去。`,
    beginnerNote:
      '动态数组无法"原地变大"，因为旁边的内存可能被占用。唯一办法：申请新的大数组 → 复制 → 释放旧的。这就是 vector 扩容的本质。',
    codeLine: L.growMalloc,
    variables: [intVar('newCap', newCap), ptrVar('newData', newArrAddr, 'arrNew'), ptrVar('L.data', oldAddr, 'arr')],
    memory: mem.snapshot(),
    highlight: ['arrNew'],
    mutate: (s) => {
      const newCells = makeCells(newCap);
      for (let i = 0; i < s.size; i++) {
        newCells[i]!.value = s.cells[i]!.value;
        newCells[i]!.flags = [...(s.cells[i]?.flags ?? [])];
      }
      s.cells = newCells;
      s.capacity = newCap;
    },
  });

  const arrCellName = `int[${newCap}]`;
  rec.record({
    type: 'move',
    title: '逐个搬移旧数据到新数组',
    description: `for 循环把 ${state.size} 个元素依次复制：newData[i] = data[i]。`,
    codeLine: L.growMove,
    variables: [ptrVar('newData', newArrAddr, 'arrNew'), ptrVar('L.data', oldAddr, 'arr'), indexVar('i', 0)],
    memory: mem.snapshot(),
    highlight: Array.from({ length: state.size }, (_, i) => `a${i}`),
  });

  mem.freeObject('arr');
  mem.dropObject('arr');
  mem.setObjectName('arrNew', arrCellName);
  rec.record({
    type: 'free',
    title: `free(L->data) 释放旧数组 ${oldAddr}，再让 L.data 指向新数组`,
    description: `旧数组 ${oldAddr} 已无用，必须 free 归还系统（否则内存泄漏）；然后 L.data = newData。`,
    codeLine: L.growFree,
    variables: [ptrVar('L.data', newArrAddr, 'arrNew'), intVar('L.capacity', newCap)],
    memory: mem.snapshot(),
    mutate: (s) => {
      s.nextAddr = Math.max(s.nextAddr, 0x8000 + newCap * 16);
    },
  });
}

/** 在下标 pos 插入 value */
export function seqListInsert(state: ArrayState, pos: number, value: number): VizOutcome<ArrayState> {
  const rec = new StepRecorder<ArrayState>(state);
  const mem = rebuildMem(state);

  if (pos < 0 || pos > state.size) {
    rec.fail(
      '下标越界',
      `插入位置 pos = ${pos} 不合法：必须满足 0 <= pos <= size（当前 size = ${state.size}）。`,
      L.insertRange,
    );
    return rec.finish();
  }

  rec.record({
    type: 'info',
    title: `检查参数：pos = ${pos}，value = ${value}`,
    description: `pos 在合法范围 [0, ${state.size}] 内，可以插入。`,
    codeLine: L.insertFn,
    variables: [indexVar('pos', pos), intVar('value', value), sizeVar('L.size', state.size)],
    memory: mem.snapshot(),
    highlight: [`a${pos}`],
  });

  if (state.size === state.capacity) {
    grow(rec, mem);
  }

  const st1 = rec.state;
  for (let i = st1.size - 1; i >= pos; i--) {
    const moved = st1.cells[i]!.value ?? 0;
    rec.record({
      type: 'assign',
      title: `L->data[${i + 1}] = L->data[${i}]（把 ${moved} 后移一格）`,
      description: `从后往前挪：先把下标 ${i} 的 ${moved} 复制到 ${i + 1}，为 pos = ${pos} 腾位置。从后往前是为了不覆盖还没搬的数据。`,
      beginnerNote: `如果从前往后挪，data[pos+1] 会先被覆盖，导致后面的数据丢失。从后往前：每次写的位置 [i+1] 一定已经"搬走"了。`,
      codeLine: L.insertMove,
      variables: [indexVar('i', i), indexVar('pos', pos), sizeVar('L.size', st1.size)],
      memory: mem.snapshot(),
      highlight: [`a${i}`, `a${i + 1}`],
      mutate: (s) => {
        s.cells[i + 1]!.value = moved;
        s.cells[i + 1]!.flags = ['writing'];
      },
    });
  }

  const st2 = rec.state;
  const displaced = pos < st2.size ? (st2.cells[pos]!.value ?? null) : null;
  rec.record({
    type: 'assign',
    title: `L->data[${pos}] = ${value}`,
    description:
      displaced === null
        ? `在空位 pos = ${pos} 写入 ${value}。`
        : `把 ${value} 写进腾出的 pos = ${pos}（原值 ${displaced} 已后移）。`,
    codeLine: L.insertWrite,
    variables: [indexVar('pos', pos), intVar('value', value)],
    memory: mem.snapshot(),
    highlight: [`a${pos}`],
    mutate: (s) => {
      s.cells[pos]!.value = value;
      s.cells[pos]!.flags = ['writing'];
    },
  });

  rec.record({
    type: 'insert',
    title: `L->size = ${rec.state.size + 1}，插入完成`,
    description: `元素个数 +1，当前顺序表内容：[${seqListValues(rec.state).join(', ')}]。`,
    codeLine: L.insertSize,
    variables: [sizeVar('L.size', rec.state.size + 1)],
    memory: mem.snapshot(),
    mutate: (s) => {
      s.size += 1;
      for (const c of s.cells) c.flags = [];
    },
  });

  return rec.finish();
}

/** 删除下标 pos 的元素 */
export function seqListDelete(state: ArrayState, pos: number): VizOutcome<ArrayState> {
  const rec = new StepRecorder<ArrayState>(state);
  const mem = rebuildMem(state);

  if (pos < 0 || pos >= state.size) {
    rec.fail('下标越界', `删除位置 pos = ${pos} 不合法：必须满足 0 <= pos < size（当前 size = ${state.size}）。`, 60);
    return rec.finish();
  }

  const removed = state.cells[pos]!.value ?? 0;
  rec.record({
    type: 'info',
    title: `检查参数：pos = ${pos} 合法，将删除 ${removed}`,
    description: `被删除的是下标 ${pos} 的值 ${removed}。`,
    codeLine: L.deleteFn,
    variables: [indexVar('pos', pos), sizeVar('L.size', state.size)],
    memory: mem.snapshot(),
    highlight: [`a${pos}`],
  });

  const st = rec.state;
  for (let i = pos; i < st.size - 1; i++) {
    const moved = st.cells[i + 1]!.value ?? 0;
    rec.record({
      type: 'assign',
      title: `L->data[${i}] = L->data[${i + 1}]（把 ${moved} 前移一格）`,
      description: `从前往后挪：用后面的 ${moved} 覆盖前面的位置 ${i}，被删元素逐渐被"抹掉"。`,
      codeLine: L.deleteMove,
      variables: [indexVar('i', i), sizeVar('L.size', st.size)],
      memory: mem.snapshot(),
      highlight: [`a${i}`, `a${i + 1}`],
      mutate: (s) => {
        s.cells[i]!.value = moved;
        s.cells[i]!.flags = ['writing'];
      },
    });
  }

  rec.record({
    type: 'delete',
    title: `L->size = ${rec.state.size - 1}，删除完成`,
    description: `元素个数 -1。注意：最后一格的旧值还留在内存里，但 size 之外不算有效数据（这格将来会被覆盖）。当前内容：[${seqListValues(rec.state).join(', ')}]。`,
    codeLine: L.deleteSize,
    variables: [sizeVar('L.size', rec.state.size - 1)],
    memory: mem.snapshot(),
    mutate: (s) => {
      s.size -= 1;
      s.cells[s.size]!.flags = ['removed'];
    },
  });

  return rec.finish();
}

/** 查找 value */
export function seqListFind(state: ArrayState, value: number): VizOutcome<ArrayState> {
  const rec = new StepRecorder<ArrayState>(state);
  const mem = rebuildMem(state);

  let found = -1;
  for (let i = 0; i < state.size; i++) {
    const cur = state.cells[i]!.value ?? 0;
    const hit = cur === value;
    if (hit) found = i;
    rec.record({
      type: hit ? 'visit' : 'compare',
      title: `比较 L->data[${i}]（${cur}）== ${value} ？${hit ? '相等！' : '不相等'}`,
      description: hit ? `在下标 ${i} 找到了 ${value}，返回下标。` : `下标 ${i} 是 ${cur}，不是目标，继续往后找。`,
      codeLine: L.findCmp,
      variables: [indexVar('i', i), intVar('value', value)],
      memory: mem.snapshot(),
      highlight: [`a${i}`],
      metrics: { comparisons: i + 1, swaps: 0 },
      mutate: (s) => {
        s.cells[i]!.flags = [hit ? 'sorted' : 'comparing'];
      },
    });
    if (hit) break;
  }

  if (found === -1) {
    rec.record({
      type: 'info',
      title: `没找到 ${value}，返回 -1`,
      description: `从头到尾比较了 ${state.size} 次，都不等于目标值，返回 -1 表示不存在。`,
      codeLine: L.findMiss,
      variables: [intVar('value', value), otherVar('返回值', '-1')],
      memory: mem.snapshot(),
      metrics: { comparisons: state.size, swaps: 0 },
      mutate: (s) => {
        for (const c of s.cells) c.flags = [];
      },
    });
  }

  return rec.finish();
}

/** 修改下标 pos 的值 */
export function seqListSet(state: ArrayState, pos: number, value: number): VizOutcome<ArrayState> {
  const rec = new StepRecorder<ArrayState>(state);
  const mem = rebuildMem(state);

  if (pos < 0 || pos >= state.size) {
    rec.fail('下标越界', `修改位置 pos = ${pos} 不合法：必须满足 0 <= pos < size（当前 size = ${state.size}）。`, 83);
    return rec.finish();
  }

  const old = state.cells[pos]!.value ?? 0;
  rec.record({
    type: 'assign',
    title: `L->data[${pos}]：${old} → ${value}`,
    description: `直接通过下标定位（顺序表随机访问 O(1)），把 ${old} 改成 ${value}。`,
    beginnerNote: `L->data[pos] 的含义：data 保存首地址，pos × sizeof(int) 就是偏移量，一步算出目标格子地址——这就是"随机访问"。`,
    codeLine: L.setWrite,
    variables: [indexVar('pos', pos), intVar('value', value)],
    memory: mem.snapshot(),
    highlight: [`a${pos}`],
    mutate: (s) => {
      s.cells[pos]!.value = value;
      s.cells[pos]!.flags = ['writing'];
    },
  });

  rec.record({
    type: 'info',
    title: '修改完成',
    description: `当前内容：[${seqListValues(rec.state).join(', ')}]。`,
    codeLine: L.setFn,
    memory: mem.snapshot(),
    mutate: (s) => {
      for (const c of s.cells) c.flags = [];
    },
  });

  return rec.finish();
}

/** 遍历 */
export function seqListTraverse(state: ArrayState): VizOutcome<ArrayState> {
  const rec = new StepRecorder<ArrayState>(state);
  const mem = rebuildMem(state);

  const seen: number[] = [];
  for (let i = 0; i < state.size; i++) {
    const v = state.cells[i]!.value ?? 0;
    seen.push(v);
    rec.record({
      type: 'visit',
      title: `printf("%d ", L->data[${i}]) 输出 ${v}`,
      description: `访问下标 ${i}，已输出：${seen.join(' ')}`,
      codeLine: L.traversePrint,
      variables: [indexVar('i', i)],
      memory: mem.snapshot(),
      highlight: [`a${i}`],
      mutate: (s) => {
        for (const c of s.cells) c.flags = c.flags.filter((f) => f !== 'visited');
        s.cells[i]!.flags = ['visited'];
      },
    });
  }

  return rec.finish();
}

/** 销毁 */
export function seqListDestroy(state: ArrayState): VizOutcome<ArrayState> {
  const rec = new StepRecorder<ArrayState>(state);
  const mem = rebuildMem(state);
  const addr = mem.addrOf('arr');

  mem.freeObject('arr');
  mem.defineVar('L.data', null, 'int*');
  rec.record({
    type: 'free',
    title: `free(L->data)：释放堆数组 ${addr ?? ''}`,
    description: '顺序表用完必须释放 malloc 的数组，否则内存泄漏。释放后 data 变成悬垂指针，所以要紧接着置 NULL。',
    beginnerNote: 'free 之后指针变量里还留着旧地址（悬垂指针），再解引用是未定义行为。养成 free 后立刻置 NULL 的习惯。',
    codeLine: L.destroyFree,
    variables: [ptrVar('L.data', null), sizeVar('L.size', state.size)],
    memory: mem.snapshot(),
    mutate: (s) => {
      for (const c of s.cells) {
        c.flags = [];
        c.value = null;
      }
    },
  });

  rec.record({
    type: 'assign',
    title: 'L->data = NULL; L->size = 0; L->capacity = 0;',
    description: '把结构体恢复到空状态，销毁完成。',
    codeLine: L.destroyNull,
    memory: mem.snapshot(),
    mutate: (s) => {
      s.size = 0;
      s.capacity = 0;
      s.cells = [];
    },
  });

  return rec.finish();
}

/** 从状态重建内存面板（顺序表的堆对象只有一个：数组本体） */
function rebuildMem(state: ArrayState): SimMem {
  const mem = new SimMem(state.nextAddr);
  const used = state.size;
  mem.allocObject(
    'arr',
    `int[${state.capacity}]`,
    state.capacity === 0 ? '（空）' : `前 ${used} 格有效`,
    'int[]',
  );
  mem.defineVar('L.data', mem.addrOf('arr'), 'int*');
  mem.defineVar('L.size', String(state.size), 'int');
  mem.defineVar('L.capacity', String(state.capacity), 'int');
  return mem;
}

/** 便捷类型导出 */
export type SeqListStep = Step<ArrayState>;

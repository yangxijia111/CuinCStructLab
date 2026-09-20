import { describe, expect, it } from 'vitest';
import type { ListState } from '../types';
import {
  LINKED_LIST_C_CODE,
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
  listValues,
} from './linked-list';

function finalState(outcome: { steps: { afterState: ListState }[] }): ListState {
  const last = outcome.steps[outcome.steps.length - 1];
  if (last === undefined) throw new Error('没有步骤');
  return last.afterState;
}

function assertCodeLines(steps: { codeLine: number }[]): void {
  for (const [i, step] of steps.entries()) {
    expect(step.codeLine, `step${i}`).toBeGreaterThanOrEqual(0);
    expect(step.codeLine, `step${i}`).toBeLessThanOrEqual(LINKED_LIST_C_CODE.length);
  }
}

describe('listFrom / 基础', () => {
  it('构建 10 20 30，含哨兵', () => {
    const out = listFrom([10, 20, 30]);
    expect(out.ok).toBe(true);
    const s = finalState(out);
    expect(listValues(s)).toEqual([10, 20, 30]);
    expect(s.nodes[0]?.value).toBeNull(); // 哨兵
    expect(s.pointers.some((p) => p.name === 'head' && p.target === 'n0')).toBe(true);
  });

  it('空链表构建', () => {
    const out = listFrom([]);
    expect(listValues(finalState(out))).toEqual([]);
    expect(finalState(out).nodes).toHaveLength(1); // 只有哨兵
  });
});

describe('listPushFront（头插）', () => {
  it('空链表头插', () => {
    const out = listPushFront(emptyList(), 5);
    expect(listValues(finalState(out))).toEqual([5]);
    assertCodeLines(out.steps);
  });

  it('多次头插逆序', () => {
    let s = finalState(listFrom([10]));
    s = finalState(listPushFront(s, 20));
    s = finalState(listPushFront(s, 30));
    expect(listValues(s)).toEqual([30, 20, 10]);
  });

  it('包含两步接线：①newNode->next=head->next ②head->next=newNode', () => {
    const out = listPushFront(finalState(listFrom([10, 20])), 5);
    const titles = out.steps.map((st) => st.title);
    expect(titles.some((t) => t.includes('newNode->next'))).toBe(true);
    expect(titles.some((t) => t.includes('head->next = newNode'))).toBe(true);
    // 接线顺序：先接后、再接前
    const i1 = titles.findIndex((t) => t.includes('newNode->next'));
    const i2 = titles.findIndex((t) => t.includes('head->next = newNode'));
    expect(i1).toBeLessThan(i2);
  });
});

describe('listPushBack（尾插）', () => {
  it('空链表尾插与常规尾插', () => {
    let s = finalState(listFrom([]));
    s = finalState(listPushBack(s, 1));
    s = finalState(listPushBack(s, 2));
    s = finalState(listPushBack(s, 3));
    expect(listValues(s)).toEqual([1, 2, 3]);
  });

  it('遍历过程包含 current 移动步骤', () => {
    const out = listPushBack(finalState(listFrom([10, 20])), 30);
    expect(out.steps.filter((st) => st.type === 'move').length).toBeGreaterThanOrEqual(2);
    assertCodeLines(out.steps);
  });
});

describe('listInsertAt（指定位置插入）', () => {
  it('中间插入：10 20 30 的 pos=1 插 15 → 10 15 20 30', () => {
    const s = finalState(listFrom([10, 20, 30]));
    const out = listInsertAt(s, 1, 15);
    expect(out.ok).toBe(true);
    expect(listValues(finalState(out))).toEqual([10, 15, 20, 30]);
    assertCodeLines(out.steps);
  });

  it('pos=0 等价头插，pos=长度 等价尾插', () => {
    const s = finalState(listFrom([10, 20]));
    expect(listValues(finalState(listInsertAt(s, 0, 5)))).toEqual([5, 10, 20]);
    expect(listValues(finalState(listInsertAt(s, 2, 99)))).toEqual([10, 20, 99]);
  });

  it('pos 超长夹取为尾插', () => {
    const s = finalState(listFrom([10, 20]));
    const out = listInsertAt(s, 100, 7);
    expect(out.ok).toBe(true);
    expect(listValues(finalState(out))).toEqual([10, 20, 7]);
  });

  it('负数 pos 报错', () => {
    const out = listInsertAt(finalState(listFrom([1])), -1, 9);
    expect(out.ok).toBe(false);
  });
});

describe('listDeleteValue / listDeleteAt', () => {
  it('删除头（值）、中间、尾', () => {
    let s = finalState(listFrom([10, 15, 20, 30]));
    s = finalState(listDeleteValue(s, 10)); // 删头
    expect(listValues(s)).toEqual([15, 20, 30]);
    s = finalState(listDeleteValue(s, 20)); // 删中
    expect(listValues(s)).toEqual([15, 30]);
    s = finalState(listDeleteValue(s, 30)); // 删尾
    expect(listValues(s)).toEqual([15]);
  });

  it('删除不存在的值失败', () => {
    const s = finalState(listFrom([10, 20]));
    const out = listDeleteValue(s, 99);
    expect(out.ok).toBe(false);
    expect(listValues(finalState(out))).toEqual([10, 20]);
  });

  it('listDeleteAt 删下标 0/末尾/越界', () => {
    const s = finalState(listFrom([10, 20, 30]));
    expect(listValues(finalState(listDeleteAt(s, 0)))).toEqual([20, 30]);
    expect(listValues(finalState(listDeleteAt(s, 2)))).toEqual([10, 20]);
    const out = listDeleteAt(s, 5);
    expect(out.ok).toBe(false);
    expect(listDeleteAt(s, -1).ok).toBe(false);
  });

  it('删除含绕过与 free 步骤', () => {
    const out = listDeleteValue(finalState(listFrom([10, 20, 30])), 20);
    expect(out.steps.some((st) => st.title.includes('prev->next = target->next'))).toBe(true);
    expect(out.steps.some((st) => st.type === 'free')).toBe(true);
    assertCodeLines(out.steps);
  });
});

describe('listFind / listSet', () => {
  it('找到与找不到', () => {
    const s = finalState(listFrom([10, 20, 30]));
    const ok = listFind(s, 20);
    expect(ok.steps.some((st) => st.type === 'visit')).toBe(true);
    const bad = listFind(s, 99);
    expect(bad.steps[bad.steps.length - 1]?.title).toContain('不存在');
  });

  it('listSet 修改成功', () => {
    const out = listSet(finalState(listFrom([10, 20])), 20, 99);
    expect(out.ok).toBe(true);
    expect(listValues(finalState(out))).toEqual([10, 99]);
  });

  it('listSet 修改不存在的值失败', () => {
    const out = listSet(finalState(listFrom([10])), 5, 9);
    expect(out.ok).toBe(false);
    expect(listValues(finalState(out))).toEqual([10]);
  });
});

describe('listTraverse', () => {
  it('逐步访问全部值', () => {
    const out = listTraverse(finalState(listFrom([10, 20, 30])));
    const visits = out.steps.filter((st) => st.type === 'visit');
    expect(visits.map((st) => Number(st.title.match(/输出 (\d+)/)?.[1]))).toEqual([10, 20, 30]);
    // 末尾输出 NULL
    expect(out.steps[out.steps.length - 1]?.title).toContain('NULL');
  });

  it('空链表遍历直接结束', () => {
    const out = listTraverse(emptyList());
    expect(out.steps[out.steps.length - 1]?.title).toContain('NULL');
  });
});

describe('listDestroy', () => {
  it('每个节点都产生 free 步骤（含哨兵）', () => {
    const out = listDestroy(finalState(listFrom([10, 20, 30])));
    const frees = out.steps.filter((st) => st.type === 'free');
    expect(frees).toHaveLength(4); // 哨兵 + 3 个数据节点
    // free 前都先记录 next
    const saves = out.steps.filter((st) => st.title.includes('Node *next = current->next'));
    expect(saves).toHaveLength(4);
    expect(finalState(out).nodes).toHaveLength(0);
  });

  it('空链表销毁只释放哨兵', () => {
    const out = listDestroy(emptyList());
    expect(out.steps.filter((st) => st.type === 'free')).toHaveLength(1);
  });
});

describe('内存面板', () => {
  it('内存面板含节点与指针变量，标注模拟', () => {
    const out = listFrom([10, 20]);
    const step = out.steps[0]!;
    expect(step.memory.simulated).toBe(true);
    expect(step.memory.cells.some((c) => c.name === '头节点')).toBe(true);
    expect(step.memory.cells.some((c) => c.name === 'Node(10)')).toBe(true);
    expect(step.memory.cells.some((c) => c.name === 'head')).toBe(true);
    // 模拟地址 0x 开头
    expect(step.memory.cells.find((c) => c.name === 'head')?.value).toMatch(/^0x[0-9a-f]+$/);
  });
});

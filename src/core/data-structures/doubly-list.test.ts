import { describe, expect, it } from 'vitest';
import type { ListState } from '../types';
import {
  DOUBLY_LIST_C_CODE,
  doublyDeleteValue,
  doublyDestroy,
  doublyListFrom,
  doublyListValues,
  doublyPushBack,
  doublyPushFront,
  doublyTraverseBackward,
  doublyTraverseForward,
  emptyDoublyList,
} from './doubly-list';

function finalState(outcome: { steps: { afterState: ListState }[] }): ListState {
  const last = outcome.steps[outcome.steps.length - 1];
  if (last === undefined) throw new Error('没有步骤');
  return last.afterState;
}

function assertCodeLines(steps: { codeLine: number }[]): void {
  for (const [i, step] of steps.entries()) {
    expect(step.codeLine, `step${i}`).toBeLessThanOrEqual(DOUBLY_LIST_C_CODE.length);
    expect(step.codeLine, `step${i}`).toBeGreaterThanOrEqual(0);
  }
}

describe('doublyListFrom', () => {
  it('构建与哨兵', () => {
    const out = doublyListFrom([10, 20, 30]);
    expect(doublyListValues(finalState(out))).toEqual([10, 20, 30]);
    expect(finalState(out).doubly).toBe(true);
  });
});

describe('doublyPushFront / doublyPushBack', () => {
  it('头插四步（含原首节点 prev 改向）', () => {
    const out = doublyPushFront(finalState(doublyListFrom([10, 20])), 5);
    expect(doublyListValues(finalState(out))).toEqual([5, 10, 20]);
    const titles = out.steps.map((s) => s.title);
    expect(titles.some((t) => t.includes('newNode->prev = head'))).toBe(true);
    expect(titles.some((t) => t.includes('newNode->next = head->next'))).toBe(true);
    expect(titles.some((t) => t.includes('head->next->prev = newNode'))).toBe(true);
    expect(titles.some((t) => t.includes('head->next = newNode'))).toBe(true);
    // 四步顺序 ①②③④
    const idx = [
      titles.findIndex((t) => t.includes('newNode->prev')),
      titles.findIndex((t) => t.includes('newNode->next')),
      titles.findIndex((t) => t.includes('head->next->prev')),
      titles.findIndex((t) => t.includes('head->next = newNode')),
    ];
    expect(idx[0]).toBeLessThan(idx[1]!);
    expect(idx[1]).toBeLessThan(idx[2]!);
    expect(idx[2]).toBeLessThan(idx[3]!);
    assertCodeLines(out.steps);
  });

  it('空链表头插跳过第③步', () => {
    const out = doublyPushFront(emptyDoublyList(), 5);
    expect(doublyListValues(finalState(out))).toEqual([5]);
    expect(out.steps.some((s) => s.title.includes('head->next->prev'))).toBe(false);
  });

  it('尾插', () => {
    let s = finalState(doublyListFrom([10, 20]));
    s = finalState(doublyPushBack(s, 30));
    expect(doublyListValues(s)).toEqual([10, 20, 30]);
  });
});

describe('doublyDeleteValue', () => {
  it('删除中间节点：两步绕过 + free', () => {
    const out = doublyDeleteValue(finalState(doublyListFrom([10, 20, 30])), 20);
    expect(out.ok).toBe(true);
    expect(doublyListValues(finalState(out))).toEqual([10, 30]);
    const titles = out.steps.map((s) => s.title);
    expect(titles.some((t) => t.includes('target->prev->next'))).toBe(true);
    expect(titles.some((t) => t.includes('target->next->prev'))).toBe(true);
    expect(out.steps.some((s) => s.type === 'free')).toBe(true);
    assertCodeLines(out.steps);
  });

  it('删除头/尾数据节点', () => {
    const s = finalState(doublyListFrom([10, 20, 30]));
    expect(doublyListValues(finalState(doublyDeleteValue(s, 10)))).toEqual([20, 30]);
    expect(doublyListValues(finalState(doublyDeleteValue(s, 30)))).toEqual([10, 20]);
  });

  it('删除不存在的值失败', () => {
    const out = doublyDeleteValue(finalState(doublyListFrom([10])), 99);
    expect(out.ok).toBe(false);
  });

  it('双向一致性：删除后正向与反向遍历互逆', () => {
    const s = finalState(doublyDeleteValue(finalState(doublyListFrom([1, 2, 3, 4])), 3));
    const fwd = doublyTraverseForward(s);
    const bwd = doublyTraverseBackward(s);
    const fwdSeq = fwd.steps.filter((x) => x.type === 'visit').map((x) => x.title.match(/输出 (\d+)/)?.[1]);
    const bwdSeq = bwd.steps.filter((x) => x.type === 'visit').map((x) => x.title.match(/输出 (\d+)/)?.[1]);
    expect(fwdSeq).toEqual(['1', '2', '4']);
    expect(bwdSeq).toEqual(['4', '2', '1']);
  });
});

describe('遍历', () => {
  it('正向/反向', () => {
    const s = finalState(doublyListFrom([10, 20, 30]));
    const fwd = doublyTraverseForward(s).steps.filter((x) => x.type === 'visit');
    expect(fwd.map((x) => x.title.match(/输出 (\d+)/)?.[1])).toEqual(['10', '20', '30']);
    const bwd = doublyTraverseBackward(s).steps.filter((x) => x.type === 'visit');
    expect(bwd.map((x) => x.title.match(/输出 (\d+)/)?.[1])).toEqual(['30', '20', '10']);
  });
});

describe('doublyDestroy', () => {
  it('全部节点释放', () => {
    const out = doublyDestroy(finalState(doublyListFrom([10, 20])));
    expect(out.steps.filter((s) => s.type === 'free')).toHaveLength(3);
    expect(finalState(out).nodes).toHaveLength(0);
  });
});

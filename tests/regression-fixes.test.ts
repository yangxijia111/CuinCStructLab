/**
 * P16 全面审查回归测试：逐条覆盖本轮修复的确认 bug，防止复发。
 */
import { describe, expect, it } from 'vitest';
import { buildLineMap } from '../src/core/utils/code-lines';
import type { ArrayState, GraphState, QueueState } from '../src/core/types';
import { seqListDestroy, seqListFrom, seqListInsert, seqListValues } from '../src/core/data-structures/seqlist';
import { circularQueueFrom, cqDequeue, cqEnqueue, cqValues, QUEUE_CAPACITY } from '../src/core/data-structures/queue';
import { graphAddEdge, graphFrom, graphRemoveEdge } from '../src/core/data-structures/graph';
import { streakDays } from '../src/storage/mastery-rules';

/** 从 VizOutcome 取终态（最后一步的 afterState） */
function finalOf<S>(outcome: { steps: { afterState: S }[] }): S {
  return outcome.steps[outcome.steps.length - 1]!.afterState;
}

/* ---------- buildLineMap 锚定语法 ---------- */

describe('buildLineMap 锚定 needle', () => {
  const CODE = [
    'int a(void) {',
    '    if (x == NULL) {',
    '        return 0;',
    '    }',
    '}',
    '',
    'int b(void) {',
    '    if (x == NULL) {',
    '        return 1;',
    '    }',
    '}',
  ];

  it('无锚 needle 命中首次出现', () => {
    const L = buildLineMap(CODE, { first: 'if (x == NULL)' });
    expect(L.first).toBe(2);
  });

  it('锚定 needle 从锚函数体内查找', () => {
    const L = buildLineMap(CODE, { inB: ['if (x == NULL)', 'int b(void)'] });
    expect(L.inB).toBe(8);
  });

  it('锚不存在时解析为 0（而非误命中）', () => {
    const L = buildLineMap(CODE, { bad: ['if (x == NULL)', 'int missing('] });
    expect(L.bad).toBe(0);
  });
});

/* ---------- seqlist：destroy 后 insert（capacity=0 扩容崩溃） ---------- */

describe('seqlist destroy 后再插入', () => {
  it('capacity=0 时 grow 兜底为 1，不崩溃', () => {
    const created = seqListFrom([1, 2]);
    const destroyed = seqListDestroy(created.steps[created.steps.length - 1]!.afterState);
    // destroy 后 pos=0 插入：旧代码 newCap = 0*2 = 0 → cells[0] 为 undefined → TypeError
    const finalBefore = destroyed.steps[destroyed.steps.length - 1]!.afterState as ArrayState;
    const r = seqListInsert(finalBefore, 0, 99);
    expect(r.ok).toBe(true);
    expect(seqListValues(finalOf(r))).toEqual([99]);
  });
});

/* ---------- 循环队列：超容量输入 + 格子 id 一致性 ---------- */

describe('循环队列超容量输入截断', () => {
  it('输入 6 个（=容量）只装前 5 个，rear 与 front 不重合', () => {
    const s = finalOf(circularQueueFrom([1, 2, 3, 4, 5, 6], QUEUE_CAPACITY)) as QueueState;
    expect(s.rear).toBe(QUEUE_CAPACITY - 1);
    expect(s.front).toBe(0);
    expect(cqValues(s)).toEqual([1, 2, 3, 4, 5]);
    expect(s.slots).toHaveLength(QUEUE_CAPACITY);
  });

  it('输入 7 个（>容量）同样只装 5 个，slots 不越界增长', () => {
    const s = finalOf(circularQueueFrom([9, 8, 7, 6, 5, 4, 3], QUEUE_CAPACITY)) as QueueState;
    expect(s.slots).toHaveLength(QUEUE_CAPACITY);
    expect(cqValues(s)).toEqual([9, 8, 7, 6, 5]);
  });
});

describe('循环队列格子 id 与 highlight 一致（下标制）', () => {
  it('初始构造后出队再入队，回绕格子 id 不重复且 highlight 可命中', () => {
    // [1,2,3] 装入后出队 1 个 → front=1；连续入队到回绕
    let s = finalOf(circularQueueFrom([1, 2, 3], QUEUE_CAPACITY)) as QueueState;
    s = finalOf(cqDequeue(s));
    s = finalOf(cqEnqueue(s, 4));
    s = finalOf(cqEnqueue(s, 5));
    // id 全部唯一
    const ids = s.slots.filter((x) => x !== null).map((x) => x!.id);
    expect(new Set(ids).size).toBe(ids.length);
    // 每个 id 形如 q<下标>，与 QueueView 的 highlight 匹配
    for (const [i, slot] of s.slots.entries()) {
      if (slot !== null) expect(slot.id).toBe(`q${i}`);
    }
  });

  it('入队第二步描述包含刚入队的值', () => {
    const s = finalOf(circularQueueFrom([1], QUEUE_CAPACITY)) as QueueState;
    const r = cqEnqueue(s, 77);
    const second = r.steps.find((st) => st.title.includes('(rear+1)'));
    expect(second?.description).toContain('77');
  });
});

/* ---------- 有向图删边不连带反向边 ---------- */

describe('有向图删除单向边', () => {
  it('A→B 与 B→A 并存时删 A→B，B→A 保留', () => {
    const g = finalOf(graphFrom(['A', 'B'], [['A', 'B']], true)) as GraphState;
    const withBoth = finalOf(graphAddEdge(g, 'B', 'A', true));
    const after = finalOf(graphRemoveEdge(withBoth, 'A', 'B', true));
    expect(after.edges).toEqual([{ from: 'B', to: 'A' }]);
  });

  it('无向图删边仍双向一起删', () => {
    const g = finalOf(graphFrom(['A', 'B'], [['A', 'B']], false)) as GraphState;
    const after = finalOf(graphRemoveEdge(g, 'A', 'B', false));
    expect(after.edges).toEqual([]);
  });
});

/* ---------- streakDays：本地日期语义 ---------- */

describe('streakDays 本地日期语义', () => {
  it('今天学过 → 至少 1 天', () => {
    const today = '2026-10-04';
    expect(streakDays([today], today)).toBe(1);
  });

  it('连续三天（昨天起，今天没学）→ 3', () => {
    const today = '2026-10-04';
    expect(streakDays(['2026-10-01', '2026-10-02', '2026-10-03'], today)).toBe(3);
  });

  it('跨月边界正确回退', () => {
    const today = '2026-11-01';
    expect(streakDays(['2026-10-30', '2026-10-31', '2026-11-01'], today)).toBe(3);
  });

  it('中断后只数最近一段', () => {
    const today = '2026-10-04';
    expect(streakDays(['2026-10-03', '2026-09-30', '2026-09-29'], today)).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import type { ListState, QueueState } from '../types';
import {
  QUEUE_C_CODE,
  cqDequeue,
  cqEnqueue,
  cqValues,
  circularQueueFrom,
  emptyLinkedQueue,
  lqDequeue,
  lqEnqueue,
  linkedQueueFrom,
  naiveOverflowDemo,
} from './queue';

function finalQueue(outcome: { steps: { afterState: QueueState }[] }): QueueState {
  const last = outcome.steps[outcome.steps.length - 1];
  if (last === undefined) throw new Error('没有步骤');
  return last.afterState;
}

function finalList(outcome: { steps: { afterState: ListState }[] }): ListState {
  const last = outcome.steps[outcome.steps.length - 1];
  if (last === undefined) throw new Error('没有步骤');
  return last.afterState;
}

function assertCodeLines(steps: { codeLine: number }[]): void {
  for (const [i, step] of steps.entries()) {
    expect(step.codeLine, `step${i}`).toBeLessThanOrEqual(QUEUE_C_CODE.length);
    expect(step.codeLine, `step${i}`).toBeGreaterThanOrEqual(0);
  }
}

describe('循环队列 enqueue/dequeue', () => {
  it('FIFO 顺序', () => {
    let s = finalQueue(circularQueueFrom([]));
    s = finalQueue(cqEnqueue(s, 1));
    s = finalQueue(cqEnqueue(s, 2));
    s = finalQueue(cqEnqueue(s, 3));
    expect(cqValues(s)).toEqual([1, 2, 3]);
    const d = cqDequeue(s);
    expect(d.ok).toBe(true);
    expect(d.steps.some((st) => st.title.includes('出队 1'))).toBe(true);
    expect(cqValues(finalQueue(d))).toEqual([2, 3]);
    assertCodeLines(d.steps);
  });

  it('空队列出队失败', () => {
    const out = cqDequeue(finalQueue(circularQueueFrom([])));
    expect(out.ok).toBe(false);
    expect(out.steps[out.steps.length - 1]?.title).toContain('队空');
  });

  it('容量 n 只能装 n-1 个（留一空位）', () => {
    let s = finalQueue(circularQueueFrom([]));
    for (let i = 1; i <= 5; i++) {
      const out = cqEnqueue(s, i);
      expect(out.ok, `第 ${i} 个应成功`).toBe(true);
      s = finalQueue(out);
    }
    const full = cqEnqueue(s, 6);
    expect(full.ok).toBe(false);
    expect(full.steps[full.steps.length - 1]?.title).toContain('队满');
    expect(cqValues(finalQueue(full))).toEqual([1, 2, 3, 4, 5]);
  });

  it('wrap-around：出队后继续入队，rear 回绕到 0', () => {
    let s = finalQueue(circularQueueFrom([1, 2, 3, 4, 5])); // rear=5 已满
    s = finalQueue(cqDequeue(s)); // front=1
    s = finalQueue(cqDequeue(s)); // front=2
    const out = cqEnqueue(s, 6); // 放入 rear=5 → rear 回绕 0
    expect(out.ok).toBe(true);
    expect(out.steps.some((st) => st.type === 'wraparound')).toBe(true);
    const wrap = out.steps.find((st) => st.type === 'wraparound')!;
    expect(wrap.title).toContain('→ 0');
    s = finalQueue(out);
    expect(cqValues(s)).toEqual([3, 4, 5, 6]);
    // front 回绕
    s = finalQueue(cqDequeue(s));
    s = finalQueue(cqDequeue(s));
    s = finalQueue(cqDequeue(s));
    const out2 = cqDequeue(s); // front 从 5 回绕到 0
    expect(out2.steps.some((st) => st.type === 'wraparound')).toBe(true);
    expect(cqValues(finalQueue(out2))).toEqual([]);
  });

  it('出队到空后再入队（环上复用）', () => {
    let s = finalQueue(circularQueueFrom([1, 2]));
    s = finalQueue(cqDequeue(s));
    s = finalQueue(cqDequeue(s));
    expect(cqValues(s)).toEqual([]);
    s = finalQueue(cqEnqueue(s, 7));
    expect(cqValues(s)).toEqual([7]);
  });
});

describe('链队列', () => {
  it('enqueue / dequeue FIFO', () => {
    let s = finalList(linkedQueueFrom([]));
    s = finalList(lqEnqueue(s, 1));
    s = finalList(lqEnqueue(s, 2));
    expect(s.nodes.map((n) => n.value)).toEqual([1, 2]);
    const out = lqDequeue(s);
    expect(out.ok).toBe(true);
    expect(out.steps.some((st) => st.title.includes('出队 1'))).toBe(true);
    expect(finalList(out).nodes.map((n) => n.value)).toEqual([2]);
    assertCodeLines(out.steps);
  });

  it('空队列出队失败', () => {
    expect(lqDequeue(emptyLinkedQueue()).ok).toBe(false);
  });

  it('空队列入队：front 与 rear 同时指向新节点', () => {
    const out = lqEnqueue(emptyLinkedQueue(), 9);
    const s = finalList(out);
    expect(out.steps.some((st) => st.title.includes('q->front = node; q->rear = node'))).toBe(true);
    expect(s.nodes.map((n) => n.value)).toEqual([9]);
    expect(s.pointers.find((p) => p.name === 'front')?.target).toBe(s.nodes[0]?.id);
    expect(s.pointers.find((p) => p.name === 'rear')?.target).toBe(s.nodes[0]?.id);
  });

  it('出队到空：rear 同步置空', () => {
    let s = finalList(linkedQueueFrom([5]));
    const out = lqDequeue(s);
    const st = finalList(out);
    expect(st.nodes).toHaveLength(0);
    expect(st.pointers.find((p) => p.name === 'rear')?.target).toBeNull();
    expect(out.steps.some((st2) => st2.title.includes('q->rear = NULL') || st2.title.includes('rear = NULL'))).toBe(true);
    s = st;
    // 空后再入队不崩溃
    const again = lqEnqueue(s, 6);
    expect(again.ok).toBe(true);
    expect(finalList(again).nodes.map((n) => n.value)).toEqual([6]);
  });
});

describe('假溢出演示', () => {
  it('前空后满仍然报错', () => {
    const demo = naiveOverflowDemo(5);
    expect(demo.failedAt).toContain('空位');
    const errStep = demo.steps.find((st) => st.type === 'error');
    expect(errStep).toBeDefined();
    expect(errStep?.title).toContain('假');
  });
});

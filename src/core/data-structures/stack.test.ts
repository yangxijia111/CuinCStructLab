import { describe, expect, it } from 'vitest';
import type { ListState, StackState } from '../types';
import {
  STACK_C_CODE,
  arrayStackFrom,
  arrayStackPeek,
  arrayStackPop,
  arrayStackPush,
  bracketMatchDemo,
  emptyArrayStack,
  emptyLinkedStack,
  linkedStackFrom,
  linkedStackPop,
  linkedStackPush,
} from './stack';

function finalStack(outcome: { steps: { afterState: StackState }[] }): StackState {
  const last = outcome.steps[outcome.steps.length - 1];
  if (last === undefined) throw new Error('没有步骤');
  return last.afterState;
}

function finalList(outcome: { steps: { afterState: ListState }[] }): ListState {
  const last = outcome.steps[outcome.steps.length - 1];
  if (last === undefined) throw new Error('没有步骤');
  return last.afterState;
}

function stackVals(s: StackState): string[] {
  return s.frames.map((f) => f.label);
}

function listVals(s: ListState): number[] {
  return s.nodes.filter((n) => !n.freed).map((n) => n.value ?? 0);
}

function assertCodeLines(steps: { codeLine: number }[]): void {
  for (const [i, step] of steps.entries()) {
    expect(step.codeLine, `step${i}`).toBeLessThanOrEqual(STACK_C_CODE.length);
    expect(step.codeLine, `step${i}`).toBeGreaterThanOrEqual(0);
  }
}

describe('顺序栈 push/pop/peek', () => {
  it('push 依次入栈', () => {
    let s = finalStack(arrayStackFrom([]));
    s = finalStack(arrayStackPush(s, 1));
    s = finalStack(arrayStackPush(s, 2));
    s = finalStack(arrayStackPush(s, 3));
    expect(stackVals(s)).toEqual(['1', '2', '3']);
  });

  it('pop 弹出栈顶（LIFO）', () => {
    const s = finalStack(arrayStackFrom([1, 2, 3]));
    const out = arrayStackPop(s);
    expect(out.ok).toBe(true);
    expect(out.steps[out.steps.length - 1]?.title).toContain('3');
    expect(stackVals(finalStack(out))).toEqual(['1', '2']);
    assertCodeLines(out.steps);
  });

  it('空栈 pop / peek 失败', () => {
    const s = emptyArrayStack();
    expect(arrayStackPop(s).ok).toBe(false);
    expect(arrayStackPeek(s).ok).toBe(false);
    const last = arrayStackPop(s).steps.slice(-1)[0]!;
    expect(last.type).toBe('error');
    expect(last.title).toContain('空栈');
  });

  it('栈满 overflow 报错（capacity=3）', () => {
    const s = finalStack(arrayStackFrom([1, 2, 3], 3));
    const out = arrayStackPush(s, 4);
    expect(out.ok).toBe(false);
    const last = out.steps[out.steps.length - 1]!;
    expect(last.type).toBe('error');
    expect(last.title).toContain('栈满');
    expect(stackVals(finalStack(out))).toEqual(['1', '2', '3']);
  });

  it('peek 不弹出', () => {
    const s = finalStack(arrayStackFrom([5, 6]));
    const out = arrayStackPeek(s);
    expect(out.ok).toBe(true);
    expect(out.steps[0]?.title).toContain('6');
    expect(stackVals(finalStack(out))).toEqual(['5', '6']);
  });
});

describe('链栈', () => {
  it('push 头插 / pop 头删', () => {
    let s = finalList(linkedStackFrom([1, 2]));
    s = finalList(linkedStackPush(s, 3));
    expect(listVals(s)).toEqual([3, 2, 1]); // 栈顶在前
    const out = linkedStackPop(s);
    expect(out.ok).toBe(true);
    expect(listVals(finalList(out))).toEqual([2, 1]);
    assertCodeLines(out.steps);
  });

  it('空链栈 pop 失败', () => {
    expect(linkedStackPop(emptyLinkedStack()).ok).toBe(false);
  });

  it('pop 到空再 pop 失败', () => {
    let s = finalList(linkedStackFrom([9]));
    s = finalList(linkedStackPop(s));
    expect(listVals(s)).toEqual([]);
    expect(linkedStackPop(s).ok).toBe(false);
  });

  it('pop 包含 free 步骤', () => {
    const out = linkedStackPop(finalList(linkedStackFrom([1, 2])));
    expect(out.steps.some((st) => st.type === 'free')).toBe(true);
  });
});

describe('括号匹配', () => {
  it('正确配对', () => {
    for (const ok of ['()', '([]{})', '{[()]}', '', '(a[b]c)']) {
      const r = bracketMatchDemo(ok);
      expect(r.matched, ok).toBe(true);
    }
  });

  it('右括号多了', () => {
    const r = bracketMatchDemo('())');
    expect(r.matched).toBe(false);
    expect(r.reason).toContain('右括号多了');
  });

  it('左括号多了', () => {
    const r = bracketMatchDemo('(()');
    expect(r.matched).toBe(false);
    expect(r.reason).toContain('左括号多了');
  });

  it('类型不匹配', () => {
    const r = bracketMatchDemo('(]');
    expect(r.matched).toBe(false);
    expect(r.reason).toContain('类型不匹配');
  });

  it('嵌套 {[()]} 步骤含入栈与弹栈', () => {
    const r = bracketMatchDemo('{[()]}');
    expect(r.steps.filter((s) => s.type === 'insert')).toHaveLength(3);
    expect(r.steps.filter((s) => s.type === 'delete')).toHaveLength(3);
    assertCodeLines(r.steps);
  });
});

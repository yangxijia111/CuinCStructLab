import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Step } from '../../core/types';
import { BASE_INTERVAL_MS, SPEEDS, usePlayback } from './usePlayback';
import { listFrom, listPushFront } from '../../core/data-structures/linked-list';
import { seqListFrom, seqListInsert } from '../../core/data-structures/seqlist';

function makeSteps(n: number): Step<{ v: number }>[] {
  const steps: Step<{ v: number }>[] = [];
  for (let i = 0; i < n; i++) {
    steps.push({
      id: i,
      type: 'info',
      title: `步骤 ${i}`,
      description: '',
      codeLine: 0,
      variables: [],
      memory: { cells: [], simulated: true },
      callStack: [],
      highlight: [],
      beforeState: { v: i },
      afterState: { v: i + 1 },
    });
  }
  return steps;
}

describe('usePlayback 基本控制', () => {
  it('初始 index=-1，渲染 steps[0].beforeState', () => {
    const { result } = renderHook(() => usePlayback(makeSteps(3)));
    expect(result.current.index).toBe(-1);
    expect(result.current.total).toBe(3);
    expect(result.current.currentState).toEqual({ v: 0 });
    expect(result.current.currentStep).toBeNull();
  });

  it('next 前进；prev 可回到 -1', () => {
    const { result } = renderHook(() => usePlayback(makeSteps(2)));
    act(() => {
      expect(result.current.next()).toBe(true);
    });
    expect(result.current.index).toBe(0);
    expect(result.current.currentState).toEqual({ v: 1 });
    act(() => {
      expect(result.current.next()).toBe(true);
    });
    expect(result.current.index).toBe(1);
    // 末尾再 next：不动且返回 false
    act(() => {
      expect(result.current.next()).toBe(false);
    });
    expect(result.current.index).toBe(1);
    // prev 两次回到 -1，第三次不动
    act(() => {
      expect(result.current.prev()).toBe(true);
    });
    act(() => {
      expect(result.current.prev()).toBe(true);
    });
    expect(result.current.index).toBe(-1);
    act(() => {
      expect(result.current.prev()).toBe(false);
    });
  });

  it('restart 回到 -1', () => {
    const { result } = renderHook(() => usePlayback(makeSteps(3)));
    act(() => {
      result.current.jumpTo(2);
      result.current.restart();
    });
    expect(result.current.index).toBe(-1);
  });

  it('jumpTo 夹取范围并暂停', () => {
    const { result } = renderHook(() => usePlayback(makeSteps(5)));
    act(() => {
      result.current.play();
    });
    act(() => {
      result.current.jumpTo(2);
    });
    expect(result.current.index).toBe(2);
    expect(result.current.playing).toBe(false);
    act(() => {
      result.current.jumpTo(999);
    });
    expect(result.current.index).toBe(4);
    act(() => {
      result.current.jumpTo(-99);
    });
    expect(result.current.index).toBe(-1);
  });

  it('空步骤序列安全', () => {
    const { result } = renderHook(() => usePlayback());
    expect(result.current.total).toBe(0);
    expect(result.current.currentState).toBeNull();
    act(() => {
      result.current.play();
    });
    expect(result.current.playing).toBe(false);
    act(() => {
      expect(result.current.next()).toBe(false);
    });
  });

  it('setSteps 替换并复位', () => {
    const { result } = renderHook(() => usePlayback(makeSteps(3)));
    act(() => {
      result.current.jumpTo(1);
      result.current.setSteps(makeSteps(2));
    });
    expect(result.current.total).toBe(2);
    expect(result.current.index).toBe(-1);
  });

  it('currentStep 与 index 对应', () => {
    const { result } = renderHook(() => usePlayback(makeSteps(3)));
    act(() => {
      result.current.jumpTo(1);
    });
    expect(result.current.currentStep?.id).toBe(1);
  });
});

describe('usePlayback 播放定时', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('play 自动推进，到末尾自动暂停', () => {
    const { result } = renderHook(() => usePlayback(makeSteps(3)));
    act(() => {
      result.current.play();
    });
    expect(result.current.playing).toBe(true);
    act(() => {
      vi.advanceTimersByTime(BASE_INTERVAL_MS);
    });
    expect(result.current.index).toBe(0);
    act(() => {
      vi.advanceTimersByTime(BASE_INTERVAL_MS);
    });
    expect(result.current.index).toBe(1);
    act(() => {
      vi.advanceTimersByTime(BASE_INTERVAL_MS);
    });
    expect(result.current.index).toBe(2);
    // 到末尾后暂停，不再推进
    act(() => {
      vi.advanceTimersByTime(BASE_INTERVAL_MS * 3);
    });
    expect(result.current.index).toBe(2);
    expect(result.current.playing).toBe(false);
  });

  it('在末尾 play 从头开始', () => {
    const { result } = renderHook(() => usePlayback(makeSteps(2)));
    act(() => {
      result.current.jumpTo(1);
      result.current.play();
    });
    expect(result.current.index).toBe(-1);
    expect(result.current.playing).toBe(true);
  });

  it('速度倍率生效（2x 间隔减半）', () => {
    const { result } = renderHook(() => usePlayback(makeSteps(2)));
    act(() => {
      result.current.setSpeed(2);
      result.current.play();
    });
    act(() => {
      vi.advanceTimersByTime(BASE_INTERVAL_MS / 2);
    });
    expect(result.current.index).toBe(0);
  });

  it('pause 停止推进', () => {
    const { result } = renderHook(() => usePlayback(makeSteps(3)));
    act(() => {
      result.current.play();
    });
    act(() => {
      result.current.pause();
    });
    expect(result.current.playing).toBe(false);
    act(() => {
      vi.advanceTimersByTime(BASE_INTERVAL_MS * 2);
    });
    expect(result.current.index).toBe(-1);
  });

  it('SPEEDS 档位为 0.25/0.5/1/2/4', () => {
    expect([...SPEEDS]).toEqual([0.25, 0.5, 1, 2, 4]);
  });
});

describe('与真实步骤流的集成', () => {
  it('链表插入：每步状态可用且高亮随步变化', () => {
    const built = listFrom([10, 20]);
    const push = listPushFront(built.steps[0]!.afterState, 5);
    const { result } = renderHook(() => usePlayback(push.steps));
    const total = push.steps.length;
    for (let i = 0; i < total; i++) {
      act(() => {
        result.current.next();
      });
    }
    expect(result.current.index).toBe(total - 1);
    // 终态：5 是第一个数据节点（跳过哨兵）
    const nodes = result.current.currentState?.nodes ?? [];
    expect(nodes.find((n) => n.value !== null && !n.floating)?.value).toBe(5);
  });

  it('Previous 后再 Forward 状态一致（快照确定性）', () => {
    const built = seqListFrom([10, 20, 30]);
    const out = seqListInsert(built.steps[0]!.afterState, 1, 15);
    const { result } = renderHook(() => usePlayback(out.steps));
    const states: unknown[] = [];
    for (let i = 0; i < out.steps.length; i++) {
      act(() => {
        result.current.next();
      });
      states.push(result.current.currentState);
    }
    // 回退到底
    for (let i = 0; i < out.steps.length; i++) {
      act(() => {
        result.current.prev();
      });
    }
    // 再前进一遍，与第一次完全一致
    for (let i = 0; i < out.steps.length; i++) {
      act(() => {
        result.current.next();
      });
      expect(result.current.currentState).toEqual(states[i]);
    }
  });
});

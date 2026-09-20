/**
 * 播放控制器（VISUALIZATION_SPEC §4）。
 * 快照法：渲染第 i 步 = steps[i].afterState；index === -1 渲染 steps[0].beforeState。
 * 回退/跳转 O(1) 且确定性，绝不"猜测"状态。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Step } from '../../core/types';
import { clamp } from '../../core/utils/misc';

export const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];
/** 基准步进间隔（毫秒），实际间隔 = BASE_INTERVAL_MS / speed */
export const BASE_INTERVAL_MS = 1200;

export interface PlaybackController<S> {
  /** 当前步下标；-1 表示尚未开始（初始态） */
  index: number;
  playing: boolean;
  speed: Speed;
  /** 总步数 */
  total: number;
  /** 当前步（index = -1 时为 null） */
  currentStep: Step<S> | null;
  /** 当前应渲染的状态（index=-1 → steps[0].beforeState） */
  currentState: S | null;
  play(): void;
  pause(): void;
  toggle(): void;
  /** 前进一步；到末尾时自动暂停。返回是否真的移动了 */
  next(): boolean;
  /** 后退一步；最低到 -1（初始态）。返回是否真的移动了 */
  prev(): boolean;
  restart(): void;
  /** 跳到指定步（夹取到 [-1, total-1]）；跳转时暂停 */
  jumpTo(target: number): void;
  setSpeed(speed: Speed): void;
  /** 替换步骤序列并复位 */
  setSteps(steps: Step<S>[]): void;
}

export function usePlayback<S>(initialSteps: Step<S>[] = []): PlaybackController<S> {
  const [steps, setStepsState] = useState<Step<S>[]>(initialSteps);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState<Speed>(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = steps.length;

  const currentStep = useMemo(() => (index >= 0 ? (steps[index] ?? null) : null), [index, steps]);

  const currentState = useMemo<S | null>(() => {
    if (steps.length === 0) return null;
    if (index < 0) return steps[0]?.beforeState ?? null;
    return steps[index]?.afterState ?? null;
  }, [index, steps]);

  const pause = useCallback((): void => {
    setPlaying(false);
  }, []);

  const next = useCallback((): boolean => {
    if (index >= steps.length - 1) {
      setPlaying(false);
      return false;
    }
    setIndex(index + 1);
    return true;
  }, [index, steps.length]);

  const prev = useCallback((): boolean => {
    if (index < 0) return false;
    setIndex(index - 1);
    return true;
  }, [index]);

  const restart = useCallback((): void => {
    setPlaying(false);
    setIndex(-1);
  }, []);

  const jumpTo = useCallback(
    (target: number): void => {
      setPlaying(false);
      setIndex(clamp(Math.round(target), -1, steps.length - 1));
    },
    [steps.length],
  );

  const play = useCallback((): void => {
    if (steps.length === 0) return;
    // 已经在末尾：从头播放
    setIndex((cur) => (cur >= steps.length - 1 ? -1 : cur));
    setPlaying(true);
  }, [steps.length]);

  const toggle = useCallback((): void => {
    if (playing) pause();
    else play();
  }, [pause, play, playing]);

  const setSpeed = useCallback((s: Speed): void => {
    setSpeedState(s);
  }, []);

  const setSteps = useCallback((newSteps: Step<S>[]): void => {
    setPlaying(false);
    setStepsState(newSteps);
    setIndex(-1);
  }, []);

  // 播放循环：递归 setTimeout，速度即时生效
  useEffect(() => {
    if (!playing) return;
    if (index >= steps.length - 1) return; // 已在末尾：不推进（play/next 已保证会暂停）
    timerRef.current = setTimeout(
      () => {
        setIndex((cur) => Math.min(cur + 1, steps.length - 1));
        // 推进后到达末尾则自动暂停
        if (index + 1 >= steps.length - 1) setPlaying(false);
      },
      BASE_INTERVAL_MS / speed,
    );
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [playing, index, speed, steps.length]);

  // 组件卸载清理
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    index,
    playing,
    speed,
    total,
    currentStep,
    currentState,
    play,
    pause,
    toggle,
    next,
    prev,
    restart,
    jumpTo,
    setSpeed,
    setSteps,
  };
}

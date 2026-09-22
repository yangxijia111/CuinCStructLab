/**
 * 可复现随机数（DIFFERENTIAL_TEST_SPEC §6）：mulberry32（32 位确定性，跨平台一致）。
 * 禁止在差分用例中使用 Math.random() 或时间做种子。
 */

export interface Rng {
  /** [0, 1) 均匀浮点 */
  next(): number;
  /** [min, max] 闭区间整数 */
  int(min: number, max: number): number;
  /** 从数组选一个 */
  pick<T>(arr: readonly T[]): T;
  /** boolean，true 概率 p */
  bool(p: number): boolean;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min: number, max: number): number {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(next() * arr.length)] as T;
    },
    bool(p: number): boolean {
      return next() < p;
    },
  };
}

/** 随机整数数组（值域 [-999, 999]，长度 [minLen, maxLen]） */
export function randomValues(rng: Rng, minLen: number, maxLen: number, minVal = -999, maxVal = 999): number[] {
  const n = rng.int(minLen, maxLen);
  return Array.from({ length: n }, () => rng.int(minVal, maxVal));
}

/** 升序整数数组（可含重复段） */
export function sortedValues(rng: Rng, n: number, minVal = -999, maxVal = 999): number[] {
  const a = Array.from({ length: n }, () => rng.int(minVal, maxVal));
  a.sort((x, y) => x - y);
  return a;
}

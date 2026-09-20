/**
 * 通用纯工具函数（core 层，禁止依赖任何 UI / 平台模块）。
 */

/** 将 n 夹取到闭区间 [lo, hi] */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** 判断两个数字数组逐元素相等 */
export function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * id 分配器工厂：为可视化元素（节点/格子/边）生成稳定 id。
 * 每次操作开始时新建一个分配器，保证同一次操作内 id 递增且唯一，
 * 不同操作之间互不影响（回退靠快照，不依赖全局计数器）。
 */
export interface IdAllocator {
  next(): number;
}

export function makeIdAllocator(start = 0): IdAllocator {
  let current = start;
  return {
    next(): number {
      const value = current;
      current += 1;
      return value;
    },
  };
}

/** 固定种子的伪随机数（mulberry32），保证测试可复现 */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

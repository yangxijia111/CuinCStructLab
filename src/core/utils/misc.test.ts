import { describe, it, expect } from 'vitest';
import { arraysEqual, clamp, makeIdAllocator, seededRandom } from './misc';

describe('clamp', () => {
  it('夹取到区间内', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('单点区间', () => {
    expect(clamp(3, 2, 2)).toBe(2);
  });
});

describe('arraysEqual', () => {
  it('相等与不等', () => {
    expect(arraysEqual([], [])).toBe(true);
    expect(arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(arraysEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(arraysEqual([1, 3], [1, 2])).toBe(false);
  });
});

describe('makeIdAllocator', () => {
  it('从 start 开始递增', () => {
    const alloc = makeIdAllocator(7);
    expect(alloc.next()).toBe(7);
    expect(alloc.next()).toBe(8);
  });

  it('不同分配器互不影响', () => {
    const a = makeIdAllocator();
    const b = makeIdAllocator();
    a.next();
    a.next();
    expect(b.next()).toBe(0);
  });
});

describe('seededRandom', () => {
  it('同种子序列一致', () => {
    const r1 = seededRandom(42);
    const r2 = seededRandom(42);
    const s1 = Array.from({ length: 5 }, () => r1());
    const s2 = Array.from({ length: 5 }, () => r2());
    expect(s1).toEqual(s2);
  });

  it('值域在 [0,1)', () => {
    const r = seededRandom(1);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

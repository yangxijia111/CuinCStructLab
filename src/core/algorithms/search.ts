/**
 * 查找算法：顺序查找 + 二分查找（含"必须有序"前提演示）（DATA_STRUCTURE_SPEC §9）。
 */
import { StepRecorder, indexVar, intVar } from '../recorder';
import type { ArrayState, Step, VizOutcome } from '../types';

export const SEARCH_C_CODE: string[] = [
  '/* 顺序查找：从头到尾挨个看 */',
  'int linearSearch(int a[], int n, int target) {',
  '    for (int i = 0; i < n; i++) {',
  '        if (a[i] == target) {',
  '            return i;      /* 找到，返回下标 */',
  '        }',
  '    }',
  '    return -1;             /* 找不到 */',
  '}',
  '',
  '/* 二分查找：要求数组已经升序！每次砍掉一半 */',
  'int binarySearch(int a[], int n, int target) {',
  '    int low = 0, high = n - 1;',
  '    while (low <= high) {',
  '        int mid = low + (high - low) / 2;   /* 防溢出写法 */',
  '        if (a[mid] == target) {',
  '            return mid;   /* 正中目标 */',
  '        } else if (a[mid] < target) {',
  '            low = mid + 1;  /* 目标只在右半 */',
  '        } else {',
  '            high = mid - 1; /* 目标只在左半 */',
  '        }',
  '    }',
  '    return -1;             /* low > high：不存在 */',
  '}',
];

function toArrayState(arr: number[]): ArrayState {
  return {
    kind: 'array',
    label: 'a',
    cells: arr.map((v, i) => ({ id: `a${i}`, value: v, flags: [] })),
    size: arr.length,
    capacity: arr.length,
    nextAddr: 0x8000,
    seq: arr.length,
  };
}

/* ============ 顺序查找 ============ */

export function linearSearchSteps(arr: number[], target: number): VizOutcome<ArrayState> {
  const rec = new StepRecorder<ArrayState>(toArrayState(arr));
  rec.record({
    type: 'init',
    title: `顺序查找 ${target}：从下标 0 开始挨个比较`,
    description: '不要求数组有序，但最坏要把整个数组看一遍：O(n)。',
    codeLine: 2,
    variables: [intVar('target', target)],
  });
  for (let i = 0; i < arr.length; i++) {
    const hit = arr[i] === target;
    rec.record({
      type: hit ? 'visit' : 'compare',
      title: `a[${i}] == ${target} ？当前 a[${i}] = ${arr[i]}${hit ? `，命中！返回下标 ${i}` : '，不等'}`,
      description: hit ? `找到目标，返回下标 ${i}。` : '不相等，继续看下一个。',
      codeLine: 4,
      variables: [indexVar('i', i), intVar('target', target)],
      highlight: [`a${i}`],
      metrics: { comparisons: i + 1, swaps: 0 },
      mutate: (s) => {
        for (const c of s.cells) c.flags = [];
        s.cells[i]!.flags = [hit ? 'sorted' : 'comparing'];
      },
    });
    if (hit) return rec.finish();
  }
  rec.record({
    type: 'info',
    title: `看到末尾也没有 ${target}，返回 -1`,
    description: `共比较 ${arr.length} 次。`,
    codeLine: 8,
    variables: [intVar('target', target)],
    metrics: { comparisons: arr.length, swaps: 0 },
    mutate: (s) => {
      for (const c of s.cells) c.flags = [];
    },
  });
  return rec.finish();
}

/* ============ 二分查找 ============ */

export function binarySearchSteps(arr: number[], target: number, assumeSorted = true): VizOutcome<ArrayState> {
  const rec = new StepRecorder<ArrayState>(toArrayState(arr));
  const sorted = [...arr].every((v, i) => i === 0 || arr[i - 1]! <= v);

  rec.record({
    type: 'init',
    title: `二分查找 ${target}：前提是数组升序`,
    description: sorted
      ? '数组已升序，可以使用二分查找。每次比较排除一半区间：O(log n)。'
      : '数组不是升序的！二分查找的前提被破坏，结果不可信——这是最经典的错误用法。下面继续演示会发生什么。',
    beginnerNote: sorted
      ? '二分查找的每一步依赖"中点左边的都 ≤ 中点、右边的都 ≥ 中点"这一事实。数组无序时这个推理不成立。'
      : '记住结论：对无序数组用二分查找，可能"路过"目标却返回 -1。必须先排序，或改用顺序查找。',
    codeLine: 12,
    variables: [intVar('target', target)],
    mutate: (s) => {
      if (!sorted) {
        for (const c of s.cells) c.flags = ['removed'];
      }
    },
  });
  if (!assumeSorted && !sorted) {
    rec.fail('数组无序', '二分查找要求数据有序。请先排序，或使用顺序查找。', 12);
    return rec.finish();
  }

  let low = 0;
  let high = arr.length - 1;
  let round = 0;
  while (low <= high) {
    round++;
    const mid = low + ((high - low) >> 1);
    rec.record({
      type: 'compare',
      title: `第 ${round} 轮：low=${low}, high=${high}，mid = (${low}+${high})/2 = ${mid}，看 a[${mid}] = ${arr[mid]}`,
      description: `排除区间外元素后，候选范围缩小到 [${low}, ${high}] 共 ${high - low + 1} 个。`,
      codeLine: 15,
      variables: [indexVar('low', low), indexVar('high', high), indexVar('mid', mid), intVar('target', target)],
      highlight: [`a${mid}`],
      metrics: { comparisons: round, swaps: 0 },
      mutate: (s) => {
        for (const [k, c] of s.cells.entries()) {
          c.flags = k < low || k > high ? ['removed'] : [];
        }
        s.cells[mid]!.flags = ['comparing'];
        s.range = [low, high];
      },
    });
    if (arr[mid] === target) {
      rec.record({
        type: 'visit',
        title: `a[${mid}] == ${target}，找到！返回下标 ${mid}`,
        description: `共比较 ${round} 次。顺序查找最坏要 ${arr.length} 次，二分只要 ${round} 次。`,
        codeLine: 17,
        variables: [indexVar('mid', mid)],
        highlight: [`a${mid}`],
        mutate: (s) => {
          for (const c of s.cells) c.flags = [];
          s.cells[mid]!.flags = ['sorted'];
        },
      });
      return rec.finish();
    }
    if (arr[mid]! < target) {
      rec.record({
        type: 'assign',
        title: `a[${mid}]=${arr[mid]} < ${target}：目标只可能在右半，low = mid+1 = ${mid + 1}`,
        description: `左半 [${low}, ${mid}] 整体被排除（它们都 ≤ ${arr[mid]} < ${target}）。`,
        codeLine: 20,
        variables: [indexVar('low', mid + 1), indexVar('high', high)],
        metrics: { comparisons: round, swaps: 0 },
        mutate: (s) => {
          for (const [k, c] of s.cells.entries()) {
            c.flags = k < low || k > high ? ['removed'] : [];
          }
          s.range = [mid + 1, high];
        },
      });
      low = mid + 1;
    } else {
      rec.record({
        type: 'assign',
        title: `a[${mid}]=${arr[mid]} > ${target}：目标只可能在左半，high = mid-1 = ${mid - 1}`,
        description: `右半 [${mid}, ${high}] 整体被排除。`,
        codeLine: 22,
        variables: [indexVar('low', low), indexVar('high', mid - 1)],
        metrics: { comparisons: round, swaps: 0 },
        mutate: (s) => {
          for (const [k, c] of s.cells.entries()) {
            c.flags = k < low || k > high ? ['removed'] : [];
          }
          s.range = [low, mid - 1];
        },
      });
      high = mid - 1;
    }
  }

  rec.record({
    type: 'info',
    title: `low(${low}) > high(${high})：区间为空，${target} 不存在，返回 -1`,
    description: `共比较 ${round} 次。`,
    codeLine: 25,
    variables: [indexVar('low', low), indexVar('high', high)],
    mutate: (s) => {
      for (const c of s.cells) c.flags = [];
      s.range = undefined;
    },
  });
  return rec.finish();
}

/** 纯逻辑版（供测试/复用）：返回下标或 -1 */
export function binarySearchDirect(arr: number[], target: number): number {
  let low = 0;
  let high = arr.length - 1;
  while (low <= high) {
    const mid = low + ((high - low) >> 1);
    if (arr[mid] === target) return mid;
    if (arr[mid]! < target) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}

export type SearchStep = Step<ArrayState>;

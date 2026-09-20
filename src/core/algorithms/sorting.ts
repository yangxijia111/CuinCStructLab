/**
 * 7 种排序：纯函数版（sortDirect）与步骤版（sortWithSteps）。
 * 步骤版状态为 ArrayState：comparing/swapping/sorted/pivot/inRange 标记 + comparisons/swaps 计数。
 */
import { StepRecorder, intVar } from '../recorder';
import type { ArrayState, Step } from '../types';
import type { SortId } from './sorting-codes';

/* ============ 通用工具 ============ */

interface Counters {
  comparisons: number;
  swaps: number;
}

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

/** 当前数组值（从 recorder 状态读） */
function valuesOf(state: ArrayState): number[] {
  return state.cells.map((c) => c.value ?? 0);
}

/* ============ 纯函数版 ============ */

export function sortDirect(id: SortId, arr: number[]): number[] {
  const a = [...arr];
  switch (id) {
    case 'bubble':
      bubblePlain(a);
      break;
    case 'selection':
      selectionPlain(a);
      break;
    case 'insertion':
      insertionPlain(a, 1, a.length);
      break;
    case 'shell':
      for (let gap = a.length >> 1; gap > 0; gap >>= 1) insertionPlain(a, gap, a.length);
      break;
    case 'merge': {
      const tmp = new Array<number>(a.length);
      mergePlain(a, tmp, 0, a.length - 1);
      break;
    }
    case 'quick':
      quickPlain(a, 0, a.length - 1);
      break;
    case 'heap':
      heapPlain(a);
      break;
  }
  return a;
}

function bubblePlain(a: number[]): void {
  for (let i = 0; i < a.length - 1; i++) {
    let swapped = false;
    for (let j = 0; j < a.length - 1 - i; j++) {
      if (a[j]! > a[j + 1]!) {
        [a[j], a[j + 1]] = [a[j + 1]!, a[j]!];
        swapped = true;
      }
    }
    if (!swapped) break;
  }
}

function selectionPlain(a: number[]): void {
  for (let i = 0; i < a.length - 1; i++) {
    let min = i;
    for (let j = i + 1; j < a.length; j++) if (a[j]! < a[min]!) min = j;
    if (min !== i) [a[i], a[min]] = [a[min]!, a[i]!];
  }
}

/** 插入排序（可带间隔，供 shell 复用） */
function insertionPlain(a: number[], gap: number, n: number): void {
  for (let i = gap; i < n; i++) {
    const key = a[i]!;
    let j = i - gap;
    while (j >= 0 && a[j]! > key) {
      a[j + gap] = a[j]!;
      j -= gap;
    }
    a[j + gap] = key;
  }
}

function mergePlain(a: number[], tmp: number[], left: number, right: number): void {
  if (left >= right) return;
  const mid = (left + right) >> 1;
  mergePlain(a, tmp, left, mid);
  mergePlain(a, tmp, mid + 1, right);
  let i = left;
  let j = mid + 1;
  let k = left;
  while (i <= mid && j <= right) tmp[k++] = a[i]! <= a[j]! ? a[i++]! : a[j++]!;
  while (i <= mid) tmp[k++] = a[i++]!;
  while (j <= right) tmp[k++] = a[j++]!;
  for (k = left; k <= right; k++) a[k] = tmp[k]!;
}

function quickPlain(a: number[], low: number, high: number): void {
  if (low >= high) return;
  const p = partitionPlain(a, low, high);
  quickPlain(a, low, p - 1);
  quickPlain(a, p + 1, high);
}

function partitionPlain(a: number[], low: number, high: number): number {
  const pivot = a[high]!;
  let i = low - 1;
  for (let j = low; j < high; j++) {
    if (a[j]! < pivot) {
      i++;
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
  }
  [a[i + 1], a[high]] = [a[high]!, a[i + 1]!];
  return i + 1;
}

function heapPlain(a: number[]): void {
  const n = a.length;
  const down = (i: number, size: number): void => {
    for (;;) {
      let best = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < size && a[l]! > a[best]!) best = l;
      if (r < size && a[r]! > a[best]!) best = r;
      if (best === i) break;
      [a[i], a[best]] = [a[best]!, a[i]!];
      i = best;
    }
  };
  for (let i = (n >> 1) - 1; i >= 0; i--) down(i, n);
  for (let end = n - 1; end > 0; end--) {
    [a[0], a[end]] = [a[end]!, a[0]!];
    down(0, end);
  }
}

/* ============ 步骤版 ============ */

export interface SortStepsResult {
  steps: Step<ArrayState>[];
  /** 排序结果 */
  sorted: number[];
  meta: { comparisons: number; swaps: number };
}

/** 步骤记录上下文 */
interface Ctx {
  rec: StepRecorder<ArrayState>;
  counters: Counters;
}

function makeRecorder(arr: number[], algoName: string): Ctx {
  const rec = new StepRecorder<ArrayState>(toArrayState(arr));
  rec.record({
    type: 'init',
    title: `${algoName}：开始`,
    description: `输入数组 [${arr.join(', ')}]，共 ${arr.length} 个元素。`,
    codeLine: 2,
  });
  return { rec, counters: { comparisons: 0, swaps: 0 } };
}

/** 记一步（设置 flags 由调用方在 mutate 完成） */
function record(
  ctx: Ctx,
  input: {
    type: Step<ArrayState>['type'];
    title: string;
    description: string;
    codeLine: number;
    highlight?: string[];
    beginnerNote?: string;
    mutate?: (s: ArrayState) => void;
  },
): void {
  ctx.rec.record({
    ...input,
    highlight: input.highlight ?? [],
    metrics: { comparisons: ctx.counters.comparisons, swaps: ctx.counters.swaps },
    variables: [intVar('比较', ctx.counters.comparisons), intVar('交换/移动', ctx.counters.swaps)],
    mutate: (s) => {
      // 每步重置标记，保留 sorted（由调用方管理 sorted 集合——这里用简单方案：调用方显式设置）
      input.mutate?.(s);
    },
  });
}

function clearFlags(s: ArrayState, keepSorted = true): void {
  for (const c of s.cells) {
    c.flags = keepSorted ? c.flags.filter((f) => f === 'sorted') : [];
  }
}

function mark(s: ArrayState, ids: string[], flag: ArrayState['cells'][number]['flags'][number]): void {
  for (const c of s.cells) {
    if (ids.includes(c.id)) c.flags = [...c.flags.filter((f) => f === 'sorted'), flag];
  }
}

/* ---------- 冒泡 ---------- */

function bubbleSteps(arr: number[]): SortStepsResult {
  const ctx = makeRecorder(arr, '冒泡排序');
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    record(ctx, {
      type: 'info',
      title: `第 ${i + 1} 趟：把未排序部分的最大值冒到位置 ${n - 1 - i}`,
      description: `未排序区间 [0, ${n - 1 - i}]，有序区已有 ${i} 个（在末尾）。`,
      codeLine: 3,
      mutate: (s) => {
        clearFlags(s);
        for (let k = n - i; k < n; k++) s.cells[k]!.flags = ['sorted'];
      },
    });
    for (let j = 0; j < n - 1 - i; j++) {
      ctx.counters.comparisons++;
      const x = valuesOf(ctx.rec.state);
      if (x[j]! > x[j + 1]!) {
        ctx.counters.swaps++;
        swapped = true;
        record(ctx, {
          type: 'swap',
          title: `a[${j}]=${x[j]} > a[${j + 1}]=${x[j + 1]}：交换`,
          description: `前面的更大，交换位置，大值往后冒。`,
          codeLine: 6,
          highlight: [`a${j}`, `a${j + 1}`],
          mutate: (s) => {
            clearFlags(s);
            for (let k = n - i; k < n; k++) s.cells[k]!.flags = ['sorted'];
            s.cells[j]!.flags = ['swapping'];
            s.cells[j + 1]!.flags = ['swapping'];
            const t = s.cells[j]!.value;
            s.cells[j]!.value = s.cells[j + 1]!.value;
            s.cells[j + 1]!.value = t;
          },
        });
      } else {
        record(ctx, {
          type: 'compare',
          title: `a[${j}]=${x[j]} <= a[${j + 1}]=${x[j + 1]}：不交换`,
          description: '顺序正确，继续看下一对。',
          codeLine: 6,
          highlight: [`a${j}`, `a${j + 1}`],
          mutate: (s) => {
            clearFlags(s);
            for (let k = n - i; k < n; k++) s.cells[k]!.flags = ['sorted'];
            s.cells[j]!.flags = ['comparing'];
            s.cells[j + 1]!.flags = ['comparing'];
          },
        });
      }
    }
    if (!swapped) {
      record(ctx, {
        type: 'info',
        title: '一整趟没有交换：数组已经有序，提前结束',
        description: '冒泡排序对已有序输入可以达到 O(n) 的优化。',
        codeLine: 15,
        mutate: (s) => {
          for (const c of s.cells) c.flags = ['sorted'];
        },
      });
      break;
    }
  }
  finish(ctx, '冒泡');
  return result(ctx);
}

/* ---------- 选择 ---------- */

function selectionSteps(arr: number[]): SortStepsResult {
  const ctx = makeRecorder(arr, '选择排序');
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    let min = i;
    record(ctx, {
      type: 'info',
      title: `第 ${i + 1} 轮：在 [${i}, ${n - 1}] 里找最小值`,
      description: `前 ${i} 个已就位。先假设 a[${i}] 是最小的。`,
      codeLine: 3,
      mutate: (s) => {
        clearFlags(s);
        for (let k = 0; k < i; k++) s.cells[k]!.flags = ['sorted'];
        s.cells[i]!.flags = ['pivot'];
      },
    });
    for (let j = i + 1; j < n; j++) {
      ctx.counters.comparisons++;
      const x = valuesOf(ctx.rec.state);
      const smaller = x[j]! < x[min]!;
      if (smaller) min = j;
      record(ctx, {
        type: 'compare',
        title: `a[${j}]=${x[j]} ${smaller ? '<' : '>='} 当前最小 a[${min}]=${x[min]}`,
        description: smaller ? `发现更小的，最小值下标更新为 ${j}。` : '不是更小，继续。',
        codeLine: 7,
        highlight: [`a${j}`, `a${min}`],
        mutate: (s) => {
          clearFlags(s);
          for (let k = 0; k < i; k++) s.cells[k]!.flags = ['sorted'];
          s.cells[min]!.flags = ['pivot'];
          s.cells[j]!.flags = ['comparing'];
        },
      });
    }
    if (min !== i) {
      ctx.counters.swaps++;
      const x = valuesOf(ctx.rec.state);
      record(ctx, {
        type: 'swap',
        title: `本轮最小 a[${min}]=${x[min]} 与 a[${i}]=${x[i]} 交换`,
        description: `最小值放到位置 ${i}，就位。`,
        codeLine: 11,
        highlight: [`a${i}`, `a${min}`],
        mutate: (s) => {
          clearFlags(s);
          const t = s.cells[i]!.value;
          s.cells[i]!.value = s.cells[min]!.value;
          s.cells[min]!.value = t;
          s.cells[i]!.flags = ['sorted'];
          s.cells[min]!.flags = ['swapping'];
        },
      });
    } else {
      record(ctx, {
        type: 'info',
        title: `a[${i}] 本来就是本轮最小，无需交换`,
        description: '选择排序交换次数最多 n-1 次，是交换次数最少的排序之一。',
        codeLine: 10,
        mutate: (s) => {
          clearFlags(s);
          s.cells[i]!.flags = ['sorted'];
        },
      });
    }
  }
  finish(ctx, '选择');
  return result(ctx);
}

/* ---------- 插入（含间隔，供希尔复用） ---------- */

function insertionSteps(arr: number[], gap: number, ctx?: Ctx, shellRound?: number): SortStepsResult | Ctx {
  const own = ctx === undefined;
  const c = own ? makeRecorder(arr, '插入排序') : ctx;
  const n = arr.length;
  const codeLineBase = gap === 1 ? 3 : 4;
  for (let i = gap; i < n; i++) {
    const x = valuesOf(c.rec.state);
    const key = x[i]!;
    record(c, {
      type: 'info',
      title:
        gap === 1
          ? `抽出第 ${i + 1} 张"牌" a[${i}]=${key}，向左找插入位置`
          : `（间隔 ${gap}）抽出 a[${i}]=${key}，向左按间隔 ${gap} 找位置`,
      description:
        gap === 1
          ? `位置 [0, ${i - 1}] 已排好。key 与前面的元素从右往左比较，比它大的右移一格。`
          : shellRound !== undefined
            ? `希尔第 ${shellRound} 趟（gap=${gap}）：同组的元素间隔 ${gap}，对每组做插入排序。`
            : '',
      codeLine: codeLineBase,
      highlight: [`a${i}`],
      mutate: (s) => {
        clearFlags(s);
        mark(s, [`a${i}`], 'writing');
      },
    });
    let j = i - gap;
    for (;;) {
      if (j < 0) break;
      c.counters.comparisons++;
      const xv = valuesOf(c.rec.state);
      if (xv[j]! > key) {
        c.counters.swaps++;
        record(c, {
          type: 'assign',
          title: `a[${j}]=${xv[j]} > key=${key}：a[${j + gap}] = a[${j}]（右移一格）`,
          description: '比 key 大的元素整体右移，腾出空位。',
          codeLine: gap === 1 ? 6 : 7,
          highlight: [`a${j}`, `a${j + gap}`],
          mutate: (s) => {
            clearFlags(s);
            s.cells[j + gap]!.value = s.cells[j]!.value;
            s.cells[j + gap]!.flags = ['swapping'];
            s.cells[j]!.flags = ['comparing'];
          },
        });
        j -= gap;
      } else {
        record(c, {
          type: 'compare',
          title: `a[${j}]=${xv[j]} <= key=${key}：找到插入位置 a[${j + gap}]`,
          description: `key 放在 a[${j + gap}]。`,
          codeLine: gap === 1 ? 6 : 7,
          highlight: [`a${j}`],
          mutate: (s) => {
            clearFlags(s);
            s.cells[j]!.flags = ['comparing'];
          },
        });
        break;
      }
    }
    record(c, {
      type: 'assign',
      title: `a[${j + gap}] = ${key}（放进空位）`,
      description: '插入完成，前 i+1 个元素有序。',
      codeLine: gap === 1 ? 9 : 10,
      highlight: [`a${j + gap}`],
      mutate: (s) => {
        clearFlags(s);
        s.cells[j + gap]!.value = key;
        s.cells[j + gap]!.flags = ['writing'];
      },
    });
  }
  if (own) {
    finish(c, '插入');
    return result(c);
  }
  return c;
}

/* ---------- 希尔 ---------- */

function shellSteps(arr: number[]): SortStepsResult {
  const ctx = makeRecorder(arr, '希尔排序');
  const n = arr.length;
  let round = 0;
  for (let gap = n >> 1; gap > 0; gap >>= 1) {
    round++;
    record(ctx, {
      type: 'info',
      title: `第 ${round} 趟：间隔 gap = ${gap}`,
      description: `把相隔 ${gap} 的元素看成一组，分别插入排序。间隔逐渐减半，最后一趟 gap=1 就是普通插入排序，但此时数组已经"基本有序"，非常快。`,
      beginnerNote: `间隔 ${gap} 意味着 a[${gap}] 和 a[0] 比较、a[${gap * 2}] 和 a[${gap}] 比较……大跨度先解决"远距离逆序"，让小间隔的最后一趟轻松。`,
      codeLine: 3,
      mutate: (s) => {
        clearFlags(s, false);
      },
    });
    const res = insertionSteps(valuesOf(ctx.rec.state), gap, ctx, round);
    void res;
  }
  finish(ctx, '希尔');
  return result(ctx);
}

/* ---------- 归并 ---------- */

function mergeSteps(arr: number[]): SortStepsResult {
  const ctx = makeRecorder(arr, '归并排序');
  const n = arr.length;

  function ms(left: number, right: number): void {
    if (left >= right) return;
    const mid = (left + right) >> 1;
    record(ctx, {
      type: 'info',
      title: `分解 [${left}, ${right}] → [${left}, ${mid}] 和 [${mid + 1}, ${right}]`,
      description: '递归排序左右两半，然后合并。',
      codeLine: 25,
      mutate: (s) => {
        clearFlags(s, false);
        s.range = [left, right];
        for (let k = left; k <= right; k++) s.cells[k]!.flags = ['inRange'];
      },
    });
    ms(left, mid);
    ms(mid + 1, right);

    // 合并
    const x = valuesOf(ctx.rec.state);
    let i = left;
    let j = mid + 1;
    const merged: number[] = [];
    record(ctx, {
      type: 'info',
      title: `合并有序的 [${left}, ${mid}] 与 [${mid + 1}, ${right}]`,
      description: '双指针：每次取两边较小的放进临时数组。',
      codeLine: 3,
      mutate: (s) => {
        clearFlags(s, false);
        s.range = [left, right];
        for (let k = left; k <= right; k++) s.cells[k]!.flags = ['inRange'];
      },
    });
    while (i <= mid && j <= right) {
      ctx.counters.comparisons++;
      const takeLeft = x[i]! <= x[j]!;
      merged.push(takeLeft ? x[i]! : x[j]!);
      record(ctx, {
        type: 'compare',
        title: `比较 a[${i}]=${x[i]} 与 a[${j}]=${x[j]}：取 ${takeLeft ? `左边 ${x[i]}` : `右边 ${x[j]}`}`,
        description: `合并结果（暂存）：[${merged.join(', ')}]。取等号时优先左边——这正是归并排序稳定性的来源。`,
        codeLine: takeLeft ? 6 : 8,
        highlight: [`a${i}`, `a${j}`],
        mutate: (s) => {
          clearFlags(s, false);
          s.range = [left, right];
          for (let k = left; k <= right; k++) s.cells[k]!.flags = ['inRange'];
          s.cells[takeLeft ? i : j]!.flags = ['comparing'];
        },
      });
      if (takeLeft) i++;
      else j++;
    }
    while (i <= mid) {
      merged.push(x[i]!);
      i++;
    }
    while (j <= right) {
      merged.push(x[j]!);
      j++;
    }
    // 写回
    ctx.counters.swaps += merged.length;
    record(ctx, {
      type: 'assign',
      title: `把合并结果写回 [${left}, ${right}]：[${merged.join(', ')}]`,
      description: '临时数组按顺序写回原数组对应区间。',
      codeLine: 16,
      mutate: (s) => {
        merged.forEach((v, k) => {
          s.cells[left + k]!.value = v;
          s.cells[left + k]!.flags = ['writing'];
        });
        s.range = [left, right];
      },
    });
  }

  ms(0, n - 1);
  finish(ctx, '归并');
  return result(ctx);
}

/* ---------- 快速 ---------- */

function quickSteps(arr: number[]): SortStepsResult {
  const ctx = makeRecorder(arr, '快速排序');

  function qs(low: number, high: number): void {
    if (low >= high) return;
    const x = valuesOf(ctx.rec.state);
    const pivotValue = x[high]!;
    record(ctx, {
      type: 'info',
      title: `对 [${low}, ${high}] 分区，基准 pivot = a[${high}] = ${pivotValue}`,
      description: `目标：比 ${pivotValue} 小的都去左边，大的都去右边，基准放到分界点。`,
      beginnerNote: 'i 维护"小于区"的右边界：i 左边的全部 < pivot。j 扫描每个元素，发现小的就交换到小于区。',
      codeLine: 2,
      mutate: (s) => {
        clearFlags(s, false);
        for (let k = low; k <= high; k++) s.cells[k]!.flags = ['inRange'];
        s.cells[high]!.flags = ['pivot'];
      },
    });

    let i = low - 1;
    for (let j = low; j < high; j++) {
      ctx.counters.comparisons++;
      const xv = valuesOf(ctx.rec.state);
      if (xv[j]! < pivotValue) {
        i++;
        if (i !== j) {
          ctx.counters.swaps++;
          record(ctx, {
            type: 'swap',
            title: `a[${j}]=${xv[j]} < pivot=${pivotValue}：换进小于区（i=${i}）`,
            description: `交换 a[${i}] 与 a[${j}]，小于区扩大一格。`,
            codeLine: 8,
            highlight: [`a${i}`, `a${j}`],
            mutate: (s) => {
              clearFlags(s, false);
              for (let k = low; k <= high; k++) s.cells[k]!.flags = ['inRange'];
              s.cells[high]!.flags = ['pivot'];
              const t = s.cells[i]!.value;
              s.cells[i]!.value = s.cells[j]!.value;
              s.cells[j]!.value = t;
              s.cells[i]!.flags = ['swapping'];
              s.cells[j]!.flags = ['swapping'];
            },
          });
        } else {
          record(ctx, {
            type: 'compare',
            title: `a[${j}]=${xv[j]} < pivot=${pivotValue}：已在小于区，i 直接扩大`,
            description: `j == i，无需交换。`,
            codeLine: 7,
            highlight: [`a${j}`],
            mutate: (s) => {
              clearFlags(s, false);
              for (let k = low; k <= high; k++) s.cells[k]!.flags = ['inRange'];
              s.cells[high]!.flags = ['pivot'];
              s.cells[j]!.flags = ['comparing'];
            },
          });
        }
      } else {
        record(ctx, {
          type: 'compare',
          title: `a[${j}]=${xv[j]} >= pivot=${pivotValue}：留在右边`,
          description: '不动作，继续扫描。',
          codeLine: 6,
          highlight: [`a${j}`],
          mutate: (s) => {
            clearFlags(s, false);
            for (let k = low; k <= high; k++) s.cells[k]!.flags = ['inRange'];
            s.cells[high]!.flags = ['pivot'];
            s.cells[j]!.flags = ['comparing'];
          },
        });
      }
    }
    // 基准归位
    const p = i + 1;
    if (p !== high) {
      ctx.counters.swaps++;
      record(ctx, {
        type: 'swap',
        title: `基准归位：a[${p}] ↔ a[${high}]，pivot=${pivotValue} 落在下标 ${p}`,
        description: `现在 a[${p}] 左边全 < ${pivotValue}，右边全 >= ${pivotValue}，它已就位。`,
        codeLine: 12,
        highlight: [`a${p}`, `a${high}`],
        mutate: (s) => {
          clearFlags(s, false);
          const t = s.cells[p]!.value;
          s.cells[p]!.value = s.cells[high]!.value;
          s.cells[high]!.value = t;
          s.cells[p]!.flags = ['sorted'];
        },
      });
    } else {
      record(ctx, {
        type: 'mark',
        title: `基准 ${pivotValue} 已在正确位置 ${p}`,
        description: '不需要交换。',
        codeLine: 12,
        mutate: (s) => {
          clearFlags(s, false);
          s.cells[p]!.flags = ['sorted'];
        },
      });
    }
    qs(low, p - 1);
    qs(p + 1, high);
  }

  qs(0, arr.length - 1);
  finish(ctx, '快速');
  return result(ctx);
}

/* ---------- 堆排序 ---------- */

function heapSortSteps(arr: number[]): SortStepsResult {
  const ctx = makeRecorder(arr, '堆排序');
  const n = arr.length;

  function down(i: number, size: number): void {
    for (;;) {
      let best = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      const x = valuesOf(ctx.rec.state);
      if (l < size && x[l]! > x[best]!) best = l;
      if (r < size && x[r]! > x[best]!) best = r;
      ctx.counters.comparisons += (l < size ? 1 : 0) + (r < size ? 1 : 0);
      if (best === i) break;
      ctx.counters.swaps++;
      record(ctx, {
        type: 'swap',
        title: `下滤：a[${i}]=${x[i]} 与孩子中更大的 a[${best}]=${x[best]} 交换`,
        description: `父节点 (i-1)/2、孩子 2i+1/2i+2。交换后继续向下检查。`,
        codeLine: 3,
        highlight: [`a${i}`, `a${best}`],
        mutate: (s) => {
          clearFlags(s);
          const t = s.cells[i]!.value;
          s.cells[i]!.value = s.cells[best]!.value;
          s.cells[best]!.value = t;
          s.cells[i]!.flags = ['swapping'];
          s.cells[best]!.flags = ['swapping'];
        },
      });
      i = best;
    }
  }

  record(ctx, {
    type: 'info',
    title: `第一步：Floyd 建最大堆（从 i=${Math.max((n >> 1) - 1, 0)} 倒着下滤到 0）`,
    description: '建堆后 a[0] 是最大值。',
    codeLine: 21,
    mutate: (s) => {
      clearFlags(s, false);
    },
  });
  for (let i = (n >> 1) - 1; i >= 0; i--) down(i, n);

  for (let end = n - 1; end > 0; end--) {
    const x = valuesOf(ctx.rec.state);
    ctx.counters.swaps++;
    record(ctx, {
      type: 'swap',
      title: `堆顶 a[0]=${x[0]}（当前最大）与 a[${end}] 交换，就位`,
      description: `最大值放到末尾，堆大小缩为 ${end}。`,
      codeLine: 25,
      highlight: [`a0`, `a${end}`],
      mutate: (s) => {
        clearFlags(s);
        const t = s.cells[0]!.value;
        s.cells[0]!.value = s.cells[end]!.value;
        s.cells[end]!.value = t;
        s.cells[end]!.flags = ['sorted'];
        s.cells[0]!.flags = ['swapping'];
      },
    });
    down(0, end);
  }
  finish(ctx, '堆');
  return result(ctx);
}

/* ============ 收尾与入口 ============ */

function finish(ctx: Ctx, name: string): void {
  record(ctx, {
    type: 'mark',
    title: `${name}排序完成`,
    description: `共比较 ${ctx.counters.comparisons} 次，交换/移动 ${ctx.counters.swaps} 次。结果：[${valuesOf(ctx.rec.state).join(', ')}]。`,
    codeLine: 2,
    mutate: (s) => {
      for (const c of s.cells) c.flags = ['sorted'];
      s.range = undefined;
    },
  });
}

function result(ctx: Ctx): SortStepsResult {
  const outcome = ctx.rec.finish();
  return {
    steps: outcome.steps,
    sorted: valuesOf(outcome.steps[outcome.steps.length - 1]?.afterState ?? toArrayState([])),
    meta: { comparisons: ctx.counters.comparisons, swaps: ctx.counters.swaps },
  };
}

export function sortWithSteps(id: SortId, arr: number[]): SortStepsResult {
  switch (id) {
    case 'bubble':
      return bubbleSteps(arr);
    case 'selection':
      return selectionSteps(arr);
    case 'insertion':
      return insertionSteps(arr, 1) as SortStepsResult;
    case 'shell':
      return shellSteps(arr);
    case 'merge':
      return mergeSteps(arr);
    case 'quick':
      return quickSteps(arr);
    case 'heap':
      return heapSortSteps(arr);
  }
}

/** 同一组数据多算法比较（Compare Mode 数据基础） */
export function compareSorts(ids: SortId[], arr: number[]): Array<{ id: SortId; result: SortStepsResult }> {
  return ids.map((id) => ({ id, result: sortWithSteps(id, arr) }));
}

export type SortStep = Step<ArrayState>;

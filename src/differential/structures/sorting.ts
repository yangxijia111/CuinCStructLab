/**
 * 排序差分套件：7 种排序 × 定向分布 + ≥100 组固定 seed 随机输入。
 * C 侧 = SORT_C_CODES 全部 7 段教学代码拼接（函数名互不冲突）。
 * TS 侧 = sortWithSteps（步骤版，任务书指定），取 .sorted。
 */
import { SORT_C_CODES, type SortId } from '../../core/algorithms/sorting-codes';
import { sortWithSteps } from '../../core/algorithms/sorting';
import { mulberry32 } from '../rng';
import type { DifferentialCase, StructureSuite, TsRunResult } from '../types';

const SORT_IDS: SortId[] = ['bubble', 'selection', 'insertion', 'shell', 'merge', 'quick', 'heap'];
const C_FN: Record<SortId, string> = {
  bubble: 'bubbleSort(a, n)',
  selection: 'selectionSort(a, n)',
  insertion: 'insertionSort(a, n)',
  shell: 'shellSort(a, n)',
  merge: 'mergeSort(a, tmp, 0, n - 1)',
  quick: 'quickSort(a, 0, n - 1)',
  heap: 'heapSort(a, n)',
};

function runTs(c: DifferentialCase): TsRunResult {
  const observations: string[] = [];
  const values = c.initial.values ?? [];
  const algo = c.operations[0]?.op as SortId;
  if (!SORT_IDS.includes(algo)) throw new Error(`sorting: 未知算法 ${algo}`);
  const result = sortWithSteps(algo, values);
  return { state: { kind: 'sorting', values: result.sorted, size: result.sorted.length }, observations };
}

function generateC(cases: DifferentialCase[]): string {
  const lines: string[] = [];
  // 教学排序代码不含 #include：harness 需要 printf
  lines.push('#include <stdio.h>', '');
  for (const id of SORT_IDS) lines.push(...SORT_C_CODES[id]);
  lines.push('int main(void) {');
  lines.push('    int a[256], tmp[256];');
  cases.forEach((c, ci) => {
    const values = c.initial.values ?? [];
    const algo = c.operations[0]?.op as SortId;
    const n = Math.max(values.length, 1);
    lines.push(`    printf("BEGIN ${ci}\\n");`);
    lines.push('    {');
    lines.push(`        const int n = ${values.length};`);
    if (values.length > 0) {
      lines.push(`        int src[${n}] = {${values.join(',')}};`);
      lines.push('        for (int i = 0; i < n; i++) a[i] = src[i];');
    }
    lines.push(`        ${C_FN[algo]};`);
    lines.push('        printf("ARR:[");');
    lines.push('        for (int i = 0; i < n; i++) { printf("%s%d", i ? "," : "", a[i]); }');
    lines.push('        printf("]\\nSIZE:%d\\n", n);');
    lines.push('    }');
    lines.push(`    printf("END ${ci}\\n");`);
  });
  lines.push('    (void)tmp;');
  lines.push('    return 0;', '}');
  return lines.join('\n');
}

/** 输入分布：空/单元素/已序/逆序/全重复/负数/随机/大重复率（任务书五） */
type DistKind = 'empty' | 'single' | 'sorted' | 'reversed' | 'all-dup' | 'negative' | 'random' | 'heavy-dup';

function makeDist(rng: ReturnType<typeof mulberry32>, kind: DistKind): number[] {
  switch (kind) {
    case 'empty':
      return [];
    case 'single':
      return [rng.int(-99, 99)];
    case 'sorted': {
      const n = rng.int(2, 40);
      return Array.from({ length: n }, (_, i) => i * 2 + rng.int(0, 1));
    }
    case 'reversed': {
      const n = rng.int(2, 40);
      return Array.from({ length: n }, (_, i) => (n - i) * 3);
    }
    case 'all-dup':
      return Array.from({ length: rng.int(2, 40) }, () => 42);
    case 'negative':
      return Array.from({ length: rng.int(2, 40) }, () => rng.int(-999, -1));
    case 'heavy-dup':
      return Array.from({ length: rng.int(2, 40) }, () => rng.int(-2, 2));
    case 'random':
    default:
      return Array.from({ length: rng.int(0, 40) }, () => rng.int(-999, 999));
  }
}

const DISTS: DistKind[] = ['empty', 'single', 'sorted', 'reversed', 'all-dup', 'negative', 'random', 'heavy-dup'];

function generateCases(seed: number, count: number): DifferentialCase[] {
  const out: DifferentialCase[] = [];
  for (const algo of SORT_IDS) {
    for (let i = 0; i < count; i++) {
      const rng = mulberry32(seed * 1000003 + algo.charCodeAt(0) * 7919 + i);
      // 前 8 组定向覆盖全部分布，其余随机混合
      const kind: DistKind = i < DISTS.length ? DISTS[i]! : DISTS[rng.int(0, DISTS.length - 1)]!;
      const values = makeDist(rng, kind);
      out.push({
        structure: 'sorting',
        seed,
        initial: { structure: 'sorting', values },
        operations: [{ op: algo, args: [] }],
      });
    }
  }
  return out;
}

export const sortingSuite: StructureSuite = { id: 'sorting', generateCases, runTs, generateC };

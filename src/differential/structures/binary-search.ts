/**
 * 二分查找差分套件：随机有序数组 × 多目标（存在/不存在/首/末/重复段）。
 * 重复值规范（DIFFERENTIAL_TEST_SPEC §7）：any-match —— 双方各自返回某个匹配下标即可，
 * 比较观察为 (found, idxNeg) 二元组：idx<0 ⇔ 不存在；idx≥0 ⇒ a[idx]==target。
 */
import { SEARCH_C_CODE } from '../../core/algorithms/search';
import { binarySearchDirect } from '../../core/algorithms/search';
import { mulberry32, sortedValues } from '../rng';
import type { DifferentialCase, StructureSuite, TsRunResult } from '../types';

function runTs(c: DifferentialCase): TsRunResult {
  const observations: string[] = [];
  const arr = c.initial.values ?? [];
  for (const op of c.operations) {
    if (op.op !== 'search') throw new Error(`binary-search: 未知操作 ${op.op}`);
    const t = op.args[0] as number;
    const idx = binarySearchDirect(arr, t);
    const found = idx >= 0 && arr[idx] === t ? 1 : 0;
    observations.push(`search t=${t} found=${found} idxNeg=${idx < 0 ? 1 : 0}`);
  }
  return { state: { kind: 'binary-search', values: arr, size: arr.length }, observations };
}

function generateC(cases: DifferentialCase[]): string {
  const lines: string[] = [];
  lines.push(...SEARCH_C_CODE);
  lines.push('int main(void) {');
  cases.forEach((c, ci) => {
    const arr = c.initial.values ?? [];
    const n = Math.max(arr.length, 1);
    lines.push(`    printf("BEGIN ${ci}\\n");`);
    lines.push('    {');
    if (arr.length > 0) {
      lines.push(`        int a[${n}] = {${arr.join(',')}};`);
    } else {
      lines.push('        int a[1] = {0};');
    }
    lines.push(`        const int n = ${arr.length};`);
    for (const op of c.operations) {
      const t = op.args[0] as number;
      lines.push(
        `        { int idx = binarySearch(a, n, ${t}); int found = idx >= 0 && idx < n && a[idx] == ${t} ? 1 : 0;`,
        `          printf("OBS:search t=${t} found=%d idxNeg=%d\\n", found, idx < 0 ? 1 : 0); }`,
      );
    }
    lines.push('        printf("SIZE:%d\\n", n);');
    lines.push('    }');
    lines.push(`    printf("END ${ci}\\n");`);
  });
  lines.push('    return 0;', '}');
  return lines.join('\n');
}

/** 目标选择：存在（首/末/中/重复段任一）/不存在（边界外与间隙） */
function pickTargets(rng: ReturnType<typeof mulberry32>, arr: number[]): number[] {
  const targets: number[] = [];
  if (arr.length > 0) {
    targets.push(arr[0]!); // 首元素
    targets.push(arr[arr.length - 1]!); // 末元素
    targets.push(arr[rng.int(0, arr.length - 1)]!); // 随机存在值（可能落在重复段）
    targets.push(arr[0]! - 1); // 比最小还小
    targets.push(arr[arr.length - 1]! + 1); // 比最大还大
    // 间隙值（排序数组相邻差 >1 的缝里）
    for (let k = 0; k < 3; k++) {
      const i = rng.int(0, arr.length - 2);
      if (arr[i]! + 1 < arr[i + 1]!) targets.push(arr[i]! + 1);
    }
    // 重复值随机目标
    const dup = arr[rng.int(0, arr.length - 1)]!;
    targets.push(dup);
  } else {
    targets.push(0, -5, 7);
  }
  return targets;
}

function generateCases(seed: number, count: number): DifferentialCase[] {
  const out: DifferentialCase[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(seed * 100003 + i + 97);
    // 定向：空数组、单元素、全重复；其余随机有序（含重复段）
    let arr: number[];
    if (i === 0) arr = [];
    else if (i === 1) arr = [42];
    else if (i === 2) arr = Array.from({ length: rng.int(2, 30) }, () => 7);
    else arr = sortedValues(rng, rng.int(1, 60), -200, 200);
    const operations = pickTargets(rng, arr).map((t) => ({ op: 'search', args: [t] }));
    out.push({ structure: 'binary-search', seed, initial: { structure: 'binary-search', values: arr }, operations });
  }
  return out;
}

export const binarySearchSuite: StructureSuite = { id: 'binary-search', generateCases, runTs, generateC };

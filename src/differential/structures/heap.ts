/**
 * 堆差分套件：max/min × insert/deleteTop/heapify。
 * C 侧 = HEAP_C_CODE 教学代码（仅 max 实现；min 用"值取负进 max 堆"对偶实现：
 * -a > -b ⇔ a < b，上滤/下滤决策逐位一致，min 堆数组 = max(-x) 数组逐位取负）。
 * 范围约束：size < HEAP_CAP(64)（教学 C 有界、TS 无界的固有差异，见 DIFFERENTIAL_TEST_SPEC）。
 */
import { HEAP_C_CODE, emptyHeap, heapInsert, heapDeleteTop, heapify, heapValues, assertHeapProperty } from '../../core/data-structures/heap';
import type { HeapState } from '../../core/types';
import { mulberry32 } from '../rng';
import type { DifferentialCase, StructureSuite, TsRunResult } from '../types';
import { lastState } from '../framework';

function runTs(c: DifferentialCase): TsRunResult {
  const observations: string[] = [];
  const compare = c.initial.compare ?? 'max';
  let state: HeapState = emptyHeap(compare);
  // 初始值用 heapify（Floyd 建堆）构造，与 C 侧一致
  if ((c.initial.values ?? []).length > 0) {
    state = lastState(heapify(c.initial.values ?? [], compare)) ?? state;
  }
  for (const op of c.operations) {
    const args = op.args as number[];
    switch (op.op) {
      case 'insert': {
        const out = heapInsert(state, args[0]);
        observations.push(`insert rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'deleteTop': {
        const topBefore = heapValues(state)[0] ?? 0;
        const out = heapDeleteTop(state);
        observations.push(`deleteTop rc=${out.ok ? 0 : -1},v=${out.ok ? topBefore : 0}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'heapify': {
        state = lastState(heapify(args, compare)) ?? state;
        observations.push(`heapify n=${args.length}`);
        break;
      }
      default:
        throw new Error(`heap: 未知操作 ${op.op}`);
    }
  }
  return {
    state: { kind: 'heap', values: heapValues(state), size: heapValues(state).length, heapProperty: assertHeapProperty(state) ? 1 : 0 },
    observations,
  };
}

function generateC(cases: DifferentialCase[]): string {
  const lines: string[] = [];
  lines.push(...HEAP_C_CODE);
  lines.push(
    'static int cclabSign; /* min 堆：输出时取负还原 */',
    'static void cclabPrintState(Heap *h) {',
    '    printf("S:[");',
    '    for (int i = 0; i < h->size; i++) { printf("%s%d", i ? "," : "", cclabSign * h->data[i]); }',
    '    printf("]\\nSIZE:%d\\n", h->size);',
    '    int ok = 1;',
    '    for (int i = 1; i < h->size; i++) { if (h->data[i] > h->data[(i - 1) / 2]) { ok = 0; break; } }',
    '    printf("HEAPOK:%d\\n", ok);',
    '}',
    'int main(void) {',
  );
  cases.forEach((c, ci) => {
    const vals = c.initial.values ?? [];
    const minMode = (c.initial.compare ?? 'max') === 'min' ? 1 : 0;
    const enc = (v: number): number => (minMode ? -v : v);
    lines.push(`    printf("BEGIN ${ci}\\n");`);
    lines.push('    {');
    lines.push(`        cclabSign = ${minMode ? -1 : 1};`);
    lines.push('        Heap h; heapInit(&h);');
    if (vals.length > 0) {
      lines.push(`        int initArr[${Math.max(vals.length, 1)}] = {${vals.map((v) => enc(v)).join(',')}};`);
      lines.push(`        heapify(&h, initArr, ${vals.length});`);
    }
    for (let oi = 0; oi < c.operations.length; oi++) {
      const op = c.operations[oi]!;
      const args = op.args as number[];
      switch (op.op) {
        case 'insert':
          lines.push(
            `        { int rc = heapInsert(&h, ${enc(args[0])}); printf("OBS:insert rc=%d\\n", rc); }`,
          );
          break;
        case 'deleteTop':
          lines.push(
            `        { int out = 0; int rc = heapDeleteTop(&h, &out); printf("OBS:deleteTop rc=%d,v=%d\\n", rc, cclabSign * out); }`,
          );
          break;
        case 'heapify': {
          // C 空初始化列表非法：n=0 用 {0} 占位（heapify 不会读）
          const arrLit = args.length > 0 ? args.map((v) => enc(v)).join(',') : '0';
          lines.push(
            `        { int cclabArr${oi}[${Math.max(args.length, 1)}] = {${arrLit}}; heapify(&h, cclabArr${oi}, ${args.length}); printf("OBS:heapify n=${args.length}\\n"); }`,
          );
          break;
        }
        default:
          throw new Error(`heap C: 未知操作 ${op.op}`);
      }
    }
    lines.push('        cclabPrintState(&h);');
    lines.push('    }');
    lines.push(`    printf("END ${ci}\\n");`);
  });
  lines.push('    return 0;', '}');
  return lines.join('\n');
}

function generateCases(seed: number, count: number): DifferentialCase[] {
  const out: DifferentialCase[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(seed * 100003 + i + 67);
    const compare = rng.bool(0.5) ? 'max' : 'min';
    // 初始 heapify：0..30 个值（< HEAP_CAP 64）
    const initLen = rng.int(0, 30);
    const values = Array.from({ length: initLen }, () => rng.int(-99, 99));
    const operations = [];
    const nOps = rng.int(20, 60);
    let size = initLen;
    for (let j = 0; j < nOps; j++) {
      const kind = rng.int(0, 3);
      if (kind === 0 && size < 40) {
        operations.push({ op: 'insert', args: [rng.int(-99, 99)] });
        size++;
      } else if (kind === 1) {
        operations.push({ op: 'deleteTop', args: [] });
        size = Math.max(0, size - 1);
      } else if (kind === 2) {
        // 重建堆：新数组 ≤ 40
        const n = rng.int(0, 40);
        operations.push({ op: 'heapify', args: Array.from({ length: n }, () => rng.int(-99, 99)) });
        size = n;
      } else {
        operations.push({ op: 'deleteTop', args: [] });
        size = Math.max(0, size - 1);
      }
    }
    out.push({ structure: 'heap', seed, initial: { structure: 'heap', values, compare: compare as 'max' | 'min' }, operations });
  }
  return out;
}

export const heapSuite: StructureSuite = { id: 'heap', generateCases, runTs, generateC };

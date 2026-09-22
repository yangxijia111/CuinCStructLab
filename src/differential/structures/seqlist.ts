/**
 * 顺序表差分套件：init/insert/delete/set/find/traverse。
 * C 侧 = SEQ_LIST_C_CODE 教学代码（真实编译执行）。
 */
import {
  SEQ_LIST_C_CODE,
  seqListFrom,
  seqListInsert,
  seqListDelete,
  seqListSet,
  seqListFind,
  seqListValues,
} from '../../core/data-structures/seqlist';
import type { ArrayState } from '../../core/types';
import { mulberry32 } from '../rng';
import type { DifferentialCase, StructureSuite, TsRunResult } from '../types';
import { lastState } from '../framework';

function runTs(c: DifferentialCase): TsRunResult {
  const observations: string[] = [];
  let state: ArrayState = lastState(seqListFrom(c.initial.values ?? [], c.initial.capacity ?? 4))!;
  for (const op of c.operations) {
    const [a0, a1] = op.args as number[];
    switch (op.op) {
      case 'insert': {
        const out = seqListInsert(state, a0, a1);
        observations.push(`insert rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'delete': {
        const out = seqListDelete(state, a0);
        observations.push(`delete rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'set': {
        const out = seqListSet(state, a0, a1);
        observations.push(`set rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'find': {
        // 走 TS 步骤版逻辑：visit 步骤 highlight = `a${i}`，未命中无 visit
        const out = seqListFind(state, a0);
        const visit = out.steps.find((s) => s.type === 'visit');
        const idx = visit === undefined ? -1 : Number((visit.highlight[0] ?? 'a-1').slice(1));
        observations.push(`find idx=${idx}`);
        break;
      }
      case 'traverse': {
        observations.push(`traverse v=[${seqListValues(state).join(',')}]`);
        break;
      }
      default:
        throw new Error(`seqlist: 未知操作 ${op.op}`);
    }
  }
  return { state: { kind: 'seqlist', values: seqListValues(state), size: state.size }, observations };
}

function generateC(cases: DifferentialCase[]): string {
  const lines: string[] = [];
  lines.push(...SEQ_LIST_C_CODE);
  lines.push(
    'static void cclabPrintState(SeqList *L) {',
    '    printf("S:[");',
    '    for (int i = 0; i < L->size; i++) { printf("%s%d", i ? "," : "", L->data[i]); }',
    '    printf("]\\nSIZE:%d\\n", L->size);',
    '}',
    'static void cclabObsTraverse(SeqList *L) {',
    '    printf("OBS:traverse v=[");',
    '    for (int i = 0; i < L->size; i++) { printf("%s%d", i ? "," : "", L->data[i]); }',
    '    printf("]\\n");',
    '}',
    'int main(void) {',
  );
  cases.forEach((c, ci) => {
    const vals = c.initial.values ?? [];
    const cap = Math.max(c.initial.capacity ?? 4, vals.length, 1);
    lines.push(`    printf("BEGIN ${ci}\\n");`);
    lines.push('    {');
    lines.push('        SeqList L;');
    lines.push(`        seqListInit(&L, ${cap});`);
    vals.forEach((v, i) => lines.push(`        seqListInsert(&L, ${i}, ${v});`));
    for (const op of c.operations) {
      const [a0, a1] = op.args as number[];
      switch (op.op) {
        case 'insert':
          lines.push(`        { int rc = seqListInsert(&L, ${a0}, ${a1}); printf("OBS:insert rc=%d\\n", rc); }`);
          break;
        case 'delete':
          lines.push(`        { int rc = seqListDelete(&L, ${a0}); printf("OBS:delete rc=%d\\n", rc); }`);
          break;
        case 'set':
          lines.push(`        { int rc = seqListSet(&L, ${a0}, ${a1}); printf("OBS:set rc=%d\\n", rc); }`);
          break;
        case 'find':
          lines.push(`        printf("OBS:find idx=%d\\n", seqListFind(&L, ${a0}));`);
          break;
        case 'traverse':
          lines.push('        cclabObsTraverse(&L);');
          break;
        default:
          throw new Error(`seqlist C: 未知操作 ${op.op}`);
      }
    }
    lines.push('        cclabPrintState(&L);');
    lines.push('        seqListDestroy(&L);');
    lines.push('    }');
    lines.push(`    printf("END ${ci}\\n");`);
  });
  lines.push('    return 0;', '}');
  return lines.join('\n');
}

function generateCases(seed: number, count: number): DifferentialCase[] {
  const out: DifferentialCase[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(seed * 100003 + i);
    const initLen = rng.int(0, 12);
    const values = Array.from({ length: initLen }, () => rng.int(-99, 99));
    const capacity = rng.int(2, 8);
    const operations = [];
    const nOps = rng.int(20, 100);
    // 跟踪 size 以生成边界内/外的 pos（含少量越界验证双方一致失败）
    let size = initLen;
    for (let j = 0; j < nOps; j++) {
      const kind = rng.int(0, 4);
      if (kind === 0 || kind === 1) {
        const pos = rng.int(-1, size + 1);
        const v = rng.int(-99, 99);
        operations.push({ op: 'insert', args: [pos, v] });
        if (pos >= 0 && pos <= size) size++;
      } else if (kind === 2) {
        const pos = rng.int(-1, size);
        operations.push({ op: 'delete', args: [pos] });
        if (pos >= 0 && pos < size) size--;
      } else if (kind === 3) {
        const pos = rng.int(-1, Math.max(size - 1, 0));
        operations.push({ op: 'set', args: [pos, rng.int(-99, 99)] });
      } else {
        // find：一半概率找存在的值
        const v = rng.bool(0.5) && size > 0 ? values[rng.int(0, values.length - 1)]! : rng.int(-99, 99);
        operations.push({ op: 'find', args: [v] });
      }
    }
    operations.push({ op: 'traverse', args: [] });
    out.push({ structure: 'seqlist', seed, initial: { structure: 'seqlist', values, capacity }, operations });
  }
  return out;
}

export const seqlistSuite: StructureSuite = { id: 'seqlist', generateCases, runTs, generateC };

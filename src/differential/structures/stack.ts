/**
 * 顺序栈差分套件：push/pop/peek（含满/空边界）。
 * C 侧 = STACK_C_CODE 教学代码（ArrayStack 局部变量，无全局态）。
 */
import { STACK_C_CODE, arrayStackFrom, arrayStackPush, arrayStackPop, arrayStackPeek } from '../../core/data-structures/stack';
import type { StackState } from '../../core/types';
import { mulberry32 } from '../rng';
import type { DifferentialCase, StructureSuite, TsRunResult } from '../types';
import { lastState } from '../framework';

function frames(state: StackState): number[] {
  return state.frames.map((f) => Number(f.label));
}

function runTs(c: DifferentialCase): TsRunResult {
  const observations: string[] = [];
  // 容量固定教学值 STACK_CAP=8：C 侧 #define 不可参数化，TS 侧必须一致
  let state: StackState = lastState(arrayStackFrom(c.initial.values ?? [], 8))!;
  for (const op of c.operations) {
    switch (op.op) {
      case 'push': {
        const out = arrayStackPush(state, op.args[0] as number);
        observations.push(`push rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'pop': {
        const before = frames(state);
        const topBefore = before.length > 0 ? before[before.length - 1] : 0;
        const out = arrayStackPop(state);
        observations.push(`pop rc=${out.ok ? 0 : -1},v=${out.ok ? topBefore : 0}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'peek': {
        const before = frames(state);
        const out = arrayStackPeek(state);
        observations.push(`peek rc=${out.ok ? 0 : -1},v=${out.ok ? before[before.length - 1] : 0}`);
        break;
      }
      default:
        throw new Error(`stack: 未知操作 ${op.op}`);
    }
  }
  const vals = frames(state);
  return { state: { kind: 'stack', values: vals, size: vals.length }, observations };
}

function generateC(cases: DifferentialCase[]): string {
  const lines: string[] = [];
  lines.push(...STACK_C_C_CODE_SLICE);
  lines.push(
    'static void cclabPrintState(ArrayStack *s) {',
    '    printf("S:[");',
    '    for (int i = 0; i < s->top; i++) { printf("%s%d", i ? "," : "", s->data[i]); }',
    '    printf("]\\nSIZE:%d\\n", s->top);',
    '}',
    'int main(void) {',
  );
  cases.forEach((c, ci) => {
    const vals = c.initial.values ?? [];
    lines.push(`    printf("BEGIN ${ci}\\n");`);
    lines.push('    {');
    lines.push('        ArrayStack s;');
    lines.push('        stackInit(&s);');
    vals.forEach((v) => lines.push(`        stackPush(&s, ${v});`));
    for (const op of c.operations) {
      const a0 = op.args[0] as number;
      switch (op.op) {
        case 'push':
          lines.push(`        { int rc = stackPush(&s, ${a0}); printf("OBS:push rc=%d\\n", rc); }`);
          break;
        case 'pop':
          lines.push(`        { int out = 0; int rc = stackPop(&s, &out); printf("OBS:pop rc=%d,v=%d\\n", rc, out); }`);
          break;
        case 'peek':
          lines.push(`        { int out = 0; int rc = stackPeek(&s, &out); printf("OBS:peek rc=%d,v=%d\\n", rc, out); }`);
          break;
        default:
          throw new Error(`stack C: 未知操作 ${op.op}`);
      }
    }
    lines.push('        cclabPrintState(&s);');
    lines.push('    }');
    lines.push(`    printf("END ${ci}\\n");`);
  });
  lines.push('    return 0;', '}');
  return lines.join('\n');
}

/**
 * STACK_C_CODE 同时包含顺序栈 + 链栈 + 括号匹配（后段使用全局 top 与 main 之外的辅助），
 * 差分只需要顺序栈段：截到"链栈"注释行为止（截取点由 buildLineMap 已固定，测试校验行数）。
 */
const STACK_C_C_CODE_SLICE = (() => {
  // 锚点：链栈分节注释（首行总注释也含"链栈"字样，必须用分节标记精确定位）
  const idx = STACK_C_CODE.findIndex((l) => l.includes('---------- 链栈'));
  if (idx < 0) throw new Error('STACK_C_CODE 结构变化：未找到链栈分节锚点，需同步更新差分截取');
  return STACK_C_CODE.slice(0, idx);
})();

function generateCases(seed: number, count: number): DifferentialCase[] {
  const out: DifferentialCase[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(seed * 100003 + i + 29);
    const initLen = rng.int(0, 6);
    const values = Array.from({ length: initLen }, () => rng.int(-99, 99));
    const operations = [];
    const nOps = rng.int(20, 100);
    for (let j = 0; j < nOps; j++) {
      const kind = rng.int(0, 2);
      if (kind === 0) {
        operations.push({ op: 'push', args: [rng.int(-99, 99)] });
      } else if (kind === 1) {
        operations.push({ op: 'pop', args: [] });
      } else {
        operations.push({ op: 'peek', args: [] });
      }
    }
    out.push({ structure: 'stack', seed, initial: { structure: 'stack', values }, operations });
  }
  return out;
}

export const stackSuite: StructureSuite = { id: 'stack', generateCases, runTs, generateC };

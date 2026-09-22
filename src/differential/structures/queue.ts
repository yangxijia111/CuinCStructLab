/**
 * 循环队列差分套件：enqueue/dequeue，重点覆盖 wrap-around / full / empty。
 * C 侧 = QUEUE_C_CODE 循环队列段（QUEUE_CAP 固定 6：C #define 不可参数化，TS 同容量）。
 * 比较逻辑队列序列（front→rear），不比较 front/rear 下标（实现细节）。
 */
import { QUEUE_C_CODE, QUEUE_CAPACITY, circularQueueFrom, cqEnqueue, cqDequeue, cqValues } from '../../core/data-structures/queue';
import type { QueueState } from '../../core/types';
import { mulberry32 } from '../rng';
import type { DifferentialCase, StructureSuite, TsRunResult } from '../types';
import { lastState } from '../framework';

function runTs(c: DifferentialCase): TsRunResult {
  const observations: string[] = [];
  let state: QueueState = lastState(circularQueueFrom(c.initial.values ?? [], QUEUE_CAPACITY))!;
  for (const op of c.operations) {
    switch (op.op) {
      case 'enqueue': {
        const out = cqEnqueue(state, op.args[0] as number);
        observations.push(`enqueue rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'dequeue': {
        const valsBefore = cqValues(state);
        const out = cqDequeue(state);
        observations.push(`dequeue rc=${out.ok ? 0 : -1},v=${out.ok ? valsBefore[0] : 0}`);
        state = lastState(out) ?? state;
        break;
      }
      default:
        throw new Error(`circular-queue: 未知操作 ${op.op}`);
    }
  }
  const vals = cqValues(state);
  return {
    state: {
      kind: 'circular-queue',
      values: vals,
      size: vals.length,
      full: (state.rear + 1) % state.capacity === state.front ? 1 : 0,
      empty: state.front === state.rear ? 1 : 0,
    },
    observations,
  };
}

function generateC(cases: DifferentialCase[]): string {
  const lines: string[] = [];
  lines.push(...QUEUE_C_CODE_SLICE);
  lines.push(
    'static int cclabSize(CircularQueue *q) {',
    '    return (q->rear - q->front + QUEUE_CAP) % QUEUE_CAP;',
    '}',
    'static void cclabPrintState(CircularQueue *q) {',
    '    printf("S:[");',
    '    int first = 1;',
    '    int i = q->front;',
    '    while (i != q->rear) {',
    '        printf("%s%d", first ? "" : ",", q->data[i]); first = 0;',
    '        i = (i + 1) % QUEUE_CAP;',
    '    }',
    '    printf("]\\nSIZE:%d\\n", cclabSize(q));',
    '    printf("FULL:%d\\nEMPTY:%d\\n", cqIsFull(q), cqIsEmpty(q));',
    '}',
    'int main(void) {',
  );
  cases.forEach((c, ci) => {
    const vals = c.initial.values ?? [];
    lines.push(`    printf("BEGIN ${ci}\\n");`);
    lines.push('    {');
    lines.push('        CircularQueue q;');
    lines.push('        cqInit(&q);');
    vals.forEach((v) => lines.push(`        cqEnqueue(&q, ${v});`));
    for (const op of c.operations) {
      switch (op.op) {
        case 'enqueue':
          lines.push(`        { int rc = cqEnqueue(&q, ${op.args[0] as number}); printf("OBS:enqueue rc=%d\\n", rc); }`);
          break;
        case 'dequeue':
          lines.push('        { int out = 0; int rc = cqDequeue(&q, &out); printf("OBS:dequeue rc=%d,v=%d\\n", rc, out); }');
          break;
        default:
          throw new Error(`circular-queue C: 未知操作 ${op.op}`);
      }
    }
    lines.push('        cclabPrintState(&q);');
    lines.push('    }');
    lines.push(`    printf("END ${ci}\\n");`);
  });
  lines.push('    return 0;', '}');
  return lines.join('\n');
}

/** QUEUE_C_CODE 含循环队列 + 链队列 + 假溢出反面教材；只取循环队列段（锚点：链队列分节注释） */
const QUEUE_C_CODE_SLICE = (() => {
  const idx = QUEUE_C_CODE.findIndex((l) => l.includes('---------- 链队列'));
  if (idx < 0) throw new Error('QUEUE_C_CODE 结构变化：未找到链队列分节锚点，需同步更新差分截取');
  return QUEUE_C_CODE.slice(0, idx);
})();

function generateCases(seed: number, count: number): DifferentialCase[] {
  const out: DifferentialCase[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(seed * 100003 + i + 41);
    // 容量 6 牺牲 1 格最多存 5：初始 ≤ 5
    const initLen = rng.int(0, 5);
    const values = Array.from({ length: initLen }, () => rng.int(-99, 99));
    const operations = [];
    const nOps = rng.int(20, 100);
    for (let j = 0; j < nOps; j++) {
      // enqueue/dequeue 近似均衡：wrap-around 与 full/empty 都会自然出现
      if (rng.bool(0.55)) {
        operations.push({ op: 'enqueue', args: [rng.int(-99, 99)] });
      } else {
        operations.push({ op: 'dequeue', args: [] });
      }
    }
    out.push({ structure: 'circular-queue', seed, initial: { structure: 'circular-queue', values }, operations });
  }
  return out;
}

export const queueSuite: StructureSuite = { id: 'circular-queue', generateCases, runTs, generateC };

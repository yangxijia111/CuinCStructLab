/**
 * 双向链表差分套件：pushFront/pushBack/deleteValue + forward/backward traversal。
 * C 侧 = DOUBLY_LIST_C_CODE 教学代码（全局 head）。
 * 链结构完整性验证：backward 必须是 forward 的严格反序（TS/C 双方都校验并输出 BWD）。
 */
import {
  DOUBLY_LIST_C_CODE,
  doublyListFrom,
  doublyPushFront,
  doublyPushBack,
  doublyDeleteValue,
  doublyListValues,
  doublyTraverseBackward,
} from '../../core/data-structures/doubly-list';
import type { ListState } from '../../core/types';
import { mulberry32 } from '../rng';
import type { DifferentialCase, StructureSuite, TsRunResult } from '../types';
import { lastState, visitNodeIds } from '../framework';

function nodeValue(state: ListState, id: string): number {
  const n = state.nodes.find((x) => x.id === id);
  if (n === undefined || n.value === null) throw new Error(`节点不存在: ${id}`);
  return n.value;
}

function runTs(c: DifferentialCase): TsRunResult {
  const observations: string[] = [];
  let state: ListState = lastState(doublyListFrom(c.initial.values ?? []))!;
  for (const op of c.operations) {
    const [a0] = op.args as number[];
    switch (op.op) {
      case 'pushFront': {
        const out = doublyPushFront(state, a0);
        observations.push(`pushFront rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'pushBack': {
        const out = doublyPushBack(state, a0);
        observations.push(`pushBack rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'deleteValue': {
        const out = doublyDeleteValue(state, a0);
        observations.push(`deleteValue rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'traverseBackward': {
        const out = doublyTraverseBackward(state);
        const vals = visitNodeIds(out).map((id) => nodeValue(state, id));
        observations.push(`bwd v=[${vals.join(',')}]`);
        break;
      }
      default:
        throw new Error(`doubly-list: 未知操作 ${op.op}`);
    }
  }
  const fwd = doublyListValues(state);
  const bwd = [...fwd].reverse();
  return {
    state: { kind: 'doubly-list', values: fwd, size: fwd.length, backward: bwd },
    observations,
  };
}

function generateC(cases: DifferentialCase[]): string {
  const lines: string[] = [];
  lines.push(...DOUBLY_LIST_C_CODE);
  lines.push(
    'static int cclabSize(void) {',
    '    int n = 0;',
    '    for (DNode *cur = head->next; cur != NULL; cur = cur->next) n++;',
    '    return n;',
    '}',
    'static void cclabPrintState(void) {',
    '    printf("S:[");',
    '    int first = 1;',
    '    for (DNode *cur = head->next; cur != NULL; cur = cur->next) {',
    '        printf("%s%d", first ? "" : ",", cur->data); first = 0;',
    '    }',
    '    printf("]\\nSIZE:%d\\n", cclabSize());',
    '    printf("BWD:[");',
    '    first = 1;',
    '    DNode *tail = head;',
    '    while (tail->next != NULL) tail = tail->next;',
    '    for (DNode *cur = tail; cur != head; cur = cur->prev) {',
    '        printf("%s%d", first ? "" : ",", cur->data); first = 0;',
    '    }',
    '    printf("]\\n");',
    '}',
    'static void cclabObsBwd(void) {',
    '    printf("OBS:bwd v=[");',
    '    int first = 1;',
    '    DNode *tail = head;',
    '    while (tail->next != NULL) tail = tail->next;',
    '    for (DNode *cur = tail; cur != head; cur = cur->prev) {',
    '        printf("%s%d", first ? "" : ",", cur->data); first = 0;',
    '    }',
    '    printf("]\\n");',
    '}',
    'static void cclabReset(void) {',
    '    if (head == NULL) return;',
    '    DNode *cur = head->next;',
    '    while (cur != NULL) { DNode *nx = cur->next; free(cur); cur = nx; }',
    '    head->prev = NULL;',
    '    head->next = NULL;',
    '}',
    'int main(void) {',
  );
  cases.forEach((c, ci) => {
    const vals = c.initial.values ?? [];
    lines.push(`    printf("BEGIN ${ci}\\n");`);
    lines.push('    {');
    lines.push('        if (head != NULL) cclabReset();');
    lines.push('        if (head == NULL) listInit();');
    vals.forEach((v) => lines.push(`        listPushBack(${v});`));
    for (const op of c.operations) {
      const [a0] = op.args as number[];
      switch (op.op) {
        case 'pushFront':
          lines.push(`        { int rc = listPushFront(${a0}); printf("OBS:pushFront rc=%d\\n", rc); }`);
          break;
        case 'pushBack':
          lines.push(`        { int rc = listPushBack(${a0}); printf("OBS:pushBack rc=%d\\n", rc); }`);
          break;
        case 'deleteValue':
          lines.push(`        { int rc = listDeleteValue(${a0}); printf("OBS:deleteValue rc=%d\\n", rc); }`);
          break;
        case 'traverseBackward':
          lines.push('        cclabObsBwd();');
          break;
        default:
          throw new Error(`doubly-list C: 未知操作 ${op.op}`);
      }
    }
    lines.push('        cclabPrintState();');
    lines.push('    }');
    lines.push(`    printf("END ${ci}\\n");`);
  });
  lines.push('    return 0;', '}');
  return lines.join('\n');
}

function generateCases(seed: number, count: number): DifferentialCase[] {
  const out: DifferentialCase[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(seed * 100003 + i + 13);
    const initLen = rng.int(0, 10);
    const values = Array.from({ length: initLen }, () => rng.int(-50, 50));
    const operations = [];
    const nOps = rng.int(20, 100);
    for (let j = 0; j < nOps; j++) {
      const kind = rng.int(0, 4);
      if (kind === 0) {
        operations.push({ op: 'pushFront', args: [rng.int(-50, 50)] });
      } else if (kind === 1) {
        operations.push({ op: 'pushBack', args: [rng.int(-50, 50)] });
      } else if (kind === 2 || kind === 3) {
        const v = rng.bool(0.5) && values.length > 0 ? values[rng.int(0, values.length - 1)]! : rng.int(-50, 50);
        operations.push({ op: 'deleteValue', args: [v] });
      } else {
        operations.push({ op: 'traverseBackward', args: [] });
      }
    }
    operations.push({ op: 'traverseBackward', args: [] });
    out.push({ structure: 'doubly-list', seed, initial: { structure: 'doubly-list', values }, operations });
  }
  return out;
}

export const doublyListSuite: StructureSuite = { id: 'doubly-list', generateCases, runTs, generateC };

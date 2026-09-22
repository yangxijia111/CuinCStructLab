/**
 * 单链表差分套件：pushFront/pushBack/insertAt/deleteAt/deleteValue/set/find/traverse。
 * C 侧 = LINKED_LIST_C_CODE 教学代码（全局 head，case 间 destroy 重建）。
 */
import {
  LINKED_LIST_C_CODE,
  listFrom,
  listPushFront,
  listPushBack,
  listInsertAt,
  listDeleteAt,
  listDeleteValue,
  listSet,
  listFind,
  listTraverse,
  listValues,
} from '../../core/data-structures/linked-list';
import type { ListState } from '../../core/types';
import { mulberry32 } from '../rng';
import type { DifferentialCase, StructureSuite, TsRunResult } from '../types';
import { hasVisit, lastState, visitNodeIds } from '../framework';

function nodeValue(state: ListState, id: string): number {
  const n = state.nodes.find((x) => x.id === id);
  if (n === undefined || n.value === null) throw new Error(`节点不存在: ${id}`);
  return n.value;
}

function runTs(c: DifferentialCase): TsRunResult {
  const observations: string[] = [];
  let state: ListState = lastState(listFrom(c.initial.values ?? []))!;
  for (const op of c.operations) {
    const [a0, a1] = op.args as number[];
    switch (op.op) {
      case 'pushFront': {
        const out = listPushFront(state, a0);
        observations.push(`pushFront rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'pushBack': {
        const out = listPushBack(state, a0);
        observations.push(`pushBack rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'insertAt': {
        const out = listInsertAt(state, a0, a1);
        observations.push(`insertAt rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'deleteAt': {
        const out = listDeleteAt(state, a0);
        observations.push(`deleteAt rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'deleteValue': {
        const out = listDeleteValue(state, a0);
        observations.push(`deleteValue rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'set': {
        const out = listSet(state, a0, a1);
        observations.push(`set rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'find': {
        const out = listFind(state, a0);
        observations.push(`find found=${hasVisit(out) ? 1 : 0}`);
        break;
      }
      case 'traverse': {
        const out = listTraverse(state);
        const vals = visitNodeIds(out).map((id) => nodeValue(state, id));
        observations.push(`traverse v=[${vals.join(',')}]`);
        break;
      }
      default:
        throw new Error(`linked-list: 未知操作 ${op.op}`);
    }
  }
  return { state: { kind: 'linked-list', values: listValues(state), size: listValues(state).length }, observations };
}

function generateC(cases: DifferentialCase[]): string {
  const lines: string[] = [];
  lines.push(...LINKED_LIST_C_CODE);
  lines.push(
    'static int cclabSize(void) {',
    '    int n = 0;',
    '    for (Node *cur = head->next; cur != NULL; cur = cur->next) n++;',
    '    return n;',
    '}',
    'static void cclabPrintState(void) {',
    '    printf("S:[");',
    '    int first = 1;',
    '    for (Node *cur = head->next; cur != NULL; cur = cur->next) {',
    '        printf("%s%d", first ? "" : ",", cur->data); first = 0;',
    '    }',
    '    printf("]\\nSIZE:%d\\n", cclabSize());',
    '}',
    'static void cclabObsTraverse(void) {',
    '    printf("OBS:traverse v=[");',
    '    int first = 1;',
    '    for (Node *cur = head->next; cur != NULL; cur = cur->next) {',
    '        printf("%s%d", first ? "" : ",", cur->data); first = 0;',
    '    }',
    '    printf("]\\n");',
    '}',
    'int main(void) {',
  );
  cases.forEach((c, ci) => {
    const vals = c.initial.values ?? [];
    lines.push(`    printf("BEGIN ${ci}\\n");`);
    lines.push('    {');
    // 全局 head 复位（首轮 head==NULL 时 destroy 安全跳过）
    lines.push('        listDestroy();');
    lines.push('        listInit();');
    vals.forEach((v) => lines.push(`        listPushBack(${v});`));
    for (const op of c.operations) {
      const [a0, a1] = op.args as number[];
      switch (op.op) {
        case 'pushFront':
          lines.push(`        { int rc = listPushFront(${a0}); printf("OBS:pushFront rc=%d\\n", rc); }`);
          break;
        case 'pushBack':
          lines.push(`        { int rc = listPushBack(${a0}); printf("OBS:pushBack rc=%d\\n", rc); }`);
          break;
        case 'insertAt':
          lines.push(`        { int rc = listInsertAt(${a0}, ${a1}); printf("OBS:insertAt rc=%d\\n", rc); }`);
          break;
        case 'deleteAt':
          lines.push(`        { int rc = listDeleteAt(${a0}); printf("OBS:deleteAt rc=%d\\n", rc); }`);
          break;
        case 'deleteValue':
          lines.push(`        { int rc = listDeleteValue(${a0}); printf("OBS:deleteValue rc=%d\\n", rc); }`);
          break;
        case 'set':
          lines.push(`        { int rc = listSet(${a0}, ${a1}); printf("OBS:set rc=%d\\n", rc); }`);
          break;
        case 'find':
          lines.push(`        printf("OBS:find found=%d\\n", listFind(${a0}) != NULL ? 1 : 0);`);
          break;
        case 'traverse':
          lines.push('        cclabObsTraverse();');
          break;
        default:
          throw new Error(`linked-list C: 未知操作 ${op.op}`);
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
    const rng = mulberry32(seed * 100003 + i + 7);
    const initLen = rng.int(0, 10);
    const values = Array.from({ length: initLen }, () => rng.int(-50, 50));
    const operations = [];
    const nOps = rng.int(20, 100);
    let size = initLen;
    for (let j = 0; j < nOps; j++) {
      const kind = rng.int(0, 7);
      if (kind === 0) {
        operations.push({ op: 'pushFront', args: [rng.int(-50, 50)] });
        size++;
      } else if (kind === 1) {
        operations.push({ op: 'pushBack', args: [rng.int(-50, 50)] });
        size++;
      } else if (kind === 2) {
        // insertAt pos<0 失败；pos>=size 夹取为尾插（教学语义，双方一致）
        const pos = rng.int(-1, size + 1);
        operations.push({ op: 'insertAt', args: [pos, rng.int(-50, 50)] });
        if (pos >= 0) size++;
      } else if (kind === 3) {
        const pos = rng.int(-1, size);
        operations.push({ op: 'deleteAt', args: [pos] });
        if (pos >= 0 && pos < size) size--;
      } else if (kind === 4) {
        const v = rng.bool(0.5) && size > 0 ? values[rng.int(0, values.length - 1)]! : rng.int(-50, 50);
        operations.push({ op: 'deleteValue', args: [v] });
        // 按值删除：粗略同步 size（值存在才 -1；差分由终态判定，size 跟踪只为生成合理 pos）
        size = Math.max(0, size - 1);
      } else if (kind === 5) {
        const from = rng.bool(0.5) && size > 0 ? values[rng.int(0, values.length - 1)]! : rng.int(-50, 50);
        operations.push({ op: 'set', args: [from, rng.int(-50, 50)] });
      } else if (kind === 6) {
        const v = rng.bool(0.5) && size > 0 ? values[rng.int(0, values.length - 1)]! : rng.int(-50, 50);
        operations.push({ op: 'find', args: [v] });
      } else {
        operations.push({ op: 'traverse', args: [] });
      }
    }
    operations.push({ op: 'traverse', args: [] });
    out.push({ structure: 'linked-list', seed, initial: { structure: 'linked-list', values }, operations });
  }
  return out;
}

export const linkedListSuite: StructureSuite = { id: 'linked-list', generateCases, runTs, generateC };

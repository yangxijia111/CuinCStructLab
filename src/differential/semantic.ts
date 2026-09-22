/**
 * 语义状态构造与比较（DIFFERENTIAL_TEST_SPEC §3/§4）。
 * canonical 顺序：字段按固定顺序序列化后比较，避免对象键序影响。
 */
import type { CCaseOutput, DiffCaseResult, DifferentialCase, SemanticState, TsRunResult } from './types';

/** canonical JSON（键排序，紧凑；排除 kind——C 侧解析不携带该标签字段，结构标识由 suite 保证一致） */
export function canonical(state: SemanticState | null | undefined): string {
  if (state === null || state === undefined) return 'null';
  const keys = Object.keys(state).filter((k) => k !== TAG_KEY && k !== 'kind').sort();
  const record = state as unknown as Record<string, unknown>;
  return JSON.stringify(keys.map((k) => [k, record[k]]));
}

/** 语义状态 + 观察序列是否一致 */
export function semanticEqual(ts: TsRunResult, c: CCaseOutput): { equal: boolean; firstDiff: string | null } {
  if (ts.observations.join('\n') !== c.observations.join('\n')) {
    const i = ts.observations.findIndex((o, idx) => o !== c.observations[idx]);
    return {
      equal: false,
      firstDiff: `observations[${i}]: TS=${JSON.stringify(ts.observations[i])} C=${JSON.stringify(c.observations[i])}`,
    };
  }
  const a = canonical(ts.state);
  const b = canonical(c.state);
  if (a !== b) {
    return { equal: false, firstDiff: `state: TS=${a} C=${b}` };
  }
  return { equal: true, firstDiff: null };
}

/** 数组 → C 侧 `S:[...]` 值 */
export function formatCArray(values: readonly number[]): string {
  return `[${values.join(',')}]`;
}

/**
 * 解析 C harness 输出（DIFFERENTIAL_TEST_SPEC §4 协议）。
 * 行格式 `TAG:value`；BEGIN/END 包住每个 case；OBS 行按序收集；未知 tag 忽略。
 */
export function parseCOutput(stdout: string): CCaseOutput[] {
  const results: CCaseOutput[] = [];
  let current: CCaseOutput | null = null;
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim();
    if (line === '') continue;
    const beginMatch = /^BEGIN (\d+)$/.exec(line);
    if (beginMatch !== null) {
      current = { index: Number(beginMatch[1]), state: { kind: 'unknown' }, observations: [] };
      continue;
    }
    if (/^END \d+$/.test(line)) {
      if (current !== null) results.push(current);
      current = null;
      continue;
    }
    if (current === null) continue;
    const obs = /^OBS:(.*)$/.exec(line);
    if (obs !== null) {
      current.observations.push(obs[1] ?? '');
      continue;
    }
    const m = /^([A-Z]+):(.*)$/.exec(line);
    if (m === null) continue;
    const tag = m[1] as string;
    const value = m[2] ?? '';
    const nums = parseCArray(value);
    switch (tag) {
      case 'S':
      case 'BWD':
      case 'IN':
      case 'ORDER':
      case 'ARR':
        // 先存原始数组，最后由 finishTag 归位（见下）
        pushTagged(current, tag, nums);
        break;
      case 'SIZE':
      case 'FULL':
      case 'EMPTY':
      case 'HEAPOK':
      case 'IDX':
        pushTagged(current, tag, Number(value));
        break;
      default:
        break; // 未知 tag 忽略（向前兼容）
    }
  }
  // 把 tagged 数组映射到 SemanticState 字段
  for (const r of results) {
    const t = taggedOf(r);
    const state: SemanticState = { kind: r.state.kind === 'unknown' ? 'unknown' : r.state.kind };
    if (t.S !== undefined) state.values = t.S;
    if (t.BWD !== undefined) state.backward = t.BWD;
    if (t.IN !== undefined) state.inorder = t.IN;
    if (t.ORDER !== undefined) state.order = t.ORDER;
    if (t.ARR !== undefined) state.values = t.ARR;
    if (t.SIZE !== undefined) state.size = t.SIZE;
    if (t.FULL !== undefined) state.full = t.FULL === 1 ? 1 : 0;
    if (t.EMPTY !== undefined) state.empty = t.EMPTY === 1 ? 1 : 0;
    if (t.HEAPOK !== undefined) state.heapProperty = t.HEAPOK === 1 ? 1 : 0;
    if (t.IDX !== undefined) state.foundIndex = t.IDX;
    r.state = state;
  }
  return results;
}

/** 解析 `[1,2,3]` / `[]` 为数字数组 */
function parseCArray(value: string): number[] {
  const inner = value.replace(/^\[/, '').replace(/\]$/, '');
  if (inner === '') return [];
  return inner.split(',').map((s) => Number(s));
}

/** 临时 tagged 存储（挂在 state 上的内部字段，最终归一化清除） */
interface Tagged {
  S?: number[];
  BWD?: number[];
  IN?: number[];
  ORDER?: number[];
  ARR?: number[];
  SIZE?: number;
  FULL?: number;
  EMPTY?: number;
  HEAPOK?: number;
  IDX?: number;
}

const TAG_KEY = '$tagged';

function pushTagged(cc: CCaseOutput, tag: string, value: number[] | number): void {
  const st = cc.state as SemanticState & { [TAG_KEY]?: Tagged };
  if (st[TAG_KEY] === undefined) st[TAG_KEY] = {};
  (st[TAG_KEY] as Record<string, unknown>)[tag] = value;
}

function taggedOf(cc: CCaseOutput): Tagged {
  return (cc.state as SemanticState & { [TAG_KEY]?: Tagged })[TAG_KEY] ?? {};
}

/** 生成失败报告文本（含 seed/initial/operations/双方结果，直接可复现） */
export function failureReport(c: DifferentialCase, r: DiffCaseResult): string {
  const lines = [
    `差分失败 [${c.structure}] case#${r.caseIndex} seed=${c.seed}`,
    `initial: ${JSON.stringify(c.initial)}`,
    `operations (${c.operations.length}):`,
    ...c.operations.map((op, i) => `  ${i}. ${op.op}(${op.args.join(', ')})`),
    `TS state: ${canonical(r.ts?.state)}`,
    `TS observations: ${JSON.stringify(r.ts?.observations)}`,
    `C state: ${canonical(r.c?.state)}`,
    `C observations: ${JSON.stringify(r.c?.observations)}`,
  ];
  if (r.firstDiff !== null) lines.push(`firstDiff: ${r.firstDiff}`);
  return lines.join('\n');
}

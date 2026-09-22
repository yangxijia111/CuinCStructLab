/**
 * Snapshot Engine 基准（P15 任务书二十九）：StepRecorder 快照法复杂度实测。
 * 运行：npm run bench:snapshot（node --expose-gc 供 heap 峰值观测；无 gc 时跳过 heap 列）。
 * 产出 markdown 表格 → docs/SNAPSHOT_ENGINE_AUDIT.md。
 */
import { performance } from 'node:perf_hooks';
import { it } from 'vitest';
import { sortWithSteps } from '../src/core/algorithms/sorting';
import { heapify, heapInsert } from '../src/core/data-structures/heap';
import { graphFrom, graphDFS, graphBFS } from '../src/core/data-structures/graph';
import { bstFrom } from '../src/core/data-structures/bst';
import type { VizOutcome } from '../src/core/types';
import type { VisualState } from '../src/core/types';

/** 确定性伪随机 */
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const randArr = (n: number, seed: number): number[] => Array.from({ length: n }, (_, i) => Math.floor(rng(seed + i)() * 1000));

const round2 = (x: number): number => Math.round(x * 100) / 100;

interface Row {
  场景: string;
  steps: number;
  '生成耗时ms': number;
  'serializedMB': number;
  'heap峰值增量MB': number | 'n/a';
}

const rows: Row[] = [];

function measure(label: string, fn: () => { steps: number; bytes: number }): void {
  const samples: number[] = [];
  let result = { steps: 0, bytes: 0 };
  let heapPeak = 0;
  const hasGc = typeof global.gc === 'function';
  for (let i = 0; i < 5; i++) {
    if (hasGc) global.gc();
    const heapBefore = process.memoryUsage().heapUsed;
    const t0 = performance.now();
    result = fn();
    samples.push(performance.now() - t0);
    heapPeak = Math.max(heapPeak, process.memoryUsage().heapUsed - heapBefore);
  }
  rows.push({
    场景: label,
    steps: result.steps,
    生成耗时ms: round2(Math.min(...samples)),
    serializedMB: round2(result.bytes / 1048576),
    heap峰值增量MB: hasGc ? round2(heapPeak / 1048576) : 'n/a',
  });
}

function stats<S extends VisualState>(outcome: VizOutcome<S>): { steps: number; bytes: number } {
  // 逐步序列化累计（整体 stringify 在 bubble n=256 时超出 V8 最大字符串长度——这本身就是审计发现）
  let bytes = 0;
  for (const s of outcome.steps) bytes += JSON.stringify(s).length;
  return { steps: outcome.steps.length, bytes };
}

function lastState<S extends VisualState>(outcome: VizOutcome<S>): S {
  return outcome.steps[outcome.steps.length - 1]!.afterState;
}

it('snapshot engine benchmark', { timeout: 600_000 }, () => {
  // Bubble Sort：教学规模 → 压力规模（快照法最坏场景）
  for (const n of [16, 32, 64, 128, 256]) {
    const arr = randArr(n, 42 + n);
    measure(`bubble n=${n}`, () => stats(sortWithSteps('bubble', arr)));
  }
  // 其他排序 n=256 对照
  for (const algo of ['selection', 'insertion', 'shell', 'merge', 'quick', 'heap'] as const) {
    const arr = randArr(256, 7 + algo.length);
    measure(`${algo} n=256`, () => stats(sortWithSteps(algo, arr)));
  }
  // Heap：Floyd 建堆 + 逐个插入
  const heapArr = randArr(256, 99);
  measure('heap heapify(max) n=256', () => stats(heapify(heapArr, 'max')));
  measure('heap 逐个 insert n=256（从空堆）', () => {
    let steps = 0;
    let bytes = 0;
    let state = lastState(heapify([], 'max'));
    for (const v of heapArr) {
      const out = heapInsert(state, v);
      steps += out.steps.length;
      bytes += JSON.stringify(out).length;
      state = lastState(out);
    }
    return { steps, bytes };
  });
  // Graph：完全图（教学邻接矩阵上限 20 顶点）
  const labels = Array.from({ length: 20 }, (_, i) => String.fromCharCode(65 + i));
  const edges: Array<[string, string]> = [];
  for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) edges.push([labels[i]!, labels[j]!]);
  const gState = lastState(graphFrom(labels, edges, false));
  measure('graph DFS 完全图 20 顶点', () => stats(graphDFS(gState, 'A')));
  measure('graph BFS 完全图 20 顶点', () => stats(graphBFS(gState, 'A')));
  // BST：随机 256 值建树
  measure('bst 建树 n=256（bstFrom）', () => stats(bstFrom(randArr(256, 1234))));

  const keys = Object.keys(rows[0]!) as Array<keyof Row>;
  console.log('\n| ' + keys.join(' | ') + ' |');
  console.log('|' + keys.map(() => '---').join('|') + '|');
  for (const r of rows) console.log('| ' + keys.map((k) => String(r[k])).join(' | ') + ' |');
});

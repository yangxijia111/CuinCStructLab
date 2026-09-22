/**
 * 差分测试：全部结构（DIFFERENTIAL_TEST_SPEC §6 规模）。
 * 需要真实 C 编译器；PATH 无编译器时显式跳过（CI 的 differential job 强制全量执行）。
 * 编译器选择：CCLAB_DIFF_COMPILER 强制指定（CI 各 job 用）；否则自动探测 gcc → clang → cl。
 */
import { describe, expect, it } from 'vitest';
import { runDifferential, type DiffReport } from '../../src/differential/node/run';
import { detectCompilerByKind, runCProgram, type CCompilerSpec } from '../../src/differential/node/c-exec';
import { SUITES } from '../../src/differential/framework';
import { parseCOutput, semanticEqual } from '../../src/differential/semantic';
import type { StructureId } from '../../src/differential/types';

// 顶层 await：探测结果在 describe.skipIf 评估前就绪
const forced = process.env.CCLAB_DIFF_COMPILER as 'gcc' | 'clang' | 'cl' | undefined;
const compiler: CCompilerSpec | null =
  forced !== undefined
    ? await detectCompilerByKind(forced)
    : (await detectCompilerByKind('gcc')) ?? (await detectCompilerByKind('clang')) ?? (await detectCompilerByKind('cl'));

const SEED = 20260922;
const COUNT = 100;

async function runAndExpect(structure: StructureId, count = COUNT): Promise<DiffReport> {
  const report = await runDifferential(structure, { seed: SEED, count, compiler: compiler ?? undefined });
  expect(report.fatal, `${structure} C 侧致命错误`).toBeNull();
  expect(report.failures, `${structure} 差分不一致（${report.failures.length} 例）`).toEqual([]);
  return report;
}

describe.skipIf(compiler === null)('差分：数据结构（教学 C ↔ TS Core）', () => {
  it(
    '顺序表：insert/delete/set/find/traverse × 100 轮随机',
    { timeout: 120_000 },
    async () => {
      await runAndExpect('seqlist');
    },
  );

  it(
    '单链表：8 种操作 × 100 轮随机（含越界/未找到失败语义）',
    { timeout: 120_000 },
    async () => {
      await runAndExpect('linked-list');
    },
  );

  it(
    '双向链表：forward/backward × 100 轮随机（prev/next 结构一致）',
    { timeout: 120_000 },
    async () => {
      await runAndExpect('doubly-list');
    },
  );

  it(
    '顺序栈：push/pop/peek × 100 轮随机（含满/空边界）',
    { timeout: 120_000 },
    async () => {
      await runAndExpect('stack');
    },
  );

  it(
    '循环队列：enqueue/dequeue × 100 轮随机（wrap-around/full/empty）',
    { timeout: 120_000 },
    async () => {
      await runAndExpect('circular-queue');
    },
  );

  it(
    'BST：insert/search/delete × 100 轮随机（删除覆盖 leaf/单孩子/双孩子/根）',
    { timeout: 120_000 },
    async () => {
      await runAndExpect('bst');
    },
  );

  it(
    'Heap：max/min × insert/deleteTop/heapify × 100 轮随机（堆数组逐位 + 堆性质）',
    { timeout: 120_000 },
    async () => {
      await runAndExpect('heap');
    },
  );

  it(
    'Graph 随机：DFS/BFS 遍历顺序（邻接序固定=编号升序）× 100 轮',
    { timeout: 120_000 },
    async () => {
      await runAndExpect('graph');
    },
  );

  it(
    'Graph 定向：连通/非连通/有向/无向/环/孤立点遍历',
    { timeout: 120_000 },
    async () => {
      const suite = SUITES.graph!;
      const directed: Array<{ name: string; labels: string[]; edges: Array<[string, string]>; directed: boolean }> = [
        { name: '链形无向', labels: ['A', 'B', 'C', 'D'], edges: [['A', 'B'], ['B', 'C'], ['C', 'D']], directed: false },
        { name: '环形有向', labels: ['A', 'B', 'C'], edges: [['A', 'B'], ['B', 'C'], ['C', 'A']], directed: true },
        { name: '非连通+孤立点', labels: ['A', 'B', 'C', 'D', 'E'], edges: [['A', 'B'], ['C', 'D']], directed: false },
        { name: '星形无向', labels: ['A', 'B', 'C', 'D', 'E'], edges: [['A', 'B'], ['A', 'C'], ['A', 'D'], ['A', 'E']], directed: false },
        { name: '有向不一致边', labels: ['A', 'B', 'C'], edges: [['A', 'B'], ['C', 'B']], directed: true },
        { name: '单点', labels: ['A'], edges: [], directed: false },
      ];
      const cases = directed.map((g, i) => ({
        structure: 'graph' as const,
        seed: i,
        initial: { structure: 'graph' as const, labels: g.labels, edges: g.edges, directed: g.directed },
        operations: [
          ...g.labels.map((l) => ({ op: 'dfs', args: [l] })),
          ...g.labels.map((l) => ({ op: 'bfs', args: [l] })),
        ],
      }));
      const result = await runCProgram(suite.generateC(cases), compiler!);
      expect(result.compileError, `graph 定向编译失败: ${result.compileError ?? ''}`).toBeNull();
      const outputs = parseCOutput(result.stdout);
      expect(outputs.length).toBe(cases.length);
      for (let i = 0; i < cases.length; i++) {
        const ts = suite.runTs(cases[i]!);
        const eq = semanticEqual(ts, outputs[i]!);
        expect(eq.equal, `${directed[i]!.name}: ${eq.firstDiff ?? ''}`).toBe(true);
      }
    },
  );
});

describe.skipIf(compiler === null)('差分：排序与查找', () => {
  it(
    '7 种排序 × 100 组输入（空/单/已序/逆序/全重复/负数/随机/大重复率）',
    { timeout: 300_000 },
    async () => {
      await runAndExpect('sorting');
    },
  );

  it(
    '二分查找 × 100 组有序数组（存在/不存在/首/末/重复段，any-match 规范）',
    { timeout: 120_000 },
    async () => {
      await runAndExpect('binary-search');
    },
  );
});

describe.skipIf(compiler === null)('差分：可复现性', () => {
  it('同 seed 两轮生成的 C 源码完全一致（CI 可复现保证）', () => {
    const src1 = SUITES['linked-list']!.generateC(SUITES['linked-list']!.generateCases(SEED, 5));
    const src2 = SUITES['linked-list']!.generateC(SUITES['linked-list']!.generateCases(SEED, 5));
    expect(src1).toBe(src2);
  });
});

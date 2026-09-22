/**
 * 图差分套件：DFS/BFS 遍历顺序。
 * C 侧 = GRAPH_C_CODE 教学代码。教学 dfs/bfs 用 printf 输出访问序——生成 harness 时
 * 将这两行输出语句机械替换为记录函数（仅替换 IO，遍历逻辑一字不改）。
 * 邻接访问顺序双方固定：TS 按顶点加入序（labels 顺序），C 按编号 0..n-1 升序 —— labels 按 A,B,C… 传入即一致。
 */
import { GRAPH_C_CODE, graphFrom, graphDFS, graphBFS } from '../../core/data-structures/graph';
import type { GraphState } from '../../core/types';
import { mulberry32 } from '../rng';
import type { DifferentialCase, StructureSuite, TsRunResult } from '../types';
import { lastState } from '../framework';

function runTs(c: DifferentialCase): TsRunResult {
  const observations: string[] = [];
  const labels = c.initial.labels ?? [];
  const state: GraphState = lastState(graphFrom(labels, c.initial.edges ?? [], c.initial.directed === true))!;
  for (const op of c.operations) {
    const start = op.args[0] as string;
    if (op.op === 'dfs') {
      const out = graphDFS(state, start);
      const visited = (lastState(out) ?? state).visited;
      observations.push(`dfs order=[${visited.map((id) => labels.indexOf(id)).join(',')}]`);
    } else if (op.op === 'bfs') {
      const out = graphBFS(state, start);
      const visited = (lastState(out) ?? state).visited;
      observations.push(`bfs order=[${visited.map((id) => labels.indexOf(id)).join(',')}]`);
    } else {
      throw new Error(`graph: 未知操作 ${op.op}`);
    }
  }
  return {
    state: { kind: 'graph', order: [], size: labels.length },
    observations,
  };
}

/** 教学 dfs/bfs 的输出语句（buildLineMap 同款锚点）→ 替换为访问序记录（逻辑不变，仅 IO 改道） */
const DFS_PRINT_LINE = '    printf("%d ", u);';
const RECORD_FN = '    cclabRecord(u);';

function generateC(cases: DifferentialCase[]): string {
  const teaching = GRAPH_C_CODE.map((l) => (l === DFS_PRINT_LINE ? RECORD_FN : l)).join('\n');
  const count = GRAPH_C_CODE.filter((l) => l === DFS_PRINT_LINE).length;
  if (count !== 2) throw new Error(`GRAPH_C_CODE 结构变化：期望 2 处遍历输出语句，实际 ${count}`);
  const lines: string[] = [];
  lines.push(teaching);
  lines.push(
    'static int cclabOrder[64];',
    'static int cclabOrderN;',
    'static void cclabRecord(int u) { cclabOrder[cclabOrderN++] = u; }',
    'static void cclabClearVisited(void) { for (int i = 0; i < MAXN; i++) visited[i] = 0; }',
    'static void cclabPrintOrder(const char *tag) {',
    '    printf("OBS:%s order=[", tag);',
    '    for (int i = 0; i < cclabOrderN; i++) { printf("%s%d", i ? "," : "", cclabOrder[i]); }',
    '    printf("]\\n");',
    '}',
    'int main(void) {',
  );
  cases.forEach((c, ci) => {
    const labels = c.initial.labels ?? [];
    const edges = c.initial.edges ?? [];
    const directed = c.initial.directed === true ? 1 : 0;
    lines.push(`    printf("BEGIN ${ci}\\n");`);
    lines.push('    {');
    lines.push(`        MatrixGraph g;`);
    lines.push(`        for (int i = 0; i < MAXN; i++) { for (int j = 0; j < MAXN; j++) g.matrix[i][j] = 0; }`);
    lines.push(`        g.n = ${labels.length}; g.directed = ${directed};`);
    edges.forEach(([u, v]) => {
      const ui = labels.indexOf(u);
      const vi = labels.indexOf(v);
      if (ui < 0 || vi < 0) throw new Error(`graph 边引用不存在的顶点: ${u}-${v}`);
      lines.push(`        mgAddEdge(&g, ${ui}, ${vi});`);
    });
    for (const op of c.operations) {
      const si = labels.indexOf(op.args[0] as string);
      if (si < 0) throw new Error(`graph 起点不存在: ${String(op.args[0])}`);
      if (op.op === 'dfs') {
        lines.push('        cclabOrderN = 0; cclabClearVisited();');
        lines.push(`        dfs(&g, ${si});`);
        lines.push('        cclabPrintOrder("dfs");');
      } else if (op.op === 'bfs') {
        lines.push('        cclabOrderN = 0; cclabClearVisited();');
        lines.push(`        bfs(&g, ${si});`);
        lines.push('        cclabPrintOrder("bfs");');
      } else {
        throw new Error(`graph C: 未知操作 ${op.op}`);
      }
    }
    lines.push('    }');
    lines.push(`    printf("END ${ci}\\n");`);
  });
  lines.push('    return 0;', '}');
  return lines.join('\n');
}

/** 生成一个随机图：n 顶点 + m 条边（标签 A..，去重，无自环） */
function randomGraph(rng: ReturnType<typeof mulberry32>, maxN: number): { labels: string[]; edges: Array<[string, string]>; directed: boolean } {
  const n = rng.int(2, maxN);
  const labels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
  const directed = rng.bool(0.4);
  const seen = new Set<string>();
  const edges: Array<[string, string]> = [];
  const maxEdges = directed ? n * (n - 1) : (n * (n - 1)) / 2;
  const m = Math.min(maxEdges, rng.int(0, n + 2));
  for (let k = 0; k < m; k++) {
    const u = rng.int(0, n - 1);
    const v = rng.int(0, n - 1);
    if (u === v) continue;
    const key = `${u}-${v}`;
    if (seen.has(key) || (!directed && seen.has(`${v}-${u}`))) continue;
    seen.add(key);
    edges.push([labels[u]!, labels[v]!]);
  }
  return { labels, edges, directed };
}

function generateCases(seed: number, count: number): DifferentialCase[] {
  const out: DifferentialCase[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(seed * 100003 + i + 79);
    const g = randomGraph(rng, 8);
    const operations = [];
    // 每种遍历各跑：随机起点 + 固定起点 A
    const starts = [String.fromCharCode(65 + rng.int(0, g.labels.length - 1)), 'A'];
    for (const s of starts) {
      if (rng.bool(0.8)) operations.push({ op: 'dfs', args: [s] });
      if (rng.bool(0.8)) operations.push({ op: 'bfs', args: [s] });
    }
    out.push({ structure: 'graph', seed, initial: { structure: 'graph', labels: g.labels, edges: g.edges, directed: g.directed }, operations });
  }
  return out;
}

export const graphSuite: StructureSuite = { id: 'graph', generateCases, runTs, generateC };

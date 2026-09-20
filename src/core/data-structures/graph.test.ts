import { describe, expect, it } from 'vitest';
import type { GraphState } from '../types';
import {
  GRAPH_C_CODE,
  adjacencyList,
  adjacencyMatrix,
  graphAddEdge,
  graphAddNode,
  graphBFS,
  graphDFS,
  graphFrom,
  graphMoveNode,
  graphRemoveEdge,
  graphRemoveNode,
} from './graph';

function finalState(outcome: { steps: { afterState: GraphState }[] }): GraphState {
  const last = outcome.steps[outcome.steps.length - 1];
  if (last === undefined) throw new Error('没有步骤');
  return last.afterState;
}

function assertCodeLines(steps: { codeLine: number }[]): void {
  for (const [i, step] of steps.entries()) {
    expect(step.codeLine, `step${i}`).toBeLessThanOrEqual(GRAPH_C_CODE.length);
    expect(step.codeLine, `step${i}`).toBeGreaterThanOrEqual(0);
  }
}

const G5 = finalState(graphFrom(['A', 'B', 'C', 'D', 'E'], [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['D', 'E']]));

describe('图的基本操作', () => {
  it('邻接矩阵与邻接表一致（无向图对称）', () => {
    const m = adjacencyMatrix(G5);
    expect(m[0]).toEqual([0, 1, 1, 0, 0]);
    expect(m[1]).toEqual([1, 0, 0, 1, 0]);
    // 对称
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) expect(m[i]![j]).toBe(m[j]![i]);
    const list = adjacencyList(G5);
    expect(list.find((x) => x.id === 'A')?.neighbors).toEqual(['B', 'C']);
    expect(list.find((x) => x.id === 'D')?.neighbors).toEqual(['B', 'C', 'E']);
  });

  it('添加/删除顶点（级联删边）', () => {
    let s = finalState(graphFrom(['A', 'B'], [['A', 'B']]));
    s = finalState(graphAddNode(s, 'C'));
    expect(Object.keys(s.nodes)).toHaveLength(3);
    s = finalState(graphRemoveNode(s, 'A'));
    expect(s.edges).toHaveLength(0); // A-B 边被级联删除
    // 重复添加失败
    expect(graphAddNode(s, 'B').ok).toBe(false);
    expect(graphRemoveNode(s, 'Z').ok).toBe(false);
  });

  it('添加/删除边', () => {
    let s = finalState(graphFrom(['A', 'B', 'C'], []));
    s = finalState(graphAddEdge(s, 'A', 'B'));
    expect(s.edges).toHaveLength(2); // 无向图双向记录
    expect(graphAddEdge(s, 'A', 'B').ok).toBe(false); // 重复
    s = finalState(graphRemoveEdge(s, 'A', 'B'));
    expect(s.edges).toHaveLength(0);
    expect(graphAddEdge(s, 'A', 'Z').ok).toBe(false); // 顶点不存在
  });

  it('拖动节点', () => {
    const s2 = graphMoveNode(G5, 'A', 123, 456);
    expect(s2.nodes['A']).toMatchObject({ x: 123, y: 456 });
    expect(G5.nodes['A']?.x).not.toBe(123); // 原状态未被修改
  });
});

describe('DFS / BFS', () => {
  it('DFS 顺序（邻接按顶点序）', () => {
    const out = graphDFS(G5, 'A');
    const order = out.steps.find((st) => st.title.includes('DFS 完成'))?.title.match(/：(.+)$/)?.[1];
    expect(order).toBe('A → B → D → C → E');
    assertCodeLines(out.steps);
  });

  it('BFS 顺序（分层）', () => {
    const out = graphBFS(G5, 'A');
    const order = out.steps.find((st) => st.title.includes('BFS 完成'))?.title.match(/：(.+)$/)?.[1];
    expect(order).toBe('A → B → C → D → E');
    assertCodeLines(out.steps);
  });

  it('非连通图：从 A 出发只访问连通分量', () => {
    const s = finalState(graphFrom(['A', 'B', 'C', 'D'], [['A', 'B']]));
    const dfsOut = graphDFS(s, 'A');
    expect(finalState(dfsOut).visited).toEqual(['A', 'B']);
    const bfsOut = graphBFS(s, 'A');
    expect(finalState(bfsOut).visited).toEqual(['A', 'B']);
  });

  it('有环图不重复访问（visited 保护）', () => {
    const s = finalState(graphFrom(['A', 'B', 'C'], [['A', 'B'], ['B', 'C'], ['C', 'A']]));
    const dfsOut = graphDFS(s, 'A');
    const visited = finalState(dfsOut).visited;
    expect(new Set(visited).size).toBe(3);
    // 每个顶点只被 visit 一次
    const visitSteps = dfsOut.steps.filter((st) => st.type === 'visit');
    expect(visitSteps).toHaveLength(3);
  });

  it('有向图按方向遍历', () => {
    const s = finalState(graphFrom(['A', 'B', 'C'], [['A', 'B'], ['B', 'C'], ['C', 'A']], true));
    const dfsOut = graphDFS(s, 'B');
    expect(finalState(dfsOut).visited).toEqual(['B', 'C', 'A']);
  });

  it('DFS 展示栈 / BFS 展示队列', () => {
    const dfsOut = graphDFS(G5, 'A');
    expect(dfsOut.steps.some((st) => st.title.includes('递归栈深度'))).toBe(true);
    const bfsOut = graphBFS(G5, 'A');
    expect(bfsOut.steps.some((st) => st.title.includes('入队'))).toBe(true);
    expect(bfsOut.steps.some((st) => st.title.includes('出队'))).toBe(true);
  });

  it('起点不存在时报错', () => {
    expect(graphDFS(G5, 'Z').ok).toBe(false);
    expect(graphBFS(G5, 'Z').ok).toBe(false);
  });

  it('单顶点图', () => {
    const s = finalState(graphFrom(['X'], []));
    expect(finalState(graphDFS(s, 'X')).visited).toEqual(['X']);
    expect(finalState(graphBFS(s, 'X')).visited).toEqual(['X']);
  });
});

/**
 * 图：邻接矩阵 + 邻接表、增删点边、DFS（栈展示）/ BFS（队列展示）（DATA_STRUCTURE_SPEC §8）。
 */
import { StepRecorder } from '../recorder';
import type { GraphEdge, GraphState, Step, VizOutcome } from '../types';

/** 教学 C 代码（Step.codeLine 指向这里，1-based） */
export const GRAPH_C_CODE: string[] = [
  '/* 图的存储与遍历：邻接矩阵 + 邻接表，DFS + BFS */',
  '#include <stdio.h>',
  '#include <stdlib.h>',
  '',
  '#define MAXN 20',
  '',
  '/* ---------- 邻接矩阵：matrix[u][v] = 1 表示 u→v 有边 ---------- */',
  'typedef struct {',
  '    int matrix[MAXN][MAXN];   /* 二维数组 */',
  '    int n;                    /* 顶点个数 */',
  '    int directed;             /* 1 有向 / 0 无向 */',
  '} MatrixGraph;',
  '',
  'void mgAddEdge(MatrixGraph *g, int u, int v) {',
  '    g->matrix[u][v] = 1;',
  '    if (!g->directed) {',
  '        g->matrix[v][u] = 1;  /* 无向图：两个方向都置 1 */',
  '    }',
  '}',
  '',
  'void mgRemoveEdge(MatrixGraph *g, int u, int v) {',
  '    g->matrix[u][v] = 0;',
  '    if (!g->directed) {',
  '        g->matrix[v][u] = 0;',
  '    }',
  '}',
  '',
  '/* ---------- 邻接表：每个顶点挂一条单链表 ---------- */',
  'typedef struct AdjNode {',
  '    int v;                    /* 邻居编号 */',
  '    struct AdjNode *next;',
  '} AdjNode;',
  '',
  'typedef struct {',
  '    AdjNode *heads[MAXN];     /* heads[i] 指向 i 的邻居链表 */',
  '    int n;',
  '} ListGraph;',
  '',
  '/* ---------- DFS 深度优先：一条路走到黑，走不通再回头 ----------',
  '   递归版：visited 防止重复访问（有环图必须！） */',
  'int visited[MAXN];',
  '',
  'void dfs(MatrixGraph *g, int u) {',
  '    visited[u] = 1;                 /* 标记，永不再来 */',
  '    printf("%d ", u);',
  '    for (int v = 0; v < g->n; v++) {',
  '        if (g->matrix[u][v] && !visited[v]) {',
  '            dfs(g, v);              /* 对未访问的邻居递归 */',
  '        }',
  '    }',
  '}',
  '',
  '/* ---------- BFS 广度优先：一圈一圈向外扩，借助队列 ---------- */',
  'void bfs(MatrixGraph *g, int start) {',
  '    int visited[MAXN] = {0};',
  '    int queue[MAXN], front = 0, rear = 0;',
  '    visited[start] = 1;',
  '    queue[rear++] = start;          /* 起点入队 */',
  '    while (front < rear) {',
  '        int u = queue[front++];     /* 出队 */',
  '        printf("%d ", u);',
  '        for (int v = 0; v < g->n; v++) {',
  '            if (g->matrix[u][v] && !visited[v]) {',
  '                visited[v] = 1;     /* 入队时立刻标记，防止重复入队 */',
  '                queue[rear++] = v;',
  '            }',
  '        }',
  '    }',
  '}',
];

/* ============ 状态构造 ============ */

/** 自动圆形布局坐标 */
function circleLayout(count: number, index: number): { x: number; y: number } {
  const cx = 260;
  const cy = 200;
  const r = 150;
  const angle = (2 * Math.PI * index) / Math.max(count, 1) - Math.PI / 2;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

export function emptyGraph(directed = false): GraphState {
  return {
    kind: 'graph',
    nodes: {},
    edges: [],
    directed,
    representation: 'matrix',
    visited: [],
    current: null,
    next: null,
    frontier: [],
    frontierKind: null,
    seq: 1,
  };
}

/**
 * 从边列表建图。nodes 用 'A','B','C'… 或数字标签。
 * edges: [u, v] 标签对。可选坐标覆盖（拖动后保存）。
 */
export function graphFrom(
  labels: string[],
  edges: Array<[string, string]>,
  directed = false,
): VizOutcome<GraphState> {
  const rec = new StepRecorder<GraphState>(emptyGraph(directed));
  rec.record({
    type: 'create',
    title: `创建${directed ? '有向' : '无向'}图：${labels.length} 个顶点，${edges.length} 条边`,
    description: `顶点：${labels.join('、')}；边：${edges.map(([u, v]) => `${u}-${v}`).join('、')}${edges.length === 0 ? '（无）' : ''}。`,
    codeLine: 8,
    highlight: labels,
    mutate: (s) => {
      labels.forEach((label, i) => {
        const { x, y } = circleLayout(labels.length, i);
        s.nodes[label] = { id: label, label, x, y };
      });
      for (const [u, v] of edges) {
        s.edges.push({ from: u, to: v });
        if (!directed) s.edges.push({ from: v, to: u });
      }
      s.seq = labels.length + 1;
    },
  });
  return rec.finish();
}

/** 邻接矩阵（矩阵视图数据） */
export function adjacencyMatrix(state: GraphState): number[][] {
  const ids = Object.keys(state.nodes);
  const m = ids.map(() => ids.map(() => 0));
  for (const e of state.edges) {
    const i = ids.indexOf(e.from);
    const j = ids.indexOf(e.to);
    if (i >= 0 && j >= 0) m[i]![j] = 1;
  }
  return m;
}

/** 邻接表（表视图数据） */
export function adjacencyList(state: GraphState): Array<{ id: string; neighbors: string[] }> {
  const ids = Object.keys(state.nodes);
  return ids.map((id) => ({
    id,
    neighbors: state.edges.filter((e) => e.from === id).map((e) => e.to),
  }));
}

/** 图中是否存在边 */
function hasEdge(state: GraphState, u: string, v: string): boolean {
  return state.edges.some((e) => e.from === u && e.to === v);
}

/* ============ 增删点边 ============ */

export function graphAddNode(state: GraphState, label: string, x?: number, y?: number): VizOutcome<GraphState> {
  const rec = new StepRecorder<GraphState>(state);
  if (state.nodes[label] !== undefined) {
    rec.fail('顶点已存在', `顶点 ${label} 已在图中。`, 0);
    return rec.finish();
  }
  const count = Object.keys(state.nodes).length;
  const pos = { x: x ?? 40 + (count % 5) * 110, y: y ?? 40 + Math.floor(count / 5) * 110 };
  rec.record({
    type: 'insert',
    title: `添加顶点 ${label}`,
    description: `新顶点没有边，孤立在图里。`,
    highlight: [label],
    mutate: (s) => {
      s.nodes[label] = { id: label, label, x: pos.x, y: pos.y };
    },
  });
  return rec.finish();
}

export function graphRemoveNode(state: GraphState, label: string): VizOutcome<GraphState> {
  const rec = new StepRecorder<GraphState>(state);
  if (state.nodes[label] === undefined) {
    rec.fail('顶点不存在', `图中没有顶点 ${label}。`, 0);
    return rec.finish();
  }
  const degree = state.edges.filter((e) => e.from === label || e.to === label).length;
  rec.record({
    type: 'delete',
    title: `删除顶点 ${label}${degree > 0 ? `（级联删除 ${degree} 条相关边）` : '（无边）'}`,
    description: '删顶点必须同时删掉与它相连的所有边，否则边会指向不存在的顶点。',
    highlight: [label],
    mutate: (s) => {
      delete s.nodes[label];
      s.edges = s.edges.filter((e) => e.from !== label && e.to !== label);
      s.visited = s.visited.filter((v) => v !== label);
    },
  });
  return rec.finish();
}

export function graphAddEdge(state: GraphState, u: string, v: string, directed?: boolean): VizOutcome<GraphState> {
  const rec = new StepRecorder<GraphState>(state);
  const isDirected = directed ?? state.directed;
  if (state.nodes[u] === undefined || state.nodes[v] === undefined) {
    rec.fail('顶点不存在', `顶点 ${u} 或 ${v} 不在图中。`, 0);
    return rec.finish();
  }
  if (hasEdge(state, u, v)) {
    rec.fail('边已存在', `${u} → ${v} 已经存在。`, 0);
    return rec.finish();
  }
  rec.record({
    type: 'insert',
    title: `添加边 ${u} - ${v}${isDirected ? '（有向）' : ''}`,
    description: isDirected
      ? `matrix[${u}][${v}] = 1。`
      : `无向图两个方向都置 1：matrix[${u}][${v}] = matrix[${v}][${u}] = 1。`,
    codeLine: 15,
    highlight: [u, v],
    mutate: (s) => {
      s.edges.push({ from: u, to: v });
      if (!isDirected) s.edges.push({ from: v, to: u });
    },
  });
  return rec.finish();
}

export function graphRemoveEdge(state: GraphState, u: string, v: string, directed?: boolean): VizOutcome<GraphState> {
  const rec = new StepRecorder<GraphState>(state);
  const isDirected = directed ?? state.directed;
  if (!hasEdge(state, u, v)) {
    rec.fail('边不存在', `${u} → ${v} 不存在。`, 0);
    return rec.finish();
  }
  rec.record({
    type: 'delete',
    title: `删除边 ${u} - ${v}`,
    description: isDirected ? '' : '无向图两个方向的记录一起清零。',
    codeLine: 21,
    highlight: [u, v],
    mutate: (s) => {
      s.edges = s.edges.filter((e) => !(e.from === u && e.to === v) && !(e.from === v && e.to === u));
    },
  });
  return rec.finish();
}

/** 拖动节点（无步骤，直接返回新状态） */
export function graphMoveNode(state: GraphState, id: string, x: number, y: number): GraphState {
  const s = structuredClone(state);
  const node = s.nodes[id];
  if (node !== undefined) {
    node.x = x;
    node.y = y;
  }
  return s;
}

/* ============ DFS / BFS ============ */

/** 邻居顺序：按顶点加入顺序（矩阵列序） */
function neighborsOf(state: GraphState, u: string): string[] {
  const ids = Object.keys(state.nodes);
  const res: string[] = [];
  for (const v of ids) {
    if (hasEdge(state, u, v)) res.push(v);
  }
  return res;
}

export function graphDFS(state: GraphState, start: string): VizOutcome<GraphState> {
  const rec = new StepRecorder<GraphState>(state);
  if (state.nodes[start] === undefined) {
    rec.fail('起点不存在', `图中没有顶点 ${start}。`, 0);
    return rec.finish();
  }

  const visited = new Set<string>();
  const stack: string[] = [];

  rec.record({
    type: 'init',
    title: `从 ${start} 开始 DFS（深度优先：一条路走到黑，走不通再回头）`,
    description: 'visited 数组防止重复访问——图里有环时没有它会无限循环。',
    beginnerNote: 'DFS 像走迷宫：沿一条路一直走，走到死胡同就退回上一个岔路口换条路。递归调用栈（或显式栈）记住"从哪来"。',
    codeLine: 45,
    highlight: [start],
    callStack: [],
    mutate: (s) => {
      s.visited = [];
      s.frontier = [];
      s.frontierKind = 'stack';
      s.current = null;
      s.next = null;
    },
  });

  function dfs(u: string): void {
    visited.add(u);
    stack.push(u);
    rec.record({
      type: 'visit',
      title: `访问 ${u}，visited[${u}] = 1（递归栈深度 ${stack.length}）`,
      description: `已访问集合：${[...visited].join(' ')}。`,
      codeLine: 46,
      highlight: [u],
      callStack: stack.map((id) => ({ fn: `dfs(${id})` })),
      mutate: (s) => {
        s.current = u;
        s.visited = [...visited];
        s.frontier = [...stack];
      },
    });

    for (const v of neighborsOf(rec.state, u)) {
      if (visited.has(v)) {
        rec.record({
          type: 'compare',
          title: `看邻居 ${v}：已访问过，跳过`,
          description: 'visited 拦住了已经走过的顶点，避免绕圈。',
          codeLine: 50,
          highlight: [u, v],
          callStack: stack.map((id) => ({ fn: `dfs(${id})` })),
          mutate: (s) => {
            s.next = v;
          },
        });
        continue;
      }
      rec.record({
        type: 'move',
        title: `发现未访问邻居 ${v}：递归 dfs(${v})`,
        description: `放下其他邻居，先深入 ${v}。`,
        codeLine: 51,
        highlight: [u, v],
        callStack: stack.map((id) => ({ fn: `dfs(${id})` })),
        mutate: (s) => {
          s.next = v;
        },
      });
      dfs(v);
    }

    stack.pop();
    rec.record({
      type: 'return',
      title: `dfs(${u}) 的邻居都处理完了：回溯`,
      description: `${u} 的所有可达顶点都访问过了，返回上一层。`,
      codeLine: 52,
      highlight: [u],
      callStack: stack.map((id) => ({ fn: `dfs(${id})` })),
      mutate: (s) => {
        s.frontier = [...stack];
      },
    });
  }

  dfs(start);

  rec.record({
    type: 'info',
    title: `DFS 完成，访问顺序：${[...visited].join(' → ')}`,
    description: `共访问 ${visited.size} 个顶点。`,
    codeLine: 48,
    callStack: [],
    mutate: (s) => {
      s.current = null;
      s.next = null;
      s.frontier = [];
      s.frontierKind = null;
    },
  });

  return rec.finish();
}

export function graphBFS(state: GraphState, start: string): VizOutcome<GraphState> {
  const rec = new StepRecorder<GraphState>(state);
  if (state.nodes[start] === undefined) {
    rec.fail('起点不存在', `图中没有顶点 ${start}。`, 0);
    return rec.finish();
  }

  const visited = new Set<string>([start]);
  const queue: string[] = [start];

  rec.record({
    type: 'init',
    title: `从 ${start} 开始 BFS（广度优先：一圈一圈向外扩）`,
    description: '队列是 BFS 的核心：先发现的先处理，保证按距离分层。',
    beginnerNote: 'BFS 像水波扩散：从起点出发，先访问距离 1 的所有顶点，再距离 2 的……队列"先进先出"正好维持这个顺序。',
    codeLine: 55,
    highlight: [start],
    mutate: (s) => {
      s.visited = [start];
      s.frontier = [start];
      s.frontierKind = 'queue';
      s.current = null;
      s.next = null;
    },
  });

  while (queue.length > 0) {
    const u = queue.shift()!;
    rec.record({
      type: 'visit',
      title: `出队 ${u} 并访问（队列：[${queue.join(', ')}]）`,
      description: `访问顺序由入队顺序决定。已访问：${[...visited].join(' ')}。`,
      codeLine: 60,
      highlight: [u],
      mutate: (s) => {
        s.current = u;
        s.frontier = [...queue];
        s.visited = [...visited];
      },
    });

    for (const v of neighborsOf(rec.state, u)) {
      if (visited.has(v)) {
        rec.record({
          type: 'compare',
          title: `看邻居 ${v}：已在队列或已访问，跳过`,
          description: '入队时立刻标记 visited，同一个顶点绝不会第二次入队。',
          codeLine: 64,
          highlight: [u, v],
          mutate: (s) => {
            s.next = v;
          },
        });
        continue;
      }
      visited.add(v);
      queue.push(v);
      rec.record({
        type: 'insert',
        title: `${v} 入队并标记 visited（队列：[${queue.join(', ')}]）`,
        description: `发现新顶点 ${v}：放到队尾等待访问。`,
        beginnerNote: '注意标记时机：入队时就标记（而不是出队时），否则同一顶点可能被多个邻居重复入队。',
        codeLine: 65,
        highlight: [u, v],
        mutate: (s) => {
          s.next = v;
          s.frontier = [...queue];
          s.visited = [...visited];
        },
      });
    }
  }

  rec.record({
    type: 'info',
    title: `BFS 完成，访问顺序：${[...visited].join(' → ')}`,
    description: `共访问 ${visited.size} 个顶点。`,
    codeLine: 62,
    mutate: (s) => {
      s.current = null;
      s.next = null;
      s.frontier = [];
      s.frontierKind = null;
    },
  });

  return rec.finish();
}

export type GraphStep = Step<GraphState>;
export type { GraphEdge };

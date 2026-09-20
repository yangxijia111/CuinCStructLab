/**
 * 树 / BST / 堆 渲染器（VISUALIZATION_SPEC §5.5/§5.6）。
 * 布局：中序位置定 x、深度定 y（节点不重叠）；堆附数组条双视图。
 */
import type { HeapState, TreeState } from '../../core/types';

interface Positioned {
  id: string;
  value: number;
  x: number;
  y: number;
  left: string | null;
  right: string | null;
  /** 堆布局用：本层槽位数与层内偏移 */
  levelSlots?: number;
  offsetInLevel?: number;
}

/** 中序 x + 深度 y 布局 */
function layoutTree(state: TreeState): Positioned[] {
  const out: Positioned[] = [];
  let counter = 0;
  const seen = new Set<string>();
  function walk(id: string | null, depth: number): void {
    if (id === null || seen.has(id)) return;
    seen.add(id);
    const node = state.nodes[id];
    if (node === undefined) return;
    walk(node.left, depth + 1);
    out.push({ id, value: node.value, x: counter, y: depth, left: node.left, right: node.right });
    counter += 1;
    walk(node.right, depth + 1);
  }
  walk(state.root, 0);
  return out;
}

const NODE_W = 44;
const NODE_H = 32;
const GAP_X = 58;
const GAP_Y = 64;

export function TreeView({ state, highlight }: { state: TreeState; highlight: string[] }): React.ReactElement {
  const nodes = layoutTree(state);
  const maxX = Math.max(...nodes.map((n) => n.x), 0);
  const maxY = Math.max(...nodes.map((n) => n.y), 0);
  const width = (maxX + 1) * GAP_X + 40;
  const height = (maxY + 1) * GAP_Y + 30;
  const px = (n: Positioned): number => 28 + n.x * GAP_X;
  const py = (n: Positioned): number => 22 + n.y * GAP_Y;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visitOrder = state.visitOrder ?? [];
  const freed = new Set(Object.values(state.nodes).filter((n) => n.freed).map((n) => n.id));

  return (
    <div className="tree-view" role="img" aria-label="树可视化">
      <svg width={width} height={height} className="tree-svg">
        {nodes.map((n) => {
          const edges: Array<React.ReactElement> = [];
          for (const child of [n.left, n.right]) {
            if (child === null) continue;
            const c = byId.get(child);
            if (c === undefined) continue;
            edges.push(
              <line
                key={`${n.id}-${child}`}
                x1={px(n)}
                y1={py(n) + NODE_H / 2}
                x2={px(c)}
                y2={py(c) - NODE_H / 2}
                className={highlight.includes(n.id) && highlight.includes(child) ? 'tree-edge hl' : 'tree-edge'}
              />,
            );
          }
          return <g key={n.id}>{edges}</g>;
        })}
        {nodes.map((n) => {
          const hl = highlight.includes(n.id);
          const visited = visitOrder.includes(n.id);
          const idx = visitOrder.indexOf(n.id);
          return (
            <g key={n.id} transform={`translate(${px(n) - NODE_W / 2}, ${py(n) - NODE_H / 2})`}>
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={7}
                className={freed.has(n.id) ? 'tree-node freed' : hl ? 'tree-node hl' : visited ? 'tree-node visited' : 'tree-node'}
                data-id={n.id}
              />
              <text x={NODE_W / 2} y={NODE_H / 2 + 4} textAnchor="middle" className="tree-node-text">
                {n.value}
              </text>
              {idx >= 0 && (
                <text x={NODE_W - 2} y={10} textAnchor="end" className="tree-visit-no">
                  {idx + 1}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {(state.visitValues ?? []).length > 0 && (
        <div className="tree-visit-seq">
          输出：<strong>{(state.visitValues ?? []).join(' ')}</strong>
        </div>
      )}
      {state.frontier !== undefined && state.frontier.length > 0 && (
        <div className="tree-frontier">
          队列：{state.frontier.map((id) => state.nodes[id]?.value ?? '?').join(' → ')}
        </div>
      )}
    </div>
  );
}

export function HeapView({ state, highlight }: { state: HeapState; highlight: string[] }): React.ReactElement {
  // 堆的层序即数组序
  const positions: Positioned[] = state.order.map((id, i) => {
    const depth = Math.floor(Math.log2(i + 1));
    const levelStart = 2 ** depth - 1;
    const offsetInLevel = i - levelStart;
    const slots = 2 ** depth;
    return {
      id,
      value: state.nodes[id]?.value ?? 0,
      x: offsetInLevel,
      y: depth,
      left: null,
      right: null,
      levelSlots: slots,
      offsetInLevel,
    };
  });
  const depth = positions.length === 0 ? 0 : Math.max(...positions.map((p) => p.y)) + 1;
  const width = Math.max(2 ** (depth - 1 || 0) * GAP_X + 80, 320);
  const height = depth * GAP_Y + 30;
  const px = (p: Positioned): number => {
    const slots = p.levelSlots ?? 1;
    const offset = p.offsetInLevel ?? 0;
    return width / 2 + ((offset + 0.5) / slots - 0.5) * width * 0.9;
  };
  const py = (p: Positioned): number => 20 + p.y * GAP_Y;

  return (
    <div className="heap-view" role="img" aria-label="堆可视化">
      <div className="heap-mode-badge">{state.compare === 'max' ? '最大堆' : '最小堆'}</div>
      <svg width={width} height={height}>
        {positions.map((p, i) => {
          const l = 2 * i + 1;
          const r = 2 * i + 2;
          const edges: Array<React.ReactElement> = [];
          for (const ci of [l, r]) {
            if (ci < positions.length) {
              const c = positions[ci]!;
              edges.push(
                <line
                  key={`${p.id}-${c.id}`}
                  x1={px(p)}
                  y1={py(p) + NODE_H / 2}
                  x2={px(c)}
                  y2={py(c) - NODE_H / 2}
                  className={highlight.includes(p.id) && highlight.includes(c.id) ? 'tree-edge hl' : 'tree-edge'}
                />,
              );
            }
          }
          return <g key={p.id}>{edges}</g>;
        })}
        {positions.map((p, i) => (
          <g key={p.id} transform={`translate(${px(p) - NODE_W / 2}, ${py(p) - NODE_H / 2})`}>
            <rect
              width={NODE_W}
              height={NODE_H}
              rx={7}
              className={highlight.includes(p.id) ? 'tree-node hl' : 'tree-node'}
              data-id={p.id}
            />
            <text x={NODE_W / 2} y={NODE_H / 2 + 4} textAnchor="middle" className="tree-node-text">
              {p.value}
            </text>
            <text x={-6} y={10} className="tree-visit-no">
              {i}
            </text>
          </g>
        ))}
      </svg>
      <div className="heap-array-bar">
        {state.order.map((id, i) => (
          <span key={id} className={highlight.includes(id) ? 'heap-cell hl' : 'heap-cell'} data-id={id}>
            <em>{i}</em>
            {state.nodes[id]?.value}
          </span>
        ))}
      </div>
    </div>
  );
}

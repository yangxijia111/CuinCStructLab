/**
 * 图渲染器（VISUALIZATION_SPEC §5.7）：SVG 节点/边、visited/current/next 三态、frontier 面板。
 * 节点拖动由 LabPage 的图实验室支持（onMove 回调）。
 */
import type { GraphState } from '../../core/types';

export function GraphView({
  state,
  highlight,
  onMoveNode,
}: {
  state: GraphState;
  highlight: string[];
  onMoveNode?: (id: string, x: number, y: number) => void;
}): React.ReactElement {
  const nodes = Object.values(state.nodes);
  const minX = Math.min(...nodes.map((n) => n.x), 0);
  const minY = Math.min(...nodes.map((n) => n.y), 0);
  const maxX = Math.max(...nodes.map((n) => n.x), 400);
  const maxY = Math.max(...nodes.map((n) => n.y), 300);
  const width = maxX - minX + 80;
  const height = maxY - minY + 80;
  const normalize = (v: number, min: number): number => v - min + 40;
  const visited = new Set(state.visited);

  const handleDrag = (id: string, e: React.MouseEvent<SVGCircleElement>): void => {
    if (onMoveNode === undefined) return;
    const svg = (e.currentTarget.ownerSVGElement as SVGSVGElement | null) ?? null;
    if (svg === null) return;
    const move = (ev: MouseEvent): void => {
      const rect = svg.getBoundingClientRect();
      const scale = width / rect.width;
      const x = (ev.clientX - rect.left) * scale + minX - 40;
      const y = (ev.clientY - rect.top) * (height / rect.height) + minY - 40;
      onMoveNode(id, Math.round(x), Math.round(y));
    };
    const up = (): void => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className="graph-view" role="img" aria-label="图可视化">
      <svg width={Math.min(width, 760)} height={Math.min(height, 460)} viewBox={`0 0 ${width} ${height}`} className="graph-svg">
        {state.edges.map((e, i) => {
          const from = state.nodes[e.from];
          const to = state.nodes[e.to];
          if (from === undefined || to === undefined) return null;
          const x1 = normalize(from.x, minX);
          const y1 = normalize(from.y, minY);
          const x2 = normalize(to.x, minX);
          const y2 = normalize(to.y, minY);
          const active = highlight.includes(e.from) && highlight.includes(e.to);
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className={active ? 'graph-edge hl' : 'graph-edge'} />
              {state.directed && (
                <polygon
                  points={`${x2},${y2} ${x2 - 10 * Math.cos(Math.atan2(y2 - y1, x2 - x1) - 0.4)},${y2 - 10 * Math.sin(Math.atan2(y2 - y1, x2 - x1) - 0.4)} ${x2 - 10 * Math.cos(Math.atan2(y2 - y1, x2 - x1) + 0.4)},${y2 - 10 * Math.sin(Math.atan2(y2 - y1, x2 - x1) + 0.4)}`}
                  className={active ? 'graph-arrow hl' : 'graph-arrow'}
                />
              )}
            </g>
          );
        })}
        {nodes.map((n) => {
          const cx = normalize(n.x, minX);
          const cy = normalize(n.y, minY);
          const cls = n.id === state.current ? 'graph-node current' : n.id === state.next ? 'graph-node next' : visited.has(n.id) ? 'graph-node visited' : highlight.includes(n.id) ? 'graph-node hl' : 'graph-node';
          return (
            <g key={n.id}>
              <circle cx={cx} cy={cy} r={20} className={cls} data-id={n.id} onMouseDown={(e) => handleDrag(n.id, e)} />
              <text x={cx} y={cy + 4} textAnchor="middle" className="graph-node-text">
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="graph-legend">
        <span className="lg current">当前</span>
        <span className="lg next">考察中</span>
        <span className="lg visited">已访问</span>
        {state.frontierKind !== null && (
          <span className="graph-frontier">
            {state.frontierKind === 'stack' ? '栈（顶→底）' : '队列（头→尾）'}：
            <strong>{state.frontier.map((id) => state.nodes[id]?.label ?? '?').join(' ') || '空'}</strong>
          </span>
        )}
        {onMoveNode !== undefined && <span className="lg hint">可拖动节点</span>}
      </div>
    </div>
  );
}

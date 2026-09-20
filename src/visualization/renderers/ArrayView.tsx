/**
 * 数组 / 顺序表渲染器（VISUALIZATION_SPEC §5.1）。
 * [1][2][3] 格子样式：上方 index、格内 value；写操作突出 旧值→新值。
 */
import type { ArrayState } from '../../core/types';

const FLAG_CLASS: Record<string, string> = {
  comparing: 'flag-comparing',
  swapping: 'flag-swapping',
  sorted: 'flag-sorted',
  pivot: 'flag-pivot',
  writing: 'flag-writing',
  visited: 'flag-visited',
  inRange: 'flag-inrange',
  removed: 'flag-removed',
};

export function ArrayView({ state, highlight }: { state: ArrayState; highlight: string[] }): React.ReactElement {
  const showCapacity = state.capacity > state.size;
  return (
    <div className="array-view" role="img" aria-label={`数组 ${state.label}，共 ${state.cells.length} 格`}>
      <div className="array-cells">
        {state.cells.map((cell, i) => {
          const flagged = cell.flags.map((f) => FLAG_CLASS[f] ?? '').join(' ');
          const hl = highlight.includes(cell.id) ? ' hl' : '';
          const outOfUse = i >= state.size && state.capacity > state.size;
          return (
            <div key={cell.id} className="array-cell-wrap">
              <div className="array-index">{i}</div>
              <div
                className={`array-cell ${flagged}${hl}${outOfUse ? ' unused' : ''}`}
                data-id={cell.id}
                title={cell.value === null ? '空槽' : String(cell.value)}
              >
                {cell.value === null ? <span className="null-mark">∅</span> : cell.value}
              </div>
            </div>
          );
        })}
      </div>
      <div className="array-meta">
        <span className="array-label">{state.label}</span>
        <span>
          size = {state.size}
          {showCapacity ? ` / capacity = ${state.capacity}` : ''}
        </span>
        {state.range !== undefined && (
          <span className="array-range">
            当前区间 [{state.range[0]}, {state.range[1]}]
          </span>
        )}
      </div>
    </div>
  );
}

/** 柱状图渲染（排序用，P7 复用）：高度 = 值 */
export function BarsView({ state, highlight }: { state: ArrayState; highlight: string[] }): React.ReactElement {
  const max = Math.max(...state.cells.map((c) => Math.abs(c.value ?? 0)), 1);
  return (
    <div className="bars-view" role="img" aria-label="排序柱状图">
      {state.cells.map((cell) => {
        const flagged = cell.flags.map((f) => FLAG_CLASS[f] ?? '').join(' ');
        const hl = highlight.includes(cell.id) ? ' hl' : '';
        const h = Math.max(Math.abs(cell.value ?? 0) / max * 140, 6);
        return (
          <div key={cell.id} className="bar-wrap">
            <span className="bar-value">{cell.value}</span>
            <div className={`bar ${flagged}${hl}`} style={{ height: h }} data-id={cell.id} />
            <span className="bar-index">{cell.id.replace('a', '')}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 链表渲染器（单/双向，VISUALIZATION_SPEC §5.2）。
 * 节点 [data|next]（双向 [prev|data|next]），指针以"节点上方 chips"标注；floating 节点显示在下方。
 */
import type { ListState, PointerLabel } from '../../core/types';

export function ListView({ state, highlight }: { state: ListState; highlight: string[] }): React.ReactElement {
  const chain = state.nodes.filter((n) => !n.floating);
  const floating = state.nodes.filter((n) => n.floating);

  /** 收集指向某节点的指针标签 */
  const pointersTo = (id: string): PointerLabel[] => state.pointers.filter((p) => p.target === id);
  const nullPointers = state.pointers.filter((p) => p.target === null);

  return (
    <div className="list-view" role="img" aria-label="链表可视化">
      <div className="list-chain">
        {state.sentinel && <span className="list-head-label">head→</span>}
        {chain.map((node, i) => {
          const hl = highlight.includes(node.id) ? ' hl' : '';
          const freedCls = node.freed ? ' freed' : '';
          return (
            <span key={node.id} className="list-node-slot">
              <PointerChips pointers={pointersTo(node.id)} />
              <span className={`list-node${hl}${freedCls}`} data-id={node.id}>
                {state.doubly && <span className="ln-prev">prev</span>}
                <span className="ln-data">{node.value === null ? (state.sentinel ? 'head' : '?') : node.value}</span>
                <span className="ln-next">{i === chain.length - 1 && !state.sentinel ? '∅' : '•'}</span>
              </span>
              {i < chain.length - 1 && <span className="list-arrow">→</span>}
            </span>
          );
        })}
        {state.sentinel && chain.length <= 1 && <span className="list-null-end">∅（空链表）</span>}
        {!state.sentinel && chain.length === 0 && <span className="list-null-end">NULL（空表）</span>}
        {nullPointers.length > 0 && (
          <span className="list-null-end" style={{ marginLeft: 8 }}>
            <PointerChips pointers={nullPointers} />→ ∅
          </span>
        )}
      </div>

      {floating.length > 0 && (
        <div className="list-floating-row">
          <span className="floating-label">未接入链：</span>
          {floating.map((node) => {
            const hl = highlight.includes(node.id) ? ' hl' : '';
            return (
              <span key={node.id} className="list-node-slot">
                <PointerChips pointers={pointersTo(node.id)} />
                <span className={`list-node floating${hl}`} data-id={node.id}>
                  {state.doubly && <span className="ln-prev">prev</span>}
                  <span className="ln-data">{node.value}</span>
                  <span className="ln-next">•</span>
                </span>
              </span>
            );
          })}
        </div>
      )}

      {state.doubly && <div className="list-note">双向链表：相邻节点 prev/next 互相指向（⇄）</div>}
    </div>
  );
}

function PointerChips({ pointers }: { pointers: PointerLabel[] }): React.ReactElement | null {
  if (pointers.length === 0) return null;
  return (
    <span className="ptr-chips">
      {pointers.map((p, i) => (
        <span key={i} className={p.ghost ? 'ptr-chip ghost' : p.dying ? 'ptr-chip dying' : 'ptr-chip'}>
          {p.name}
          <em>↴</em>
        </span>
      ))}
    </span>
  );
}

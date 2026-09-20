/**
 * 栈 / 队列渲染器（VISUALIZATION_SPEC §5.3/§5.4）。
 */
import type { QueueState, StackState } from '../../core/types';

export function StackView({ state, highlight }: { state: StackState; highlight: string[] }): React.ReactElement {
  return (
    <div className="stack-view" role="img" aria-label="栈可视化">
      <div className="stack-meta">
        {state.capacity !== undefined && (
          <span>
            capacity = {state.capacity}，深度 = {state.frames.length}
          </span>
        )}
        {state.impl === 'linked' && <span>链栈：top 指向栈顶</span>}
        {state.overflow === true && <span className="stack-overflow">⚠ 溢出！</span>}
      </div>
      <div className={state.overflow === true ? 'stack-body overflow' : 'stack-body'}>
        {state.frames.length === 0 ? (
          <div className="stack-empty">（空栈）top = {state.impl === 'linked' ? 'NULL' : '0'}</div>
        ) : (
          [...state.frames].reverse().map((f, i) => (
            <div key={f.id} className={highlight.includes(f.id) || (i === 0 ? highlight.includes('top') : false) ? 'stack-frame top hl' : i === 0 ? 'stack-frame top' : 'stack-frame'} data-id={f.id}>
              <span className="sf-label">{f.label}</span>
              {i === 0 && <span className="sf-top-mark">← top</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function QueueView({ state, highlight }: { state: QueueState; highlight: string[] }): React.ReactElement {
  if (state.impl === 'linked') {
    const nodes = state.linkedNodes ?? [];
    return (
      <div className="queue-view linked" role="img" aria-label="链队列">
        <div className="queue-linked-row">
          <span className="queue-ptr">front→</span>
          {nodes.length === 0 ? (
            <span className="list-null-end">NULL（空队列） rear = NULL</span>
          ) : (
            nodes.map((n, i) => (
              <span key={n.id} className="list-node-slot">
                <span className={`list-node${highlight.includes(n.id) ? ' hl' : ''}`} data-id={n.id}>
                  <span className="ln-data">{n.value}</span>
                  <span className="ln-next">•</span>
                </span>
                {i < nodes.length - 1 && <span className="list-arrow">→</span>}
                {i === nodes.length - 1 && (
                  <span className="list-null-end">
                    ∅ <span className="queue-ptr">←rear</span>
                  </span>
                )}
              </span>
            ))
          )}
        </div>
      </div>
    );
  }

  // 顺序 / 循环队列：横排格子 + front/rear 游标
  return (
    <div className="queue-view circular" role="img" aria-label="循环队列">
      <div className="cqueue-meta">
        <span>
          front = {state.front}，rear = {state.rear}，capacity = {state.capacity}
        </span>
        <span className="cqueue-formula">(rear + 1) % {state.capacity} = {(state.rear + 1) % state.capacity}</span>
        {state.front === state.rear && <span className="cqueue-state empty">空</span>}
        {(state.rear + 1) % state.capacity === state.front && <span className="cqueue-state full">满（留一空位）</span>}
      </div>
      <div className="cqueue-cells">
        {state.slots.map((slot, i) => {
          const isFront = i === state.front;
          const isRear = i === state.rear;
          const hl = slot !== null && highlight.includes(slot.id);
          return (
            <div key={i} className="cqueue-cell-wrap">
              <div className="cqueue-cursor-row">
                <span className={isFront ? 'cq-cursor front' : ''}>{isFront ? 'front↓' : ''}</span>
              </div>
              <div className={`cqueue-cell${hl ? ' hl' : ''}${slot === null ? ' empty' : ''}`} data-id={slot?.id ?? `slot${i}`}>
                {slot === null ? '∅' : slot.value}
              </div>
              <div className="cqueue-cursor-row">
                <span className={isRear ? 'cq-cursor rear' : ''}>{isRear ? 'rear↑' : ''}</span>
              </div>
              <div className="cqueue-index">{i}</div>
            </div>
          );
        })}
      </div>
      <div className="cqueue-ring-hint">⟲ 环形：下标 {(state.capacity - 1 + 1) % state.capacity} 之后回到 0</div>
    </div>
  );
}

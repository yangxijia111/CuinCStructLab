/**
 * 状态渲染器分发：按 state.kind 选择渲染器（VISUALIZATION_SPEC §5）。
 */
import type { VisualState } from '../../core/types';
import { ArrayView, BarsView } from './ArrayView';
import { ListView } from './ListView';
import { QueueView, StackView } from './LinearViews';

export function StateRenderer({
  state,
  highlight,
  variant = 'auto',
}: {
  state: VisualState | null;
  highlight: string[];
  /** 排序用 bars */
  variant?: 'auto' | 'bars';
}): React.ReactElement {
  if (state === null) {
    return <div className="renderer-empty">尚无数据：请先初始化并执行操作</div>;
  }
  switch (state.kind) {
    case 'array':
      return variant === 'bars' ? <BarsView state={state} highlight={highlight} /> : <ArrayView state={state} highlight={highlight} />;
    case 'list':
      return <ListView state={state} highlight={highlight} />;
    case 'stack':
      return <StackView state={state} highlight={highlight} />;
    case 'queue':
      return <QueueView state={state} highlight={highlight} />;
    case 'tree':
    case 'heap':
    case 'graph':
      return <div className="renderer-empty">该结构的可视化将在后续版本提供（P6）</div>;
    default: {
      const never: never = state;
      void never;
      return <div className="renderer-empty">未知状态</div>;
    }
  }
}

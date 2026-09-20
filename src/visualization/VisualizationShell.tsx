/**
 * 可视化组合容器：左 C 代码 / 中数据结构画布 / 右变量·内存·调用栈 / 底部播放器（UI_UX_SPEC §3.1）。
 * 画布内容由 renderState 插槽提供（各数据结构渲染器）；三者与代码行严格同步（FR-VIZ-12）。
 */
import type { ReactNode } from 'react';
import type { Step } from '../core/types';
import { usePlayback } from './engine/usePlayback';
import { CodePanel, type CodeLineExplain } from './panels/CodePanel';
import { CallStackPanel, MemoryPanel, VariablesPanel } from './panels/StatePanels';
import { PlaybackBar } from './panels/PlaybackBar';

export interface VisualizationShellProps<S> {
  steps: Step<S>[];
  codeTitle: string;
  codeLines: CodeLineExplain[];
  /** 渲染当前状态（afterState/beforeState + 高亮 + 当前步骤） */
  renderState: (state: S | null, highlight: string[], step: Step<S> | null) => ReactNode;
  beginnerMode?: boolean;
  /** 画布上方附加信息（如遍历输出序列） */
  canvasHeader?: ReactNode;
  /** 完成后的附加提示 */
  outcomeNote?: ReactNode;
}

export function VisualizationShell<S>({
  steps,
  codeTitle,
  codeLines,
  renderState,
  beginnerMode = false,
  canvasHeader,
  outcomeNote,
}: VisualizationShellProps<S>): React.ReactElement {
  const ctrl = usePlayback<S>(steps);
  const step = ctrl.currentStep;
  const hasCallStack = steps.some((s) => s.callStack !== undefined && s.callStack.length > 0);
  const finished = ctrl.total > 0 && ctrl.index === ctrl.total - 1;
  const failed = step?.type === 'error';

  return (
    <div className="viz-shell">
      <div className="viz-main">
        <CodePanel title={codeTitle} lines={codeLines} activeLine={step?.codeLine ?? 0} beginnerMode={beginnerMode} />
        <div className="viz-canvas-wrap panel">
          <div className="viz-canvas-header">{canvasHeader}</div>
          <div className="viz-canvas">{renderState(ctrl.currentState, step?.highlight ?? [], step)}</div>
          {beginnerMode && step?.beginnerNote !== undefined && (
            <div className="viz-beginner-note">
              <span className="bn-tag">新手模式</span>
              {step.beginnerNote}
            </div>
          )}
          {finished && !failed && outcomeNote !== undefined && <div className="viz-outcome ok">{outcomeNote}</div>}
          {failed && (
            <div className="viz-outcome fail">
              <strong>操作失败：</strong>
              {step.description}
            </div>
          )}
        </div>
        <div className="viz-side">
          <VariablesPanel variables={step?.variables ?? []} />
          <MemoryPanel memory={step?.memory ?? { cells: [], simulated: true }} />
          {hasCallStack && <CallStackPanel frames={step?.callStack ?? []} />}
        </div>
      </div>
      <PlaybackBar ctrl={ctrl} />
    </div>
  );
}

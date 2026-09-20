/**
 * 可视化实验室（Playground）：选择数据结构 → 输入数据 → 执行操作 → 动画（FR-LAB）。
 * P5：线性结构；P6/P7 通过 ALL_LABS 追加树/图/排序。
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Step, VisualState } from '../core/types';
import { VisualizationShell } from '../visualization/VisualizationShell';
import { LINEAR_LABS, opCode } from '../visualization/labs';
import { ADVANCED_LABS } from '../visualization/labs-advanced';
import { SortingLab } from '../visualization/sorting-lab';
import type { LabDef, LabOpDef } from '../visualization/labs';
import { StateRenderer } from '../visualization/renderers/StateRenderer';
import { useAppStore } from '../ui/AppStore';

/** 全部实验室（P6/P7 追加后在此合并） */
function allLabs(): LabDef<VisualState>[] {
  return [...LINEAR_LABS, ...ADVANCED_LABS] as unknown as LabDef<VisualState>[];
}

export function LabPage(): React.ReactElement {
  const [params] = useSearchParams();
  const { beginnerMode } = useAppStore();
  const labs = useMemo(() => allLabs(), []);
  const chapter = params.get('chapter');
  const [labId, setLabId] = useState<string>(() => chapterToLabId(chapter));
  const lab = labs.find((l) => l.id === labId) ?? labs[0]!;
  const [initText, setInitText] = useState(lab.initPlaceholder);
  const [state, setState] = useState<VisualState | null>(() => lab.parseInit(lab.initPlaceholder));
  const [steps, setSteps] = useState<Step[]>([]);
  const [code, setCode] = useState<{ title: string; lines: Array<{ text: string; note?: string }> }>({ title: '', lines: [] });
  const [message, setMessage] = useState<string | null>(null);
  const [opParams, setOpParams] = useState<Record<string, Record<string, string>>>({});

  const switchLab = (id: string): void => {
    const next = labs.find((l) => l.id === id);
    if (next === undefined) return;
    setLabId(id);
    setInitText(next.initPlaceholder);
    setState(next.parseInit(next.initPlaceholder));
    setSteps([]);
    setCode({ title: '', lines: [] });
    setMessage(null);
    setOpParams({});
  };

  const doInit = (): void => {
    try {
      setState(lab.parseInit(initText));
      setSteps([]);
      setMessage(`已初始化：${initText.trim() === '' ? '（空）' : initText}`);
    } catch (err) {
      setMessage(`初始化失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const runOp = (op: LabOpDef<VisualState>): void => {
    const p = opParams[op.id] ?? {};
    try {
      const result = op.run(state, p);
      setSteps(result.steps);
      setState(result.state);
      setCode(opCode(op as LabOpDef<unknown>));
      setMessage(result.ok ? null : '操作失败（见动画最后一步）');
    } catch (err) {
      setMessage(`执行出错：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 排序实验室有专用 UI（Compare Mode / 查找模式）
  const isSorting = labId === 'sorting';
  if (isSorting) {
    return (
      <div className="lab-page">
        <aside className="lab-sidebar">
          <h2>排序与查找</h2>
          <p className="lab-hint">7 种排序 + 二分查找。Compare Mode 支持最多 3 个算法并排。</p>
        </aside>
        <div className="lab-main">
          <SortingLab />
        </div>
      </div>
    );
  }

  return (
    <div className="lab-page">
      <aside className="lab-sidebar">
        <h2>可视化实验室</h2>
        <p className="lab-hint">选择数据结构，输入初始数据，执行操作看动画。</p>
        <div className="lab-list" role="tablist" aria-label="数据结构选择">
          {labs.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={l.id === labId}
              className={l.id === labId ? 'lab-item active' : 'lab-item'}
              onClick={() => switchLab(l.id)}
            >
              {l.name}
            </button>
          ))}
        </div>
        <div className="lab-init">
          <label htmlFor="lab-init-input">初始数据（空格分隔）</label>
          <input
            id="lab-init-input"
            value={initText}
            onChange={(e) => setInitText(e.target.value)}
            placeholder={lab.initPlaceholder}
          />
          <button type="button" className="btn" onClick={doInit}>
            初始化
          </button>
        </div>
        <p className="lab-desc">{lab.desc}</p>
      </aside>

      <div className="lab-main">
        <div className="lab-ops" aria-label="可用操作">
          {lab.ops.map((op) => (
            <div key={op.id} className="lab-op">
              <button type="button" className="btn" onClick={() => runOp(op)}>
                {op.name}
              </button>
              {op.params.map((pd) => (
                <label key={pd.key} className="lab-param">
                  <span>{pd.label}</span>
                  <input
                    type={pd.kind === 'number' ? 'number' : 'text'}
                    value={opParams[op.id]?.[pd.key] ?? pd.default ?? ''}
                    placeholder={pd.placeholder}
                    onChange={(e) =>
                      setOpParams((prev) => ({ ...prev, [op.id]: { ...prev[op.id], [pd.key]: e.target.value } }))
                    }
                  />
                </label>
              ))}
            </div>
          ))}
        </div>

        {message !== null && <div className="lab-message" role="status">{message}</div>}

        {steps.length > 0 ? (
          <VisualizationShell
            steps={steps}
            codeTitle={code.title || lab.name}
            codeLines={code.lines}
            beginnerMode={beginnerMode}
            renderState={(s, highlight) => <StateRenderer state={s} highlight={highlight} />}
          />
        ) : (
          <div className="panel lab-canvas-preview">
            <StateRenderer state={state} highlight={[]} />
            <p className="empty-hint">选择上方操作开始动画。播放器支持 播放/暂停/单步/变速/跳转。</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** 课程章节号 → 默认实验室 */
function chapterToLabId(chapter: string | null): string {
  switch (chapter) {
    case '0':
      return 'memory';
    case '2':
      return 'seqlist';
    case '3':
      return 'list';
    case '4':
      return 'doubly';
    case '5':
      return 'stack';
    case '6':
      return 'queue';
    case '7':
      return 'array';
    case '8':
      return 'tree';
    case '9':
      return 'bst';
    case '10':
      return 'heap';
    case '11':
      return 'graph';
    case '12':
    case '13':
      return 'sorting';
    default:
      return 'list';
  }
}


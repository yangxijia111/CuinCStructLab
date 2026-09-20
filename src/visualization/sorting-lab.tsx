/**
 * 排序实验室：单算法动画（VisualizationShell）+ Compare Mode（≤3 算法并排，共享步进）（FR-VIZ-10/11）。
 * 查找模式（顺序/二分）也在此文件。
 */
import { useEffect, useMemo, useState } from 'react';
import { SORT_C_CODES, SORT_METAS, type SortId } from '../core/algorithms/sorting-codes';
import { compareSorts, sortWithSteps } from '../core/algorithms/sorting';
import { binarySearchSteps } from '../core/algorithms/search';
import type { ArrayState, Step } from '../core/types';
import { C_PROGRAMS } from '../content';
import { BASE_INTERVAL_MS, SPEEDS, type PlaybackController, type Speed } from './engine/usePlayback';
import { BarsView } from './renderers/ArrayView';
import { PlaybackBar } from './panels/PlaybackBar';
import { VisualizationShell } from './VisualizationShell';
import { useAppStore } from '../ui/AppStore';
import { clamp } from '../core/utils/misc';

const ALL_SORTS: SortId[] = ['bubble', 'selection', 'insertion', 'shell', 'merge', 'quick', 'heap'];

export function SortingLab(): React.ReactElement {
  const { beginnerMode } = useAppStore();
  const [dataText, setDataText] = useState('5 2 9 1 7 3 8 6');
  const [algo, setAlgo] = useState<SortId>('bubble');
  const [compareMode, setCompareMode] = useState(false);
  const [picked, setPicked] = useState<SortId[]>(['bubble', 'quick', 'merge']);
  const [searchMode, setSearchMode] = useState(false);
  const [target, setTarget] = useState('7');

  const numbers = useMemo(
    () =>
      dataText
        .split(/[\s,]+/)
        .filter((t) => t.length > 0)
        .map(Number)
        .filter((n) => Number.isFinite(n))
        .slice(0, 40),
    [dataText],
  );

  const singleResult = useMemo(() => sortWithSteps(algo, numbers), [algo, numbers]);

  const code = useMemo(() => {
    if (searchMode) {
      const p = C_PROGRAMS['search']!;
      return { title: p.title, lines: p.lines.map((t, i) => ({ text: t, note: p.notes?.[i + 1] })) };
    }
    const lines = SORT_C_CODES[algo];
    return { title: SORT_METAS[algo].name, lines: lines.map((t) => ({ text: t })) };
  }, [algo, searchMode]);

  const searchSteps = useMemo<Array<Step<ArrayState>>>(
    () =>
      searchMode && numbers.length > 0
        ? binarySearchSteps([...numbers].sort((a, b) => a - b), Number(target) || 0).steps
        : [],
    [searchMode, numbers, target],
  );

  return (
    <div className="sorting-lab">
      <div className="sort-controls">
        <label className="sort-data">
          <span>数据（空格分隔，≤40 个）</span>
          <input value={dataText} onChange={(e) => setDataText(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn"
          onClick={() => setDataText(Array.from({ length: 12 }, () => Math.floor(Math.random() * 90) + 10).join(' '))}
        >
          随机数据
        </button>
        <label className="sort-toggle">
          <input type="checkbox" checked={searchMode} onChange={(e) => setSearchMode(e.target.checked)} />
          查找模式（有序后二分）
        </label>
        {!searchMode && (
          <label className="sort-toggle">
            <input type="checkbox" checked={compareMode} onChange={(e) => setCompareMode(e.target.checked)} />
            Compare Mode
          </label>
        )}
        {!searchMode && !compareMode && (
          <select value={algo} onChange={(e) => setAlgo(e.target.value as SortId)} aria-label="选择排序算法" className="sort-select">
            {ALL_SORTS.map((id) => (
              <option key={id} value={id}>
                {SORT_METAS[id].name}（{SORT_METAS[id].timeAvg}）
              </option>
            ))}
          </select>
        )}
        {searchMode && (
          <label className="sort-data">
            <span>目标</span>
            <input style={{ width: 70 }} value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
        )}
      </div>

      {compareMode && !searchMode ? (
        <ComparePanel numbers={numbers.length > 0 ? numbers : [5, 2, 9, 1]} picked={picked} setPicked={setPicked} />
      ) : (
        <VisualizationShell
          steps={searchMode ? searchSteps : singleResult.steps}
          codeTitle={code.title}
          codeLines={code.lines}
          beginnerMode={beginnerMode}
          renderState={(s, highlight) => <BarsView state={s as ArrayState} highlight={highlight} />}
          outcomeNote={
            searchMode
              ? undefined
              : `${SORT_METAS[algo].name}完成：比较 ${singleResult.meta.comparisons} 次，交换/移动 ${singleResult.meta.swaps} 次（${SORT_METAS[algo].stable ? '稳定' : '不稳定'}）`
          }
        />
      )}
    </div>
  );
}

function ComparePanel({
  numbers,
  picked,
  setPicked,
}: {
  numbers: number[];
  picked: SortId[];
  setPicked(ids: SortId[]): void;
}): React.ReactElement {
  const results = useMemo(() => compareSorts(picked, numbers), [picked, numbers]);
  const maxLen = results.reduce((m, r) => Math.max(m, r.result.steps.length), 0);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);

  const shownIndex = Math.min(index, maxLen - 1);

  useEffect(() => {
    if (!playing) return;
    if (shownIndex >= maxLen - 1) return;
    const timer = setTimeout(() => {
      setIndex((cur) => {
        const nextIdx = Math.min(cur + 1, maxLen - 1);
        if (nextIdx >= maxLen - 1) setPlaying(false);
        return nextIdx;
      });
    }, BASE_INTERVAL_MS / speed);
    return () => clearTimeout(timer);
  }, [playing, shownIndex, maxLen, speed]);

  const ctrl: PlaybackController<never> = {
    index: shownIndex,
    playing,
    speed,
    total: maxLen,
    currentStep: null,
    currentState: null,
    play: () => {
      if (shownIndex >= maxLen - 1) setIndex(-1);
      setPlaying(true);
    },
    pause: () => setPlaying(false),
    toggle: () => {
      if (playing) setPlaying(false);
      else {
        if (shownIndex >= maxLen - 1) setIndex(-1);
        setPlaying(true);
      }
    },
    next: () => {
      if (shownIndex < maxLen - 1) {
        setIndex(shownIndex + 1);
        return true;
      }
      return false;
    },
    prev: () => {
      if (shownIndex >= 0) {
        setIndex(shownIndex - 1);
        return true;
      }
      return false;
    },
    restart: () => {
      setPlaying(false);
      setIndex(-1);
    },
    jumpTo: (t: number) => {
      setPlaying(false);
      setIndex(clamp(Math.round(t), -1, maxLen - 1));
    },
    setSpeed: (s: Speed) => setSpeed(s),
    setSteps: () => undefined,
  };

  const toggle = (id: SortId): void => {
    if (picked.includes(id)) setPicked(picked.filter((p) => p !== id));
    else if (picked.length < 3) setPicked([...picked, id]);
  };

  return (
    <div className="compare-panel">
      <div className="compare-pick" role="group" aria-label="选择要比较的算法（最多 3 个）">
        {ALL_SORTS.map((id) => (
          <label key={id} className={picked.includes(id) ? 'cmp-chip on' : 'cmp-chip'}>
            <input
              type="checkbox"
              checked={picked.includes(id)}
              onChange={() => toggle(id)}
              disabled={!picked.includes(id) && picked.length >= 3}
            />
            {SORT_METAS[id].name}
          </label>
        ))}
        <span className="cmp-note">速度 {SPEEDS.length} 档可调；各算法到达终点后停留显示最终计数。</span>
      </div>
      {results.length === 0 ? (
        <p className="empty-hint">至少选择一个算法</p>
      ) : (
        <>
          <div className="compare-tracks">
            {results.map(({ id, result }) => {
              const clamped = Math.min(shownIndex, result.steps.length - 1);
              const step = result.steps[clamped];
              const state = shownIndex < 0 ? (result.steps[0]?.beforeState ?? null) : (step?.afterState ?? null);
              const finished = shownIndex >= result.steps.length - 1;
              return (
                <div key={id} className="cmp-track">
                  <div className="cmp-head">
                    <strong>{SORT_METAS[id].name}</strong>
                    <span className="cmp-meta">
                      {step !== undefined && `比较 ${step.metrics?.comparisons ?? 0} · 交换/移动 ${step.metrics?.swaps ?? 0}`}
                      {finished ? ' ✓' : `（步 ${clamped + 1}/${result.steps.length}）`}
                    </span>
                  </div>
                  <BarsView state={state} highlight={step?.highlight ?? []} />
                </div>
              );
            })}
          </div>
          <PlaybackBar ctrl={ctrl} />
        </>
      )}
    </div>
  );
}

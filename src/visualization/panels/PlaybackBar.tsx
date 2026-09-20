/**
 * 播放控制条：Play/Pause/Next/Prev/Restart/进度条/Jump/速度（VISUALIZATION_SPEC §4）。
 * 键盘快捷键：Space 播放暂停、←/→ 单步、R 重置、↑/↓ 变速。
 */
import { useEffect } from 'react';
import { SPEEDS, type PlaybackController, type Speed } from '../engine/usePlayback';

const SPEED_LABEL: Record<Speed, string> = {
  0.25: '0.25x',
  0.5: '0.5x',
  1: '1x',
  2: '2x',
  4: '4x',
};

export function PlaybackBar<S>({ ctrl }: { ctrl: PlaybackController<S> }): React.ReactElement {
  // 键盘快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      // 输入框内不拦截
      if (target !== null && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        ctrl.toggle();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        ctrl.next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        ctrl.prev();
      } else if (e.key === 'r' || e.key === 'R') {
        ctrl.restart();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = SPEEDS.indexOf(ctrl.speed);
        ctrl.setSpeed(SPEEDS[Math.min(idx + 1, SPEEDS.length - 1)]!);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const idx = SPEEDS.indexOf(ctrl.speed);
        ctrl.setSpeed(SPEEDS[Math.max(idx - 1, 0)]!);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [ctrl]);

  const step = ctrl.currentStep;
  const progressValue = ctrl.total === 0 ? 0 : ctrl.index + 1;
  const errorStep = step?.type === 'error';

  return (
    <footer className="playback-bar" aria-label="动画播放控制">
      <div className="pb-controls">
        <button type="button" className="pb-btn" onClick={() => ctrl.restart()} title="重新开始 (R)" aria-label="重新开始">
          ⏮
        </button>
        <button
          type="button"
          className="pb-btn"
          onClick={() => ctrl.prev()}
          disabled={ctrl.index < 0}
          title="上一步 (←)"
          aria-label="上一步"
        >
          ◀
        </button>
        <button
          type="button"
          className="pb-btn pb-primary"
          onClick={() => ctrl.toggle()}
          title="播放/暂停 (Space)"
          aria-label={ctrl.playing ? '暂停' : '播放'}
        >
          {ctrl.playing ? '⏸' : '▶'}
        </button>
        <button
          type="button"
          className="pb-btn"
          onClick={() => ctrl.next()}
          disabled={ctrl.total > 0 && ctrl.index >= ctrl.total - 1}
          title="下一步 (→)"
          aria-label="下一步"
        >
          ▶
        </button>
      </div>

      <div className="pb-progress">
        <span className="pb-count">
          {ctrl.index + 1} / {ctrl.total}
        </span>
        <input
          type="range"
          min={0}
          max={ctrl.total}
          value={progressValue}
          onChange={(e) => ctrl.jumpTo(Number(e.target.value) - 1)}
          aria-label="跳转到指定步"
          disabled={ctrl.total === 0}
        />
      </div>

      <div className="pb-speed" role="group" aria-label="播放速度">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={s === ctrl.speed ? 'pb-speed-btn active' : 'pb-speed-btn'}
            onClick={() => ctrl.setSpeed(s)}
          >
            {SPEED_LABEL[s]}
          </button>
        ))}
      </div>

      <div className={errorStep ? 'pb-desc error' : 'pb-desc'}>
        {step === null ? (
          <span>点击 ▶ 或用 → 键开始单步执行</span>
        ) : (
          <span>
            <strong>{step.title}</strong>
            <span className="pb-desc-text">{step.description}</span>
          </span>
        )}
      </div>
    </footer>
  );
}

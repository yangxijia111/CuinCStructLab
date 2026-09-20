/**
 * C 代码面板：行号 + 当前行高亮 + 行级解释（悬浮 Beginner 说明）（VISUALIZATION_SPEC §5.9）。
 */
import { useMemo } from 'react';

export interface CodeLineExplain {
  text: string;
  note?: string;
  beginner?: string;
}

export interface CodePanelProps {
  title: string;
  lines: CodeLineExplain[];
  /** 当前执行行（1-based）；0/null 表示不高亮 */
  activeLine?: number | null;
  /** 新手模式：展示更详细解释 */
  beginnerMode?: boolean;
}

export function CodePanel({ title, lines, activeLine, beginnerMode = false }: CodePanelProps): React.ReactElement {
  const tipFor = useMemo(
    () => (line: CodeLineExplain): string | undefined => {
      if (beginnerMode) return line.beginner ?? line.note;
      return line.note ?? line.beginner;
    },
    [beginnerMode],
  );

  return (
    <section className="code-panel panel" aria-label={`C 代码：${title}`}>
      <header className="panel-header">
        <h3>{title}</h3>
        <span className="panel-sub">C 代码</span>
      </header>
      <div className="code-scroll">
        <table className="code-table">
          <tbody>
            {lines.map((line, i) => {
              const num = i + 1;
              const active = activeLine === num;
              const tip = tipFor(line);
              return (
                <tr key={num} className={active ? 'code-line active' : 'code-line'} data-line={num} title={tip}>
                  <td className="code-num" aria-hidden="true">
                    {num}
                  </td>
                  <td className="code-text">
                    <span className="code-src">{line.text === '' ? '\u00A0' : line.text}</span>
                    {tip !== undefined && <span className="code-tip-hint" aria-label="本行有解释">?</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {beginnerMode && (
        <footer className="code-beginner-bar">
          {activeLine !== null && activeLine !== undefined && activeLine !== 0 && lines[activeLine - 1] !== undefined
            ? (lines[activeLine - 1]?.beginner ?? lines[activeLine - 1]?.note ?? '（本行无附加解释）')
            : '播放动画时，这里显示当前行的详细解释'}
        </footer>
      )}
    </section>
  );
}

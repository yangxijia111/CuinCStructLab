/**
 * 题库页：章节/题型/难度筛选 + 答题（8 题型）+ 判分与解析（FR-EXE-01..05）。
 * 答题记录经 AppStore 记录（P9 起落库到 SQLite）。
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CHAPTERS } from '../content';
import { ALL_EXERCISES, exercisesByChapter } from '../exercises/bank';
import { EXERCISE_TYPE_LABELS, judge } from '../exercises/types';
import type { Exercise, UserAnswer } from '../exercises/types';
import { useAppStore } from '../ui/AppStore';

export function BankPage(): React.ReactElement {
  const [params] = useSearchParams();
  const chapterParam = params.get('chapter');
  const [chapter, setChapter] = useState<number | 'all'>(chapterParam !== null ? Number(chapterParam) : 'all');
  const [type, setType] = useState<string>('all');
  const [currentId, setCurrentId] = useState<string | null>(null);

  const list = useMemo(() => {
    let l = chapter === 'all' ? ALL_EXERCISES : exercisesByChapter(chapter);
    if (type !== 'all') l = l.filter((e) => e.type === type);
    return l;
  }, [chapter, type]);

  const current = currentId === null ? null : (ALL_EXERCISES.find((e) => e.id === currentId) ?? null);

  return (
    <div className="bank-page">
      <aside className="bank-side">
        <h2>题库</h2>
        <div className="bank-filters">
          <select
            value={String(chapter)}
            onChange={(e) => setChapter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            aria-label="按章节筛选"
          >
            <option value="all">全部章节</option>
            {CHAPTERS.map((c) => (
              <option key={c.id} value={c.id}>
                第 {c.id} 章 {c.title}
              </option>
            ))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="按题型筛选">
            <option value="all">全部题型</option>
            {Object.entries(EXERCISE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <span className="bank-count">
            共 {list.length} 题 · 全库 {ALL_EXERCISES.length} 题
          </span>
        </div>
        <ol className="bank-list">
          {list.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className={currentId === e.id ? 'bank-item active' : 'bank-item'}
                onClick={() => setCurrentId(e.id)}
              >
                <span className="bank-item-ch">Ch{e.chapter}</span>
                <span className="bank-item-type">{EXERCISE_TYPE_LABELS[e.type]}</span>
                <span className="bank-item-q">{e.knowledgePoint} · {'★'.repeat(e.difficulty)}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>
      <main className="bank-main">
        {current === null ? (
          <div className="panel bank-empty">
            <p>从左侧选择一道题开始练习。</p>
            <p className="empty-hint">答题后自动判分，答错会记入错题本。</p>
          </div>
        ) : (
          <ExerciseView key={current.id} exercise={current} onDone={() => undefined} />
        )}
      </main>
    </div>
  );
}

function ExerciseView({ exercise }: { exercise: Exercise; onDone?: () => void }): React.ReactElement {
  const { recordAttempt } = useAppStore();
  const [user, setUser] = useState<UserAnswer>(null);
  const [result, setResult] = useState<{ correct: boolean; standardText: string } | null>(null);
  const [blanks, setBlanks] = useState<string[]>([]);

  const submit = (): void => {
    const finalUser: UserAnswer =
      exercise.answer.type === 'blanks' ? blanks : user;
    const r = judge(exercise, finalUser);
    setResult(r);
    recordAttempt(exercise, r.correct);
  };

  const redo = (): void => {
    setUser(null);
    setResult(null);
    setBlanks([]);
  };

  const codeBlocks = splitCode(exercise.question);

  return (
    <section className="panel exercise-view">
      <header className="ex-head">
        <span className="ex-meta">
          第 {exercise.chapter} 章 · {exercise.knowledgePoint} · {EXERCISE_TYPE_LABELS[exercise.type]} · {'★'.repeat(exercise.difficulty)}
        </span>
        <h3>{codeBlocks.intro}</h3>
      </header>

      {codeBlocks.code !== null && (
        <pre className="section-code-block">
          <code>{codeBlocks.code}</code>
        </pre>
      )}

      {exercise.options !== undefined && exercise.answer.type !== 'judge' && (
        <div className="ex-options" role={exercise.type === 'multiple' ? 'group' : 'radiogroup'}>
          {exercise.options.map((opt) => {
            const selected = exercise.type === 'multiple' ? Array.isArray(user) && user.includes(opt.id) : user === opt.id;
            return (
              <label key={opt.id} className={selected ? 'ex-option selected' : 'ex-option'}>
                <input
                  type={exercise.type === 'multiple' ? 'checkbox' : 'radio'}
                  name={exercise.id}
                  checked={selected}
                  disabled={result !== null}
                  onChange={() => {
                    if (exercise.type === 'multiple') {
                      const cur = Array.isArray(user) ? user : [];
                      setUser(cur.includes(opt.id) ? cur.filter((x) => x !== opt.id) : [...cur, opt.id]);
                    } else {
                      setUser(opt.id);
                    }
                  }}
                />
                <strong>{opt.id}.</strong>
                {opt.text}
              </label>
            );
          })}
        </div>
      )}

      {exercise.answer.type === 'judge' && (
        <div className="ex-options" role="radiogroup">
          <label className={user === true ? 'ex-option selected' : 'ex-option'}>
            <input type="radio" name={exercise.id} checked={user === true} disabled={result !== null} onChange={() => setUser(true)} />
            正确（√）
          </label>
          <label className={user === false ? 'ex-option selected' : 'ex-option'}>
            <input type="radio" name={exercise.id} checked={user === false} disabled={result !== null} onChange={() => setUser(false)} />
            错误（×）
          </label>
        </div>
      )}

      {exercise.answer.type === 'text' && (
        <input
          className="ex-input"
          value={typeof user === 'string' ? user : ''}
          disabled={result !== null}
          onChange={(e) => setUser(e.target.value)}
          placeholder="输入答案（忽略首尾空白）"
        />
      )}

      {exercise.answer.type === 'blanks' && (
        <div className="ex-blanks">
          {exercise.answer.value.map((_, i) => (
            <label key={i} className="ex-blank">
              <span>第 {i + 1} 空</span>
              <input
                value={blanks[i] ?? ''}
                disabled={result !== null}
                onChange={(e) => {
                  const next = [...blanks];
                  next[i] = e.target.value;
                  setBlanks(next);
                }}
              />
            </label>
          ))}
        </div>
      )}

      <footer className="ex-actions">
        {result === null ? (
          <button type="button" className="btn primary" onClick={submit} disabled={user === null && blanks.every((b) => b === undefined)}>
            提交
          </button>
        ) : (
          <>
            <span className={result.correct ? 'ex-result ok' : 'ex-result bad'}>
              {result.correct ? '✓ 回答正确' : '✗ 回答错误'}
            </span>
            <button type="button" className="btn" onClick={redo}>
              重做本题
            </button>
          </>
        )}
      </footer>

      {result !== null && (
        <div className={result.correct ? 'ex-explain ok' : 'ex-explain bad'}>
          <p>
            <strong>标准答案：</strong>
            {result.standardText}
          </p>
          <p>
            <strong>解析：</strong>
            {exercise.explanation}
          </p>
          <p className="ex-tags">标签：{exercise.tags.join('、')}</p>
        </div>
      )}
    </section>
  );
}

/** 拆分题干：``` 包裹的代码块 */
function splitCode(question: string): { intro: string; code: string | null } {
  const m = question.match(/```(?:c)?\n?([\s\S]*?)```/);
  if (m === null) return { intro: question, code: null };
  return { intro: question.slice(0, question.indexOf('```')).trim(), code: m[1] ?? '' };
}

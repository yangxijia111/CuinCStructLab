/**
 * 错题本（FR-WRONG）：错误分类、次数、最近错误时间、重练、标记掌握。
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ALL_EXERCISES, getExercise } from '../exercises/bank';
import { ERROR_CATEGORY_LABELS } from '../exercises/types';
import type { ErrorCategory } from '../exercises/types';
import { useAppStore } from '../ui/AppStore';

export function WrongBookPage(): React.ReactElement {
  const { wrongBook, markWrongMastered } = useAppStore();
  const [filter, setFilter] = useState<'all' | ErrorCategory | 'unmastered'>('all');

  const items = useMemo(() => {
    const list = Object.values(wrongBook).sort((a, b) => b.lastWrongAt - a.lastWrongAt);
    if (filter === 'all') return list;
    if (filter === 'unmastered') return list.filter((w) => !w.mastered);
    return list.filter((w) => w.errorCategory === filter);
  }, [wrongBook, filter]);

  const totalWrong = Object.keys(wrongBook).length;
  const unmastered = Object.values(wrongBook).filter((w) => !w.mastered).length;
  const mastered = totalWrong - unmastered;

  return (
    <div className="page">
      <h1>错题本</h1>
      <p className="page-lead">
        共 {totalWrong} 道错题 · 待巩固 {unmastered} · 已掌握 {mastered}。重练答对不自动移除，确认掌握后请点击"标记掌握"。
      </p>
      <div className="wb-filters">
        <button type="button" className={filter === 'all' ? 'wb-filter on' : 'wb-filter'} onClick={() => setFilter('all')}>
          全部
        </button>
        <button type="button" className={filter === 'unmastered' ? 'wb-filter on' : 'wb-filter'} onClick={() => setFilter('unmastered')}>
          待巩固
        </button>
        {(Object.keys(ERROR_CATEGORY_LABELS) as ErrorCategory[]).map((c) => (
          <button key={c} type="button" className={filter === c ? 'wb-filter on' : 'wb-filter'} onClick={() => setFilter(c)}>
            {ERROR_CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="panel wb-empty">
          {totalWrong === 0 ? (
            <>
              <p>还没有错题。</p>
              <p className="empty-hint">
                去 <Link to="/bank">题库</Link> 做题，答错的题目会自动收进来。
              </p>
            </>
          ) : (
            <p>该筛选下没有错题。</p>
          )}
        </div>
      ) : (
        <div className="wb-list">
          {items.map((w) => {
            const ex = getExercise(w.exerciseId);
            return (
              <div key={w.exerciseId} className={w.mastered ? 'wb-card mastered' : 'wb-card'}>
                <div className="wb-main">
                  <div className="wb-head">
                    <span className="wb-chapter">第 {w.chapter} 章</span>
                    <strong>{w.knowledgePoint}</strong>
                    <span className="wb-cat">{ERROR_CATEGORY_LABELS[w.errorCategory as ErrorCategory] ?? w.errorCategory}</span>
                    {w.mastered && <span className="wb-mastered">✓ 已掌握</span>}
                  </div>
                  {ex !== undefined && <p className="wb-q">{ex.question.replace(/```[\s\S]*?```/g, '（代码题）').slice(0, 100)}…</p>}
                  <div className="wb-meta">
                    <span>错误 {w.wrongCount} 次</span>
                    <span>最近错误：{new Date(w.lastWrongAt).toLocaleString('zh-CN')}</span>
                  </div>
                </div>
                <div className="wb-actions">
                  <Link className="btn" to={`/bank?chapter=${w.chapter}`}>
                    重新练习
                  </Link>
                  {!w.mastered && (
                    <button type="button" className="btn primary" onClick={() => markWrongMastered(w.exerciseId)}>
                      标记掌握
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 错题统计（StatsPage 复用） */
export function wrongStats(wrongBook: Record<string, { errorCategory: string; mastered: boolean }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of Object.values(wrongBook)) {
    out[w.errorCategory] = (out[w.errorCategory] ?? 0) + 1;
  }
  return out;
}

export { ALL_EXERCISES };

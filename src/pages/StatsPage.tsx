/**
 * 学习统计（FR-STAT-01/02）：完成度、正确率、连续天数、掌握分布、近 30 天趋势。
 * 掌握度 = 规则模型（DATA_SPEC §5），无 AI。
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CHAPTERS } from '../content';
import { MASTERY_LABELS, computeMastery, streakDays, todayKey } from '../storage/mastery-rules';
import type { MasteryLevel } from '../storage/mastery-rules';
import { getDb } from '../storage/db';
import { loadStudyDays } from '../storage/repos';
import { useAppStore } from '../ui/AppStore';
import { useEffect, useState } from 'react';

export function StatsPage(): React.ReactElement {
  const { progress, attempts, wrongBook, storageReady } = useAppStore();
  const [studyDays, setStudyDays] = useState<string[]>([]);

  useEffect(() => {
    void getDb()
      .then((db) => setStudyDays(loadStudyDays(db).map((d) => d.day)))
      .catch(() => setStudyDays([]));
  }, [storageReady]);

  const stats = useMemo(() => {
    const done = Object.values(progress).filter((p) => p.status === 'done').length;
    const learning = Object.values(progress).filter((p) => p.status === 'learning').length;
    const total = attempts.length;
    const correct = attempts.filter((a) => a.correct).length;
    const wrong = Object.keys(wrongBook).length;
    const streak = streakDays(studyDays);
    // 知识点掌握（按 knowledgePoint 聚合答题）
    const byKp = new Map<string, { attempts: number; correct: number; mastered: boolean }>();
    for (const a of attempts) {
      const cur = byKp.get(a.knowledgePoint) ?? { attempts: 0, correct: 0, mastered: false };
      cur.attempts += 1;
      if (a.correct) cur.correct += 1;
      byKp.set(a.knowledgePoint, cur);
    }
    // 章节有学习行为 → 对应知识点至少处于 learning（无答题数据时）
    const studiedChapterIds = new Set<number>();
    for (const [ch, p] of Object.entries(progress)) {
      if (p.status !== 'new') studiedChapterIds.add(Number(ch));
    }
    const mastery: Record<string, number> = { unlearned: 0, learning: 0, weak: 0, basic: 0, mastered: 0 };
    for (const [kp, d] of byKp) {
      const wrongItem = Object.values(wrongBook).find((w) => w.knowledgePoint === kp && w.mastered);
      const chapterId = CHAPTERS.find((c) => c.title === kp)?.id ?? -1;
      const level = computeMastery({
        attempts: d.attempts,
        correct: d.correct,
        hasStudyActivity: d.attempts > 0 || studiedChapterIds.has(chapterId),
        manuallyMastered: wrongItem !== undefined,
      });
      mastery[level] += 1;
    }
    // 近 30 天答题趋势
    const days30: Array<{ day: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = todayKey(d);
      days30.push({ day: key, count: attempts.filter((a) => todayKey(new Date(a.createdAt)) === key).length });
    }
    return { done, learning, total, correct, wrong, streak, mastery, days30 };
  }, [progress, attempts, wrongBook, studyDays]);

  const accuracy = stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
  const maxCount = Math.max(...stats.days30.map((d) => d.count), 1);

  return (
    <div className="page">
      <h1>学习统计</h1>
      <p className="page-lead">所有数据保存在本地，仅用于自我追踪。</p>

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-num">{Math.round((stats.done / CHAPTERS.length) * 100)}%</span>
          <span className="stat-label">课程完成度（{stats.done}/{CHAPTERS.length} 章）</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{accuracy}%</span>
          <span className="stat-label">题目正确率（{stats.correct}/{stats.total}）</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{stats.streak}</span>
          <span className="stat-label">连续学习天数</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{stats.wrong}</span>
          <span className="stat-label">错题数（{Object.values(wrongBook).filter((w) => !w.mastered).length} 待巩固）</span>
        </div>
      </div>

      <div className="stat-grid2">
        <section className="panel stat-section">
          <h3>章节进度</h3>
          <ol className="chapter-progress-list">
            {CHAPTERS.map((c) => {
              const p = progress[c.id];
              const pct = p === undefined ? 0 : p.status === 'done' ? 100 : Math.round(((p.maxSectionIndex + 1) / 14) * 100);
              return (
                <li key={c.id}>
                  <Link to={`/course/${c.id}`} className="cp-row">
                    <span className="cp-name">
                      {c.id}. {c.title}
                    </span>
                    <span className={p?.status === 'done' ? 'cp-bar done' : 'cp-bar'}>
                      <span style={{ width: `${pct}%` }} />
                    </span>
                    <span className="cp-pct">{pct}%</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="panel stat-section">
          <h3>知识点掌握分布</h3>
          <div className="mastery-dist">
            {(Object.keys(stats.mastery) as MasteryLevel[]).map((level) => (
              <div key={level} className="md-row">
                <span className="md-label">{MASTERY_LABELS[level]}</span>
                <span className="md-bar">
                  <span
                    className={level === 'mastered' ? 'fill ok' : level === 'weak' ? 'fill bad' : 'fill'}
                    style={{ width: `${(stats.mastery[level] ?? 0) * (100 / Math.max(Object.values(stats.mastery).reduce((a, b) => a + b, 0), 1))}%` }}
                  />
                </span>
                <span className="md-num">{stats.mastery[level] ?? 0}</span>
              </div>
            ))}
          </div>
          <h3 style={{ marginTop: 18 }}>近 30 天答题趋势</h3>
          <div className="trend-chart" role="img" aria-label="近30天答题趋势">
            {stats.days30.map((d) => (
              <span key={d.day} className="trend-col" title={`${d.day}：${d.count} 题`}>
                <span className="trend-fill" style={{ height: `${(d.count / maxCount) * 100}%` }} />
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * 全局搜索（FR-SRCH-01）：搜"指针"返回章节/数据结构/算法/题目。
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CHAPTERS } from '../content';
import { SORT_METAS } from '../core/algorithms/sorting-codes';
import type { SortId } from '../core/algorithms/sorting-codes';
import { searchExercises } from '../exercises/bank';
import { EXERCISE_TYPE_LABELS } from '../exercises/types';

interface SearchHit {
  kind: 'chapter' | 'algorithm' | 'exercise';
  title: string;
  desc: string;
  to: string;
}

export function SearchPage(): React.ReactElement {
  const [q, setQ] = useState('');
  const hits = useMemo((): SearchHit[] => searchAll(q), [q]);

  return (
    <div className="page search-page">
      <h1>搜索</h1>
      <input
        className="search-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="输入关键词：如 指针 / 链表 / malloc / 二分 / 排序 / 复杂度"
        autoFocus
        aria-label="全局搜索"
      />
      {q.trim() === '' ? (
        <p className="empty-hint">支持搜索：课程章节、数据结构、算法、练习题（题干/知识点/标签）。</p>
      ) : hits.length === 0 ? (
        <p className="empty-hint">没有找到与"{q}"相关的内容。</p>
      ) : (
        <>
          <p className="search-count">找到 {hits.length} 条结果：</p>
          <div className="search-results">
            {hits.map((h, i) => (
              <Link key={i} to={h.to} className="search-hit">
                <span className={`sh-kind ${h.kind}`}>
                  {h.kind === 'chapter' ? '章节' : h.kind === 'algorithm' ? '算法' : '题目'}
                </span>
                <strong>{h.title}</strong>
                <span className="sh-desc">{h.desc}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function searchAll(q: string): SearchHit[] {
  const k = q.trim().toLowerCase();
  if (k === '') return [];
  const hits: SearchHit[] = [];
  // 章节（标题/副标题/关键词）
  for (const c of CHAPTERS) {
    const inTitle = c.title.toLowerCase().includes(k);
    const inKw = c.keywords.some((t) => t.toLowerCase().includes(k));
    const inSub = c.subtitle.toLowerCase().includes(k);
    if (inTitle || inKw || inSub) {
      hits.push({ kind: 'chapter', title: `第 ${c.id} 章 ${c.title}`, desc: c.subtitle, to: `/course/${c.id}` });
    }
  }
  // 算法（排序 + 查找）
  for (const m of Object.values(SORT_METAS)) {
    if (
      m.name.toLowerCase().includes(k) ||
      m.feature.toLowerCase().includes(k) ||
      (k.includes('sort') && m.id.includes('sort'))
    ) {
      hits.push({ kind: 'algorithm', title: m.name, desc: `${m.timeAvg} · ${m.feature}`, to: '/lab?chapter=13' });
    }
  }
  if ('二分'.includes(k) || 'binary'.includes(k) || k.includes('查找')) {
    hits.push({ kind: 'algorithm', title: '二分查找', desc: 'O(log n)，前提：有序', to: '/lab?chapter=12' });
    hits.push({ kind: 'algorithm', title: '顺序查找', desc: 'O(n)，不要求数据有序', to: '/lab?chapter=12' });
  }
  if ('遍历'.includes(k) || k.includes('dfs') || k.includes('bfs')) {
    hits.push({ kind: 'algorithm', title: 'DFS / BFS', desc: '图的两种遍历（栈/队列）', to: '/lab?chapter=11' });
  }
  // 题目
  for (const e of searchExercises(q)) {
    hits.push({
      kind: 'exercise',
      title: `${e.knowledgePoint}（${EXERCISE_TYPE_LABELS[e.type]}）`,
      desc: e.question.replace(/```[\s\S]*?```/g, '（代码题）').slice(0, 80),
      to: `/bank?chapter=${e.chapter}`,
    });
  }
  return hits;
}

export type { SortId };

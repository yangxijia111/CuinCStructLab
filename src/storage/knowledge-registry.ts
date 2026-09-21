/**
 * 知识点注册表（P14 P1-4）：掌握度统计的唯一知识点来源。
 *
 * 修复的问题：
 *   - 此前掌握度只遍历"已答过题的知识点"，未做题的知识点根本不进统计；
 *   - 此前用 chapter.title === knowledgePoint 建立章节关联（错误关系）。
 *
 * 现在：注册表从题库（ALL_EXERCISES）派生全部知识点（id、name、chapter、tags、
 * relatedExerciseIds 动态生成、relatedLabId 可选），掌握度统计基于注册表全集。
 */
import { ALL_EXERCISES } from '../exercises/bank';
import type { Exercise } from '../exercises/types';
import type { MasteryLevel } from './mastery-rules';
import { computeMastery } from './mastery-rules';

/** 章节对应实验室（可选关联；与 LABS 的 lab id 对应） */
const CHAPTER_LAB_IDS: Record<number, string> = {
  2: 'seqlist',
  3: 'list',
  4: 'doubly',
  5: 'stack',
  6: 'queue',
  8: 'tree',
  9: 'bst',
  10: 'heap',
  11: 'graph',
  12: 'search',
  13: 'sort',
};

export interface KnowledgePoint {
  /** 知识点名即 id（与 Exercise.knowledgePoint 一致，稳定且人类可读） */
  id: string;
  name: string;
  /** 关联章节集合（按该知识点题目派生；同名跨章知识点覆盖多章） */
  chapters: number[];
  /** 主章节（最小章节号） */
  primaryChapter: number;
  tags: string[];
  /** 关联练习 id（动态生成：该知识点下全部题目） */
  relatedExerciseIds: string[];
  /** 可选关联实验室 */
  relatedLabId?: string;
}

function buildRegistry(exercises: Exercise[]): KnowledgePoint[] {
  const byName = new Map<string, { chapters: Set<number>; tags: Set<string>; exerciseIds: string[] }>();
  for (const ex of exercises) {
    let entry = byName.get(ex.knowledgePoint);
    if (entry === undefined) {
      entry = { chapters: new Set(), tags: new Set(), exerciseIds: [] };
      byName.set(ex.knowledgePoint, entry);
    }
    entry.chapters.add(ex.chapter);
    for (const t of ex.tags) entry.tags.add(t);
    entry.exerciseIds.push(ex.id);
  }
  return [...byName.entries()]
    .map(([name, e]) => {
      const chapters = [...e.chapters].sort((a, b) => a - b);
      return {
        id: name,
        name,
        chapters,
        primaryChapter: chapters[0] ?? -1,
        tags: [...e.tags],
        relatedExerciseIds: [...e.exerciseIds],
        relatedLabId: CHAPTER_LAB_IDS[chapters[0] ?? -1],
      };
    })
    .sort((a, b) => a.primaryChapter - b.primaryChapter || a.name.localeCompare(b.name, 'zh'));
}

/** 全部注册知识点（模块级缓存；题库是静态数据） */
export const KNOWLEDGE_POINTS: KnowledgePoint[] = buildRegistry(ALL_EXERCISES);

const registryById = new Map<string, KnowledgePoint>(KNOWLEDGE_POINTS.map((k) => [k.id, k]));

/** 按 id 查找知识点 */
export function getKnowledgePoint(id: string): KnowledgePoint | undefined {
  return registryById.get(id);
}

/** 掌握度统计输入（全部基于注册关联，不依赖标题匹配） */
export interface KnowledgePointStatsInput {
  /** 答题记录（exerciseId → 正确与否） */
  attempts: Array<{ exerciseId: string; correct: boolean }>;
  /** 有学习行为的章节集合（章节进度 ≠ new） */
  studiedChapters: Set<number>;
  /** 错题被手动标记掌握的 exerciseId 集合（只影响其所属知识点） */
  masteredExerciseIds: Set<string>;
}

export interface KnowledgePointStats {
  point: KnowledgePoint;
  level: MasteryLevel;
  attempts: number;
  correct: number;
}

/**
 * 对注册表全集计算掌握度（P14 P1-4 核心）：
 *   - 无任何行为 → unlearned；读过关联章节 → learning；
 *   - 答题按 relatedExerciseIds 精确聚合；
 *   - 错题手动掌握只影响该 exerciseId 所属知识点（不含同名其他知识点——同名即同知识点，按 id 精确关联）。
 */
export function computeKnowledgePointStats(input: KnowledgePointStatsInput): KnowledgePointStats[] {
  const attemptAgg = new Map<string, { attempts: number; correct: number }>();
  for (const a of input.attempts) {
    const cur = attemptAgg.get(a.exerciseId) ?? { attempts: 0, correct: 0 };
    cur.attempts += 1;
    if (a.correct) cur.correct += 1;
    attemptAgg.set(a.exerciseId, cur);
  }

  return KNOWLEDGE_POINTS.map((point) => {
    let attempts = 0;
    let correct = 0;
    let manuallyMastered = false;
    for (const exId of point.relatedExerciseIds) {
      const agg = attemptAgg.get(exId);
      if (agg !== undefined) {
        attempts += agg.attempts;
        correct += agg.correct;
      }
      if (input.masteredExerciseIds.has(exId)) manuallyMastered = true;
    }
    const hasStudyActivity =
      attempts > 0 || point.chapters.some((ch) => input.studiedChapters.has(ch)) || manuallyMastered;
    const level = computeMastery({ attempts, correct, hasStudyActivity, manuallyMastered });
    return { point, level, attempts, correct };
  });
}

/** 掌握分布计数 */
export function countMasteryLevels(stats: KnowledgePointStats[]): Record<MasteryLevel, number> {
  const out: Record<MasteryLevel, number> = { unlearned: 0, learning: 0, weak: 0, basic: 0, mastered: 0 };
  for (const s of stats) out[s.level] += 1;
  return out;
}

/**
 * 知识点注册表与掌握度统计回归（P14 P1-4）。
 * 核心修复：掌握度统计基于注册表全集（未做题的知识点也参与），
 * 章节关联不再依赖 chapter.title === knowledgePoint 的脆弱匹配。
 */
import { describe, expect, it } from 'vitest';
import { ALL_EXERCISES } from '../src/exercises/bank';
import { CHAPTERS } from '../src/content';
import {
  KNOWLEDGE_POINTS,
  computeKnowledgePointStats,
  countMasteryLevels,
  getKnowledgePoint,
} from '../src/storage/knowledge-registry';

describe('KnowledgePointRegistry 完整性', () => {
  it('每个 exercise 的 knowledgePoint 都已注册', () => {
    const ids = new Set(KNOWLEDGE_POINTS.map((k) => k.id));
    for (const ex of ALL_EXERCISES) {
      expect(ids.has(ex.knowledgePoint), `未注册知识点：${ex.knowledgePoint}（${ex.id}）`).toBe(true);
    }
  });

  it('relatedExerciseIds 与题库反查一致（动态生成）', () => {
    for (const point of KNOWLEDGE_POINTS) {
      const expected = ALL_EXERCISES.filter((e) => e.knowledgePoint === point.id).map((e) => e.id);
      expect([...point.relatedExerciseIds].sort()).toEqual([...expected].sort());
      expect(point.relatedExerciseIds.length).toBeGreaterThan(0);
    }
  });

  it('章节关联来自题库 chapter 字段，而非标题匹配', () => {
    for (const point of KNOWLEDGE_POINTS) {
      const expectedChapters = new Set(
        ALL_EXERCISES.filter((e) => e.knowledgePoint === point.id).map((e) => e.chapter),
      );
      expect(new Set(point.chapters)).toEqual(expectedChapters);
      expect(point.chapters).toContain(point.primaryChapter);
      // 章节 id 必须真实存在
      for (const ch of point.chapters) {
        expect(CHAPTERS.some((c) => c.id === ch), `知识点 ${point.id} 引用不存在的章节 ${ch}`).toBe(true);
      }
    }
  });

  it('getKnowledgePoint 精确查找；未注册 id 返回 undefined', () => {
    const first = KNOWLEDGE_POINTS[0]!;
    expect(getKnowledgePoint(first.id)?.id).toBe(first.id);
    expect(getKnowledgePoint('不存在的知识点-xyz')).toBeUndefined();
  });

  it('注册表规模合理（覆盖 86 题题库的知识点全集）', () => {
    const uniqueKp = new Set(ALL_EXERCISES.map((e) => e.knowledgePoint));
    expect(KNOWLEDGE_POINTS.length).toBe(uniqueKp.size);
    expect(KNOWLEDGE_POINTS.length).toBeGreaterThan(50);
  });
});

describe('掌握度统计：注册表全集', () => {
  it('未做题且未读章节的知识点 → unlearned 且进入统计（此前完全缺失）', () => {
    const stats = computeKnowledgePointStats({ attempts: [], studiedChapters: new Set(), masteredExerciseIds: new Set() });
    expect(stats.length).toBe(KNOWLEDGE_POINTS.length);
    expect(countMasteryLevels(stats).unlearned).toBe(KNOWLEDGE_POINTS.length);
  });

  it('读过章节但未做题 → 该章全部知识点 learning', () => {
    const stats = computeKnowledgePointStats({
      attempts: [],
      studiedChapters: new Set([3]),
      masteredExerciseIds: new Set(),
    });
    const ch3 = stats.filter((s) => s.point.chapters.includes(3));
    expect(ch3.length).toBeGreaterThan(0);
    for (const s of ch3) expect(s.level).toBe('learning');
    // 其他章节知识点保持 unlearned
    const others = stats.filter((s) => !s.point.chapters.includes(3));
    for (const s of others) expect(s.level).toBe('unlearned');
  });

  it('答错 1 次（p=0%）→ weak；答对但 n<3 → basic', () => {
    const target = KNOWLEDGE_POINTS.find((k) => k.relatedExerciseIds.length >= 1)!;
    const exId = target.relatedExerciseIds[0]!;
    const stats = computeKnowledgePointStats({
      attempts: [{ exerciseId: exId, correct: false }],
      studiedChapters: new Set(),
      masteredExerciseIds: new Set(),
    });
    const s = stats.find((x) => x.point.id === target.id)!;
    expect(s.attempts).toBe(1);
    expect(s.correct).toBe(0);
    expect(s.level).toBe('weak'); // p < 50% → 待加强

    // 同题答对：n=1 < 3 → basic（不足以 mastered）
    const stats2 = computeKnowledgePointStats({
      attempts: [{ exerciseId: exId, correct: true }],
      studiedChapters: new Set(),
      masteredExerciseIds: new Set(),
    });
    expect(stats2.find((x) => x.point.id === target.id)!.level).toBe('basic');
  });

  it('错题手动标记掌握 → 仅影响该题目所属知识点', () => {
    const exId = ALL_EXERCISES[0]!.id;
    const kpId = ALL_EXERCISES[0]!.knowledgePoint;
    const stats = computeKnowledgePointStats({
      attempts: [],
      studiedChapters: new Set(),
      masteredExerciseIds: new Set([exId]),
    });
    const hit = stats.find((s) => s.point.id === kpId)!;
    expect(hit.level).toBe('mastered');
    const rest = stats.filter((s) => s.point.id !== kpId);
    for (const s of rest) expect(s.level).toBe('unlearned');
  });

  it('n≥3 且正确率 ≥80% → mastered', () => {
    const target = KNOWLEDGE_POINTS.find((k) => k.relatedExerciseIds.length >= 3) ?? KNOWLEDGE_POINTS[0]!;
    const ids = target.relatedExerciseIds.slice(0, 3);
    while (ids.length < 3) ids.push(target.relatedExerciseIds[0]!);
    const stats = computeKnowledgePointStats({
      attempts: ids.map((id) => ({ exerciseId: id, correct: true })),
      studiedChapters: new Set(),
      masteredExerciseIds: new Set(),
    });
    const s = stats.find((x) => x.point.id === target.id)!;
    expect(s.level).toBe('mastered');
  });

  it('分布计数相加等于注册表全集大小', () => {
    const stats = computeKnowledgePointStats({
      attempts: ALL_EXERCISES.slice(0, 10).map((e) => ({ exerciseId: e.id, correct: e.id.length % 2 === 0 })),
      studiedChapters: new Set([1, 2, 3]),
      masteredExerciseIds: new Set(),
    });
    const dist = countMasteryLevels(stats);
    expect(Object.values(dist).reduce((a, b) => a + b, 0)).toBe(KNOWLEDGE_POINTS.length);
  });
});

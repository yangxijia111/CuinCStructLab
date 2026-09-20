/**
 * 题库汇总与检索。
 */
import type { Exercise, ExerciseType } from '../types';
import { LINEAR_BANK } from './bank-linear';
import { TREE_BANK } from './bank-tree';
import { ALGO_BANK } from './bank-algo';

export const ALL_EXERCISES: Exercise[] = [...LINEAR_BANK, ...TREE_BANK, ...ALGO_BANK];

export function exercisesByChapter(chapter: number): Exercise[] {
  return ALL_EXERCISES.filter((e) => e.chapter === chapter);
}

export function getExercise(id: string): Exercise | undefined {
  return ALL_EXERCISES.find((e) => e.id === id);
}

/** 搜索（按题干/知识点/标签） */
export function searchExercises(keyword: string): Exercise[] {
  const k = keyword.trim().toLowerCase();
  if (k === '') return [];
  return ALL_EXERCISES.filter(
    (e) =>
      e.question.toLowerCase().includes(k) ||
      e.knowledgePoint.toLowerCase().includes(k) ||
      e.tags.some((t) => t.toLowerCase().includes(k)),
  );
}

/** 覆盖全部题型检查 */
export function coveredTypes(): Set<ExerciseType> {
  return new Set(ALL_EXERCISES.map((e) => e.type));
}

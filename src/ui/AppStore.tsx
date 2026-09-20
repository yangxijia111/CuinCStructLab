/**
 * 全局应用状态：主题 / 新手模式 / 课程进度（P9 接 SQLite 前先用内存 + 事件总线）。
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Exercise } from '../exercises/types';

export type Theme = 'dark' | 'light';

export interface ChapterProgress {
  status: 'new' | 'learning' | 'done';
  lastVisitAt: number;
  visitCount: number;
  maxSectionIndex: number;
}

export interface AttemptRecord {
  exerciseId: string;
  chapter: number;
  knowledgePoint: string;
  correct: boolean;
  userAnswer: unknown;
  createdAt: number;
}

export interface WrongItem {
  exerciseId: string;
  chapter: number;
  knowledgePoint: string;
  errorCategory: string;
  wrongCount: number;
  lastWrongAt: number;
  mastered: boolean;
  masteredAt: number | null;
}

export interface AppStoreValue {
  theme: Theme;
  setTheme(theme: Theme): void;
  beginnerMode: boolean;
  setBeginnerMode(on: boolean): void;
  /** 章节进度（P9 前为内存实现） */
  progress: Record<number, ChapterProgress>;
  visitChapter(chapter: number, sectionIndex: number): void;
  markChapterDone(chapter: number): void;
  /** 答题记录 */
  attempts: AttemptRecord[];
  /** 错题本 */
  wrongBook: Record<string, WrongItem>;
  recordAttempt(exercise: Exercise, correct: boolean, userAnswer?: unknown): void;
  markWrongMastered(exerciseId: string): void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [beginnerMode, setBeginnerModeState] = useState(false);
  const [progress, setProgress] = useState<Record<number, ChapterProgress>>({});
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [wrongBook, setWrongBook] = useState<Record<string, WrongItem>>({});

  const setTheme = useCallback((t: Theme): void => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
  }, []);

  const setBeginnerMode = useCallback((on: boolean): void => {
    setBeginnerModeState(on);
  }, []);

  const visitChapter = useCallback((chapter: number, sectionIndex: number): void => {
    setProgress((prev) => {
      const cur = prev[chapter];
      return {
        ...prev,
        [chapter]: {
          status: 'learning',
          lastVisitAt: Date.now(),
          visitCount: (cur?.visitCount ?? 0) + 1,
          maxSectionIndex: Math.max(cur?.maxSectionIndex ?? 0, sectionIndex),
        },
      };
    });
  }, []);

  const markChapterDone = useCallback((chapter: number): void => {
    setProgress((prev) => {
      const cur = prev[chapter];
      return {
        ...prev,
        [chapter]: {
          status: 'done',
          lastVisitAt: Date.now(),
          visitCount: cur?.visitCount ?? 0,
          maxSectionIndex: cur?.maxSectionIndex ?? 13,
        },
      };
    });
  }, []);

  const recordAttempt = useCallback((exercise: Exercise, correct: boolean, userAnswer?: unknown): void => {
    const now = Date.now();
    setAttempts((prev) => [
      ...prev,
      {
        exerciseId: exercise.id,
        chapter: exercise.chapter,
        knowledgePoint: exercise.knowledgePoint,
        correct,
        userAnswer,
        createdAt: now,
      },
    ]);
    if (!correct) {
      setWrongBook((prev) => {
        const cur = prev[exercise.id];
        return {
          ...prev,
          [exercise.id]: {
            exerciseId: exercise.id,
            chapter: exercise.chapter,
            knowledgePoint: exercise.knowledgePoint,
            errorCategory: exercise.errorCategory,
            wrongCount: (cur?.wrongCount ?? 0) + 1,
            lastWrongAt: now,
            mastered: false,
            masteredAt: null,
          },
        };
      });
    } else {
      // 答对：若错题已连续答对 2 次，可自动建议掌握（标记由用户确认）
      setWrongBook((prev) => {
        const cur = prev[exercise.id];
        if (cur === undefined || cur.mastered) return prev;
        return prev;
      });
    }
  }, []);

  const markWrongMastered = useCallback((exerciseId: string): void => {
    setWrongBook((prev) => {
      const cur = prev[exerciseId];
      if (cur === undefined) return prev;
      return { ...prev, [exerciseId]: { ...cur, mastered: true, masteredAt: Date.now() } };
    });
  }, []);

  const value = useMemo<AppStoreValue>(
    () => ({
      theme,
      setTheme,
      beginnerMode,
      setBeginnerMode,
      progress,
      visitChapter,
      markChapterDone,
      attempts,
      wrongBook,
      recordAttempt,
      markWrongMastered,
    }),
    [theme, setTheme, beginnerMode, setBeginnerMode, progress, visitChapter, markChapterDone, attempts, wrongBook, recordAttempt, markWrongMastered],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (ctx === null) throw new Error('useAppStore 必须在 AppStoreProvider 内使用');
  return ctx;
}

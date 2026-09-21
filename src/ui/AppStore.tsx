/**
 * 全局应用状态：主题 / 新手模式 / 课程进度 / 答题与错题 / 笔记收藏。
 * P9 起：所有重要数据双写 SQLite（sql.js），启动时恢复（FR-DATA-01..04）。
 * 内存态为 UI 的 source of truth；写库失败 → storageError 横幅（NFR-06，不静默）。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Exercise } from '../exercises/types';
import type { AppDatabase } from '../storage/db';
import { getDb, resetDatabase } from '../storage/db';
import * as repos from '../storage/repos';
import type { ChapterProgressRow, TargetType } from '../storage/repos';

export type Theme = 'dark' | 'light';

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

export interface ChapterProgress {
  status: 'new' | 'learning' | 'done';
  lastVisitAt: number;
  visitCount: number;
  maxSectionIndex: number;
}

export interface AppStoreValue {
  /** 数据库是否已加载完成 */
  storageReady: boolean;
  /** 存储层错误（显示常驻横幅） */
  storageError: string | null;
  theme: Theme;
  setTheme(theme: Theme): void;
  beginnerMode: boolean;
  setBeginnerMode(on: boolean): void;
  progress: Record<number, ChapterProgress>;
  visitChapter(chapter: number, sectionIndex: number): void;
  markChapterDone(chapter: number): void;
  attempts: AttemptRecord[];
  wrongBook: Record<string, WrongItem>;
  recordAttempt(exercise: Exercise, correct: boolean, userAnswer?: unknown): void;
  markWrongMastered(exerciseId: string): void;
  notes: Record<string, string>;
  saveNote(targetType: TargetType, targetId: string, content: string): void;
  favorites: Array<{ targetType: TargetType; targetId: string; createdAt: number }>;
  toggleFavorite(targetType: TargetType, targetId: string): void;
  isFavorite(targetType: TargetType, targetId: string): boolean;
  /** 导出全部学习数据（JSON 字符串） */
  exportData(): Promise<string>;
  /** 清空全部数据（关闭并删除底层数据库 + 重置内存态，二次确认在 UI 层） */
  resetAllData(): Promise<void>;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

/** 用题目元数据补全错题展示信息 */
function enrichWrong(
  row: { exerciseId: string; errorCategory: string; wrongCount: number; lastWrongAt: number; mastered: boolean; masteredAt: number | null },
  exerciseMeta: Map<string, Exercise>,
): WrongItem {
  const ex = exerciseMeta.get(row.exerciseId);
  return {
    exerciseId: row.exerciseId,
    chapter: ex?.chapter ?? -1,
    knowledgePoint: ex?.knowledgePoint ?? '',
    errorCategory: row.errorCategory,
    wrongCount: row.wrongCount,
    lastWrongAt: row.lastWrongAt,
    mastered: row.mastered,
    masteredAt: row.masteredAt,
  };
}

export function AppStoreProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [beginnerMode, setBeginnerModeState] = useState(false);
  const [progress, setProgress] = useState<Record<number, ChapterProgress>>({});
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [wrongBook, setWrongBook] = useState<Record<string, WrongItem>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [favorites, setFavorites] = useState<Array<{ targetType: TargetType; targetId: string; createdAt: number }>>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  // 启动：加载 SQLite 并恢复状态
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const db = await getDb();
        if (cancelled) return;
        const p: Record<number, ChapterProgress> = {};
        const rows: ChapterProgressRow[] = Object.values(repos.loadChapterProgress(db));
        for (const row of rows) {
          p[row.chapter] = {
            status: row.status,
            lastVisitAt: row.lastVisitAt,
            visitCount: row.visitCount,
            maxSectionIndex: row.maxSectionIndex,
          };
        }
        setProgress(p);
        const { ALL_EXERCISES } = await import('../exercises/bank');
        const meta = new Map(ALL_EXERCISES.map((e) => [e.id, e]));
        const at: AttemptRecord[] = repos.loadAttempts(db).map((r) => ({
          exerciseId: r.exerciseId,
          chapter: r.chapter,
          knowledgePoint: meta.get(r.exerciseId)?.knowledgePoint ?? '',
          correct: r.correct,
          userAnswer: r.userAnswer,
          createdAt: r.createdAt,
        }));
        setAttempts(at);
        const wb: Record<string, WrongItem> = {};
        for (const row of Object.values(repos.loadWrongBook(db))) {
          wb[row.exerciseId] = enrichWrong(row, meta);
        }
        setWrongBook(wb);
        setNotes(repos.loadNotes(db));
        setFavorites(repos.loadFavorites(db));
        const settings = repos.loadSettings(db);
        if (settings.theme === 'light' || settings.theme === 'dark') {
          setThemeState(settings.theme);
          document.documentElement.dataset.theme = settings.theme;
        }
        if (settings.beginnerMode === '1') setBeginnerModeState(true);
        setStorageReady(true);
      } catch (err) {
        if (!cancelled) {
          setStorageError(err instanceof Error ? err.message : String(err));
          setStorageReady(true); // 存储失败仍可使用（内存态兜底）
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 所有写库调用统一入口：失败设置错误横幅，绝不静默 */
  const withDb = useCallback((fn: (db: AppDatabase) => void): void => {
    void getDb()
      .then(fn)
      .catch((err: unknown) => {
        setStorageError(`数据保存失败：${err instanceof Error ? err.message : String(err)}`);
      });
  }, []);

  const setTheme = useCallback(
    (t: Theme): void => {
      setThemeState(t);
      document.documentElement.dataset.theme = t;
      withDb((db) => repos.saveSetting(db, 'theme', t));
    },
    [withDb],
  );

  const setBeginnerMode = useCallback(
    (on: boolean): void => {
      setBeginnerModeState(on);
      withDb((db) => repos.saveSetting(db, 'beginnerMode', on ? '1' : '0'));
    },
    [withDb],
  );

  const visitChapter = useCallback(
    (chapter: number, sectionIndex: number): void => {
      setProgress((prev) => {
        const cur = prev[chapter];
        return {
          ...prev,
          [chapter]: {
            // done 是单调终态：已完成章节复习时不得降级（new → learning → done 单向）
            status: cur?.status === 'done' ? 'done' : 'learning',
            lastVisitAt: Date.now(),
            visitCount: (cur?.visitCount ?? 0) + 1,
            maxSectionIndex: Math.max(cur?.maxSectionIndex ?? 0, sectionIndex),
          },
        };
      });
      withDb((db) => repos.saveChapterVisit(db, chapter, sectionIndex));
    },
    [withDb],
  );

  const markChapterDone = useCallback(
    (chapter: number): void => {
      setProgress((prev) => {
        const cur = prev[chapter];
        return {
          ...prev,
          [chapter]: {
            status: 'done',
            lastVisitAt: Date.now(),
            visitCount: cur?.visitCount ?? 0,
            maxSectionIndex: 13,
          },
        };
      });
      withDb((db) => {
        repos.saveChapterVisit(db, chapter, 13);
        repos.saveChapterDone(db, chapter);
      });
    },
    [withDb],
  );

  const recordAttempt = useCallback(
    (exercise: Exercise, correct: boolean, userAnswer?: unknown): void => {
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
      }
      withDb((db) => {
        repos.saveAttempt(db, exercise.id, exercise.chapter, correct, JSON.stringify(userAnswer ?? null));
        if (!correct) repos.saveWrong(db, exercise.id, exercise.errorCategory);
      });
    },
    [withDb],
  );

  const markWrongMastered = useCallback(
    (exerciseId: string): void => {
      setWrongBook((prev) => {
        const cur = prev[exerciseId];
        if (cur === undefined) return prev;
        return { ...prev, [exerciseId]: { ...cur, mastered: true, masteredAt: Date.now() } };
      });
      withDb((db) => repos.markWrongMastered(db, exerciseId));
    },
    [withDb],
  );

  const saveNote = useCallback(
    (targetType: TargetType, targetId: string, content: string): void => {
      setNotes((prev) => ({ ...prev, [`${targetType}:${targetId}`]: content }));
      withDb((db) => repos.saveNote(db, targetType, targetId, content));
    },
    [withDb],
  );

  const toggleFavorite = useCallback(
    (targetType: TargetType, targetId: string): void => {
      setFavorites((prev) => {
        const exists = prev.some((f) => f.targetType === targetType && f.targetId === targetId);
        return exists
          ? prev.filter((f) => !(f.targetType === targetType && f.targetId === targetId))
          : [...prev, { targetType, targetId, createdAt: Date.now() }];
      });
      withDb((db) => repos.toggleFavorite(db, targetType, targetId));
    },
    [withDb],
  );

  const isFavorite = useCallback(
    (targetType: TargetType, targetId: string): boolean =>
      favorites.some((f) => f.targetType === targetType && f.targetId === targetId),
    [favorites],
  );

  const exportData = useCallback(async (): Promise<string> => {
    const db = await getDb();
    return db.exportJson();
  }, []);

  /** 清空全部数据：删除底层数据库（Web/Electron 统一走 backend.reset）+ 全部内存态复位 */
  const resetAllData = useCallback(async (): Promise<void> => {
    await resetDatabase();
    setProgress({});
    setAttempts([]);
    setWrongBook({});
    setNotes({});
    setFavorites([]);
    setThemeState('dark');
    document.documentElement.dataset.theme = 'dark';
    setBeginnerModeState(false);
    setStorageError(null);
  }, []);

  const value = useMemo<AppStoreValue>(
    () => ({
      storageReady,
      storageError,
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
      notes,
      saveNote,
      favorites,
      toggleFavorite,
      isFavorite,
      exportData,
      resetAllData,
    }),
    [
      storageReady,
      storageError,
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
      notes,
      saveNote,
      favorites,
      toggleFavorite,
      isFavorite,
      exportData,
      resetAllData,
    ],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (ctx === null) throw new Error('useAppStore 必须在 AppStoreProvider 内使用');
  return ctx;
}

/**
 * 全局应用状态：主题 / 新手模式 / 课程进度（P9 接 SQLite 前先用内存 + 事件总线）。
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'dark' | 'light';

export interface ChapterProgress {
  status: 'new' | 'learning' | 'done';
  lastVisitAt: number;
  visitCount: number;
  maxSectionIndex: number;
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
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [beginnerMode, setBeginnerModeState] = useState(false);
  const [progress, setProgress] = useState<Record<number, ChapterProgress>>({});

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

  const value = useMemo<AppStoreValue>(
    () => ({ theme, setTheme, beginnerMode, setBeginnerMode, progress, visitChapter, markChapterDone }),
    [theme, setTheme, beginnerMode, setBeginnerMode, progress, visitChapter, markChapterDone],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (ctx === null) throw new Error('useAppStore 必须在 AppStoreProvider 内使用');
  return ctx;
}

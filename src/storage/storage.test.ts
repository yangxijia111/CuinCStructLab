import { beforeEach, describe, expect, it } from 'vitest';
import { AppDatabase } from './db';
import { MemoryBackend, type PersistenceBackend } from './backend';
import {
  loadChapterProgress,
  loadFavorites,
  loadNotes,
  loadSettings,
  loadStudyDays,
  loadWrongBook,
  markWrongMastered,
  saveAttempt,
  saveChapterDone,
  saveChapterVisit,
  saveNote,
  saveSetting,
  saveSubmission,
  loadCodingProgress,
  saveWrong,
  toggleFavorite,
} from './repos';
import { computeMastery, streakDays, todayKey } from './mastery-rules';

let db: AppDatabase;
let backend: MemoryBackend;

beforeEach(async () => {
  backend = new MemoryBackend();
  db = await AppDatabase.open({ backend });
});

describe('migration', () => {
  it('空库迁移到 v1', () => {
    expect(db.version).toBe(1);
    // 全部表可查询
    for (const t of ['meta', 'chapter_progress', 'attempt', 'wrong_book', 'note', 'favorite', 'study_day', 'settings', 'submission', 'coding_progress', 'mastery']) {
      expect(db.all(`SELECT COUNT(*) AS c FROM ${t}`).length).toBe(1);
    }
  });

  it('重复打开不重复迁移（幂等）', async () => {
    backend = new MemoryBackend();
    const first = await AppDatabase.open({ backend });
    await first.flush();
    const bytes = await backend.load();
    expect(bytes).not.toBeNull();
    const second = await AppDatabase.open({ backend: new MemoryBackendPassthrough(bytes) });
    expect(second.version).toBe(1);
    second.close();
    first.close();
  });

  it('写操作后字节持久化且可恢复', async () => {
    saveChapterVisit(db, 3, 2);
    await db.flush();
    const bytes = await backend.load();
    expect(bytes).not.toBeNull();
    const reopened = await AppDatabase.open({ backend: new MemoryBackendPassthrough(bytes) });
    const restored = loadChapterProgress(reopened);
    expect(restored[3]?.visitCount).toBe(1);
    reopened.close();
  });
});

/** 直接从现有字节加载的后端（测试恢复路径） */
class MemoryBackendPassthrough implements PersistenceBackend {
  constructor(private readonly data: Uint8Array | null) {}
  load(): Promise<Uint8Array | null> {
    return Promise.resolve(this.data === null ? null : new Uint8Array(this.data));
  }
  save(): Promise<void> {
    return Promise.resolve();
  }
}

describe('CRUD', () => {
  it('章节进度：访问/完成', () => {
    saveChapterVisit(db, 2, 3);
    saveChapterVisit(db, 2, 5);
    let p = loadChapterProgress(db);
    expect(p[2]?.status).toBe('learning');
    expect(p[2]?.visitCount).toBe(2);
    expect(p[2]?.maxSectionIndex).toBe(5);
    saveChapterDone(db, 2);
    p = loadChapterProgress(db);
    expect(p[2]?.status).toBe('done');
  });

  it('答题与错题本：记录/累加/标记掌握', () => {
    saveAttempt(db, 'ch03-q01', 3, false, 'A');
    saveAttempt(db, 'ch03-q01', 3, true, 'B');
    saveWrong(db, 'ch03-q01', 'pointer');
    saveWrong(db, 'ch03-q01', 'pointer');
    let wrong = loadWrongBook(db);
    expect(wrong['ch03-q01']?.wrongCount).toBe(2);
    expect(wrong['ch03-q01']?.mastered).toBe(false);
    markWrongMastered(db, 'ch03-q01');
    wrong = loadWrongBook(db);
    expect(wrong['ch03-q01']?.mastered).toBe(true);
    expect(wrong['ch03-q01']?.masteredAt).not.toBeNull();
  });

  it('笔记与收藏（含开关）', () => {
    saveNote(db, 'chapter', '3', '注意接线顺序');
    saveNote(db, 'exercise', 'ch03-q01', '断链题又错了');
    expect(loadNotes(db)['chapter:3']).toBe('注意接线顺序');
    expect(toggleFavorite(db, 'exercise', 'ch03-q01')).toBe(true);
    expect(toggleFavorite(db, 'exercise', 'ch03-q01')).toBe(false);
    expect(loadFavorites(db)).toHaveLength(0);
  });

  it('设置', () => {
    saveSetting(db, 'theme', 'dark');
    saveSetting(db, 'theme', 'light');
    expect(loadSettings(db).theme).toBe('light');
  });

  it('学习日活与提交记录', () => {
    saveAttempt(db, 'x', 1, true, 'a');
    const days = loadStudyDays(db);
    expect(days.some((d) => d.day === todayKey() && d.events >= 1)).toBe(true);
    saveSubmission(db, 'p-1', 'accepted', 'int f(){}');
    const cp = loadCodingProgress(db);
    expect(cp.find((c) => c.problemId === 'p-1')?.acceptedAt).not.toBeNull();
  });
});

describe('掌握度规则（全表）', () => {
  it('边界矩阵', () => {
    expect(computeMastery({ attempts: 0, correct: 0, hasStudyActivity: false, manuallyMastered: false })).toBe('unlearned');
    expect(computeMastery({ attempts: 0, correct: 0, hasStudyActivity: true, manuallyMastered: false })).toBe('learning');
    expect(computeMastery({ attempts: 1, correct: 0, hasStudyActivity: true, manuallyMastered: false })).toBe('weak');
    expect(computeMastery({ attempts: 4, correct: 1, hasStudyActivity: true, manuallyMastered: false })).toBe('weak');
    expect(computeMastery({ attempts: 2, correct: 2, hasStudyActivity: true, manuallyMastered: false })).toBe('basic'); // n<3
    expect(computeMastery({ attempts: 3, correct: 2, hasStudyActivity: true, manuallyMastered: false })).toBe('basic'); // p<80%
    expect(computeMastery({ attempts: 5, correct: 4, hasStudyActivity: true, manuallyMastered: false })).toBe('mastered'); // n≥3 p≥80%
    expect(computeMastery({ attempts: 1, correct: 0, hasStudyActivity: false, manuallyMastered: true })).toBe('mastered');
  });
});

describe('连续学习天数', () => {
  it('连续/中断/今天未学', () => {
    const today = todayKey();
    const mk = (offset: number): string => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      return todayKey(d);
    };
    expect(streakDays([mk(0), mk(1), mk(2)], today)).toBe(3);
    expect(streakDays([mk(1), mk(2), mk(3)], today)).toBe(3); // 今天没学不算断
    expect(streakDays([mk(0), mk(2), mk(3)], today)).toBe(1); // 昨天断
    expect(streakDays([], today)).toBe(0);
    expect(streakDays([mk(5)], today)).toBe(0);
  });
});

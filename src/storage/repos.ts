/**
 * 仓库层：全部表的 CRUD（DATA_SPEC §4）。UI 只依赖这些函数。
 */
import type { AppDatabase } from './db';
import { todayKey } from './mastery-rules';

/* ============ 章节进度 ============ */

export interface ChapterProgressRow {
  chapter: number;
  status: 'new' | 'learning' | 'done';
  lastVisitAt: number;
  visitCount: number;
  maxSectionIndex: number;
}

export function loadChapterProgress(db: AppDatabase): Record<number, ChapterProgressRow> {
  const rows = db.all('SELECT chapter, status, lastVisitAt, visitCount, maxSectionIndex FROM chapter_progress');
  const out: Record<number, ChapterProgressRow> = {};
  for (const r of rows) {
    out[Number(r.chapter)] = {
      chapter: Number(r.chapter),
      status: r.status as ChapterProgressRow['status'],
      lastVisitAt: Number(r.lastVisitAt),
      visitCount: Number(r.visitCount),
      maxSectionIndex: Number(r.maxSectionIndex),
    };
  }
  return out;
}

export function saveChapterVisit(db: AppDatabase, chapter: number, sectionIndex: number): void {
  const now = Date.now();
  db.run(
    `INSERT INTO chapter_progress(chapter, status, lastVisitAt, visitCount, maxSectionIndex)
     VALUES(?, 'learning', ?, 1, ?)
     ON CONFLICT(chapter) DO UPDATE SET
       status = 'learning', lastVisitAt = excluded.lastVisitAt, visitCount = visitCount + 1,
       maxSectionIndex = MAX(maxSectionIndex, excluded.maxSectionIndex)`,
    [chapter, now, sectionIndex],
  );
  bumpStudyDay(db);
}

export function saveChapterDone(db: AppDatabase, chapter: number): void {
  db.run(`UPDATE chapter_progress SET status = 'done', lastVisitAt = ? WHERE chapter = ?`, [Date.now(), chapter]);
}

/* ============ 答题记录 ============ */

export interface AttemptRow {
  id: number;
  exerciseId: string;
  chapter: number;
  correct: boolean;
  userAnswer: string;
  createdAt: number;
}

export function loadAttempts(db: AppDatabase): AttemptRow[] {
  const rows = db.all('SELECT id, exerciseId, chapter, correct, userAnswer, createdAt FROM attempt ORDER BY id');
  return rows.map((r) => ({
    id: Number(r.id),
    exerciseId: String(r.exerciseId),
    chapter: Number(r.chapter),
    correct: Number(r.correct) === 1,
    userAnswer: String(r.userAnswer),
    createdAt: Number(r.createdAt),
  }));
}

export function saveAttempt(
  db: AppDatabase,
  exerciseId: string,
  chapter: number,
  correct: boolean,
  userAnswer: string,
): void {
  db.run('INSERT INTO attempt(exerciseId, chapter, correct, userAnswer, createdAt) VALUES(?, ?, ?, ?, ?)', [
    exerciseId,
    chapter,
    correct ? 1 : 0,
    userAnswer,
    Date.now(),
  ]);
  bumpStudyDay(db);
}

/* ============ 错题本 ============ */

export interface WrongRow {
  exerciseId: string;
  errorCategory: string;
  wrongCount: number;
  lastWrongAt: number;
  mastered: boolean;
  masteredAt: number | null;
}

export function loadWrongBook(db: AppDatabase): Record<string, WrongRow> {
  const rows = db.all('SELECT exerciseId, errorCategory, wrongCount, lastWrongAt, mastered, masteredAt FROM wrong_book');
  const out: Record<string, WrongRow> = {};
  for (const r of rows) {
    out[String(r.exerciseId)] = {
      exerciseId: String(r.exerciseId),
      errorCategory: String(r.errorCategory),
      wrongCount: Number(r.wrongCount),
      lastWrongAt: Number(r.lastWrongAt),
      mastered: Number(r.mastered) === 1,
      masteredAt: r.masteredAt === null || r.masteredAt === undefined ? null : Number(r.masteredAt),
    };
  }
  return out;
}

export function saveWrong(db: AppDatabase, exerciseId: string, errorCategory: string): void {
  const now = Date.now();
  db.run(
    `INSERT INTO wrong_book(exerciseId, errorCategory, wrongCount, lastWrongAt, mastered, masteredAt)
     VALUES(?, ?, 1, ?, 0, NULL)
     ON CONFLICT(exerciseId) DO UPDATE SET
       wrongCount = wrongCount + 1, lastWrongAt = ?, mastered = 0, masteredAt = NULL`,
    [exerciseId, errorCategory, now, now],
  );
}

export function markWrongMastered(db: AppDatabase, exerciseId: string): void {
  db.run('UPDATE wrong_book SET mastered = 1, masteredAt = ? WHERE exerciseId = ?', [Date.now(), exerciseId]);
}

/* ============ 学习日活 ============ */

export function bumpStudyDay(db: AppDatabase): void {
  db.run('INSERT INTO study_day(day, events) VALUES(?, 1) ON CONFLICT(day) DO UPDATE SET events = events + 1', [
    todayKey(),
  ]);
}

export function loadStudyDays(db: AppDatabase): Array<{ day: string; events: number }> {
  return db.all('SELECT day, events FROM study_day ORDER BY day').map((r) => ({
    day: String(r.day),
    events: Number(r.events),
  }));
}

/* ============ 笔记与收藏 ============ */

export type TargetType = 'chapter' | 'exercise' | 'problem' | 'knowledge';

export function loadNotes(db: AppDatabase): Record<string, string> {
  const rows = db.all('SELECT targetType, targetId, content FROM note');
  const out: Record<string, string> = {};
  for (const r of rows) out[`${r.targetType}:${r.targetId}`] = String(r.content);
  return out;
}

export function saveNote(db: AppDatabase, targetType: TargetType, targetId: string, content: string): void {
  db.run(
    `INSERT INTO note(targetType, targetId, content, updatedAt) VALUES(?, ?, ?, ?)
     ON CONFLICT(targetType, targetId) DO UPDATE SET content = excluded.content, updatedAt = excluded.updatedAt`,
    [targetType, targetId, content, Date.now()],
  );
  bumpStudyDay(db);
}

export function deleteNote(db: AppDatabase, targetType: TargetType, targetId: string): void {
  db.run('DELETE FROM note WHERE targetType = ? AND targetId = ?', [targetType, targetId]);
}

export interface FavoriteRow {
  targetType: TargetType;
  targetId: string;
  createdAt: number;
}

export function loadFavorites(db: AppDatabase): FavoriteRow[] {
  return db.all('SELECT targetType, targetId, createdAt FROM favorite').map((r) => ({
    targetType: r.targetType as TargetType,
    targetId: String(r.targetId),
    createdAt: Number(r.createdAt),
  }));
}

export function toggleFavorite(db: AppDatabase, targetType: TargetType, targetId: string): boolean {
  const existing = db.all('SELECT 1 FROM favorite WHERE targetType = ? AND targetId = ?', [targetType, targetId]);
  if (existing.length > 0) {
    db.run('DELETE FROM favorite WHERE targetType = ? AND targetId = ?', [targetType, targetId]);
    return false;
  }
  db.run('INSERT INTO favorite(targetType, targetId, createdAt) VALUES(?, ?, ?)', [targetType, targetId, Date.now()]);
  return true;
}

/* ============ 设置 ============ */

export function loadSettings(db: AppDatabase): Record<string, string> {
  const rows = db.all('SELECT key, value FROM settings');
  const out: Record<string, string> = {};
  for (const r of rows) out[String(r.key)] = String(r.value);
  return out;
}

export function saveSetting(db: AppDatabase, key: string, value: string): void {
  db.run('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
    key,
    value,
  ]);
}

/* ============ 编程提交（P11 使用，先建好） ============ */

export interface SubmissionRow {
  id: number;
  problemId: string;
  status: string;
  detail: string | null;
  code: string;
  createdAt: number;
}

export function saveSubmission(db: AppDatabase, problemId: string, status: string, code: string, detail?: string): void {
  db.run('INSERT INTO submission(problemId, status, detail, code, createdAt) VALUES(?, ?, ?, ?, ?)', [
    problemId,
    status,
    detail ?? null,
    code,
    Date.now(),
  ]);
  db.run(
    `INSERT INTO coding_progress(problemId, acceptedAt, attempts, lastCode) VALUES(?, ?, 1, ?)
     ON CONFLICT(problemId) DO UPDATE SET
       acceptedAt = CASE WHEN ? = 'accepted' THEN ? ELSE acceptedAt END,
       attempts = attempts + 1, lastCode = excluded.lastCode`,
    [problemId, status === 'accepted' ? Date.now() : null, code, status, Date.now()],
  );
}

export function loadCodingProgress(db: AppDatabase): Array<{ problemId: string; acceptedAt: number | null; attempts: number; lastCode: string | null }> {
  return db.all('SELECT problemId, acceptedAt, attempts, lastCode FROM coding_progress').map((r) => ({
    problemId: String(r.problemId),
    acceptedAt: r.acceptedAt === null || r.acceptedAt === undefined ? null : Number(r.acceptedAt),
    attempts: Number(r.attempts),
    lastCode: r.lastCode === null || r.lastCode === undefined ? null : (r.lastCode as string),
  }));
}

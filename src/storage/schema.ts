/**
 * Schema 与 migrations（DATA_SPEC §2/§3）。MIGRATIONS[v] 把库从 v 升到 v+1。
 */
import type { AppDatabase } from './db';

type MigrationFn = (db: AppDatabase) => void;

/** v0 → v1：初始建表 */
const v1: MigrationFn = (db): void => {
  db.run(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS chapter_progress (
    chapter INTEGER PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'new',
    lastVisitAt INTEGER NOT NULL,
    visitCount INTEGER NOT NULL DEFAULT 0,
    maxSectionIndex INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS mastery (
    knowledgePoint TEXT PRIMARY KEY,
    level TEXT NOT NULL DEFAULT 'unlearned',
    updatedAt INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS attempt (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exerciseId TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    correct INTEGER NOT NULL,
    userAnswer TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS wrong_book (
    exerciseId TEXT PRIMARY KEY,
    errorCategory TEXT NOT NULL,
    wrongCount INTEGER NOT NULL DEFAULT 1,
    lastWrongAt INTEGER NOT NULL,
    mastered INTEGER NOT NULL DEFAULT 0,
    masteredAt INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS submission (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problemId TEXT NOT NULL,
    status TEXT NOT NULL,
    detail TEXT,
    code TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS coding_progress (
    problemId TEXT PRIMARY KEY,
    acceptedAt INTEGER,
    attempts INTEGER NOT NULL DEFAULT 0,
    lastCode TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS note (
    targetType TEXT NOT NULL,
    targetId TEXT NOT NULL,
    content TEXT NOT NULL,
    updatedAt INTEGER NOT NULL,
    PRIMARY KEY (targetType, targetId)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS favorite (
    targetType TEXT NOT NULL,
    targetId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    PRIMARY KEY (targetType, targetId)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS study_day (
    day TEXT PRIMARY KEY,
    events INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  db.run(`INSERT OR IGNORE INTO meta(key, value) VALUES('schema_version', '1')`);
};

/** 顺序执行；MIGRATIONS[0] 把空库升到 v1 */
export const MIGRATIONS: MigrationFn[] = [v1];

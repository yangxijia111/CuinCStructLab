/**
 * 数据导入（P14 P1-5）：JSON 备份的解析、schema/版本校验、预览与事务导入。
 *
 * 安全原则（禁止信任导入内容）：
 *   - validateImportPayload：损坏 JSON / 未来版本 / 未知表 / 缺字段 / 类型错误 全部拒绝；
 *   - importData：单事务 清空→重灌，任何错误回滚，不破坏现有数据库；
 *   - UI 层在导入前自动生成当前库的 JSON 备份。
 */
import type { AppDatabase } from './db';

/** 当前导出格式版本（exportJson 产生） */
export const IMPORT_SCHEMA_VERSION = 1;

/** 导入大小上限（32MB，学习库远小于此） */
export const MAX_IMPORT_BYTES = 32 * 1024 * 1024;

interface TableSpec {
  columns: Record<string, 'string' | 'number' | 'nullable-number' | 'nullable-string'>;
}

/** 与 schema.ts v1 对应的全部表结构（导入白名单） */
const TABLE_SPECS: Record<string, TableSpec> = {
  meta: { columns: { key: 'string', value: 'string' } },
  chapter_progress: {
    columns: { chapter: 'number', status: 'string', lastVisitAt: 'number', visitCount: 'number', maxSectionIndex: 'number' },
  },
  mastery: { columns: { knowledgePoint: 'string', level: 'string', updatedAt: 'number' } },
  attempt: {
    columns: { id: 'number', exerciseId: 'string', chapter: 'number', correct: 'number', userAnswer: 'string', createdAt: 'number' },
  },
  wrong_book: {
    columns: { exerciseId: 'string', errorCategory: 'string', wrongCount: 'number', lastWrongAt: 'number', mastered: 'number', masteredAt: 'nullable-number' },
  },
  submission: {
    columns: { id: 'number', problemId: 'string', status: 'string', detail: 'nullable-string', code: 'string', createdAt: 'number' },
  },
  coding_progress: {
    columns: { problemId: 'string', acceptedAt: 'nullable-number', attempts: 'number', lastCode: 'nullable-string' },
  },
  note: { columns: { targetType: 'string', targetId: 'string', content: 'string', updatedAt: 'number' } },
  favorite: { columns: { targetType: 'string', targetId: 'string', createdAt: 'number' } },
  study_day: { columns: { day: 'string', events: 'number' } },
  settings: { columns: { key: 'string', value: 'string' } },
};

/** chapter_progress.status 的合法值 */
const CHAPTER_STATUSES = new Set(['new', 'learning', 'done']);
/** mastery.level 的合法值 */
const MASTERY_LEVELS = new Set(['unlearned', 'learning', 'weak', 'basic', 'mastered']);

export interface ImportData {
  schemaVersion: number;
  exportedAt: string;
  /** 表名 → 行（已通过校验，字段与类型符合白名单） */
  tables: Record<string, Array<Record<string, string | number | null>>>;
}

export type ImportValidation =
  | { ok: true; data: ImportData; preview: ImportPreview }
  | { ok: false; errors: string[] };

export interface ImportPreview {
  schemaVersion: number;
  exportedAt: string;
  /** 各表行数（仅列出非空表） */
  counts: Array<{ table: string; rows: number }>;
  totalRows: number;
}

/** 校验导入 JSON 文本；返回结构化数据或全部错误（不触碰数据库） */
export function validateImportPayload(text: string): ImportValidation {
  const errors: string[] = [];
  if (text.length > MAX_IMPORT_BYTES) {
    return { ok: false, errors: [`文件超过大小上限（${MAX_IMPORT_BYTES} 字节）`] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, errors: [`损坏的 JSON：${err instanceof Error ? err.message : String(err)}`] };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, errors: ['导入内容必须是 JSON 对象'] };
  }
  const obj = parsed as Record<string, unknown>;

  const schemaVersion = obj.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)) {
    errors.push('schemaVersion 必须是整数');
  } else if (schemaVersion > IMPORT_SCHEMA_VERSION) {
    errors.push(`导入文件版本（${schemaVersion}）高于当前应用支持的版本（${IMPORT_SCHEMA_VERSION}），请先升级应用`);
  } else if (schemaVersion < 1) {
    errors.push(`schemaVersion 非法（${schemaVersion}）`);
  }
  const exportedAt = obj.exportedAt;
  if (exportedAt !== undefined && exportedAt !== null && typeof exportedAt !== 'string') {
    errors.push('exportedAt 必须是字符串');
  }

  const tables: ImportData['tables'] = {};
  for (const [table, spec] of Object.entries(TABLE_SPECS)) {
    const rows = obj[table];
    if (rows === undefined) continue; // 缺表允许（早期备份可能没有新表）
    if (!Array.isArray(rows)) {
      errors.push(`表 ${table} 必须是数组`);
      continue;
    }
    const validRows: Array<Record<string, string | number | null>> = [];
    rows.forEach((row, i) => {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) {
        errors.push(`表 ${table} 第 ${i + 1} 行必须是对象`);
        return;
      }
      const rec = row as Record<string, unknown>;
      const out: Record<string, string | number | null> = {};
      let rowOk = true;
      for (const [col, type] of Object.entries(spec.columns)) {
        const v = rec[col];
        if (type === 'string') {
          if (typeof v !== 'string') {
            errors.push(`表 ${table} 第 ${i + 1} 行字段 ${col} 必须是字符串`);
            rowOk = false;
            break;
          }
          out[col] = v;
        } else if (type === 'number') {
          if (typeof v !== 'number' || !Number.isFinite(v)) {
            errors.push(`表 ${table} 第 ${i + 1} 行字段 ${col} 必须是数字`);
            rowOk = false;
            break;
          }
          out[col] = v;
        } else if (type === 'nullable-string') {
          if (v === null || v === undefined) {
            out[col] = null;
          } else if (typeof v === 'string') {
            out[col] = v;
          } else {
            errors.push(`表 ${table} 第 ${i + 1} 行字段 ${col} 必须是字符串或 null`);
            rowOk = false;
            break;
          }
        } else {
          // nullable-number
          if (v === null || v === undefined) {
            out[col] = null;
          } else if (typeof v === 'number' && Number.isFinite(v)) {
            out[col] = v;
          } else {
            errors.push(`表 ${table} 第 ${i + 1} 行字段 ${col} 必须是数字或 null`);
            rowOk = false;
            break;
          }
        }
      }
      if (!rowOk) return;
      // 枚举约束
      if (table === 'chapter_progress' && !CHAPTER_STATUSES.has(String(out.status))) {
        errors.push(`表 chapter_progress 第 ${i + 1} 行 status 非法：${String(out.status)}`);
        return;
      }
      if (table === 'mastery' && !MASTERY_LEVELS.has(String(out.level))) {
        errors.push(`表 mastery 第 ${i + 1} 行 level 非法：${String(out.level)}`);
        return;
      }
      validRows.push(out);
    });
    tables[table] = validRows;
  }

  // 未知的额外顶层表：提醒但不拒绝（向前兼容由 schemaVersion 把关）
  for (const key of Object.keys(obj)) {
    if (key === 'schemaVersion' || key === 'exportedAt') continue;
    if (!TABLE_SPECS[key]) errors.push(`未知的表：${key}（可能来自更新版本的导出）`);
  }

  if (errors.length > 0) return { ok: false, errors };
  const data: ImportData = { schemaVersion: schemaVersion as number, exportedAt: typeof exportedAt === 'string' ? exportedAt : '', tables };
  const counts = Object.entries(data.tables)
    .filter(([, rows]) => rows.length > 0)
    .map(([table, rows]) => ({ table, rows: rows.length }));
  const preview: ImportPreview = {
    schemaVersion: data.schemaVersion,
    exportedAt: data.exportedAt,
    counts,
    totalRows: counts.reduce((a, b) => a + b.rows, 0),
  };
  return { ok: true, data, preview };
}

/** 事务导入：清空全部表后重灌；任何错误回滚，不破坏现有数据库 */
export function importData(db: AppDatabase, data: ImportData): void {
  const allTables = Object.keys(TABLE_SPECS);
  db.transaction(() => {
    for (const t of allTables) {
      db.run(`DELETE FROM ${t}`);
    }
    for (const [table, rows] of Object.entries(data.tables)) {
      const cols = Object.keys(TABLE_SPECS[table]!.columns);
      const placeholders = cols.map(() => '?').join(', ');
      for (const row of rows) {
        db.run(`INSERT OR REPLACE INTO ${table}(${cols.join(', ')}) VALUES(${placeholders})`, cols.map((c) => row[c] ?? null));
      }
    }
    // 导入后 schema_version 与当前版本对齐（避免旧备份把版本拉低）
    db.run(`INSERT INTO meta(key, value) VALUES('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [
      String(Math.max(IMPORT_SCHEMA_VERSION, db.version)),
    ]);
  });
}

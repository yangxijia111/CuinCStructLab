# DATA_SPEC.md — 数据与存储规格

## 1. 存储选型

SQLite（经 **sql.js** WASM 实现，见 ARCHITECTURE.md §1.3）。单一数据库，schema 版本化管理。
持久化后端（`PersistenceBackend` 接口）：

| 环境 | 实现 | 位置 |
| --- | --- | --- |
| Electron | 主进程写文件（防抖 500ms） | `app.getPath('userData')/cuincstructlab.db` |
| 浏览器 | IndexedDB 存数据库字节 | 库 `cclab`，key `sqlite-db` |

另提供全量 JSON 导出/导入（设置页），作为备份兜底。

## 2. Schema（版本 1）

```sql
-- 元数据
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- 章节学习进度
CREATE TABLE chapter_progress (
  chapter INTEGER PRIMARY KEY,          -- 0..13
  status TEXT NOT NULL DEFAULT 'new',   -- new | learning | done
  lastVisitAt INTEGER NOT NULL,         -- epoch ms
  visitCount INTEGER NOT NULL DEFAULT 0,
  maxSectionIndex INTEGER NOT NULL DEFAULT 0   -- 最深到达的教学小节
);
-- 知识点掌握
CREATE TABLE mastery (
  knowledgePoint TEXT PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'unlearned', -- unlearned|learning|weak|basic|mastered
  updatedAt INTEGER NOT NULL
);
-- 练习作答记录
CREATE TABLE attempt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exerciseId TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  correct INTEGER NOT NULL,             -- 0/1
  userAnswer TEXT NOT NULL,             -- JSON 序列化
  createdAt INTEGER NOT NULL
);
-- 错题本
CREATE TABLE wrong_book (
  exerciseId TEXT PRIMARY KEY,
  errorCategory TEXT NOT NULL,          -- concept|pointer|boundary|loop|memory|algorithm|complexity
  wrongCount INTEGER NOT NULL DEFAULT 1,
  lastWrongAt INTEGER NOT NULL,
  mastered INTEGER NOT NULL DEFAULT 0,  -- 标记掌握
  masteredAt INTEGER
);
-- 编程提交
CREATE TABLE submission (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problemId TEXT NOT NULL,
  status TEXT NOT NULL,                 -- accepted|wrong_answer|compile_error|runtime_error|tle
  detail TEXT,                          -- 失败用例摘要 JSON
  code TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);
-- 编程题完成状态
CREATE TABLE coding_progress (
  problemId TEXT PRIMARY KEY,
  acceptedAt INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  lastCode TEXT
);
-- 笔记
CREATE TABLE note (
  targetType TEXT NOT NULL,             -- chapter|exercise|problem|knowledge
  targetId TEXT NOT NULL,
  content TEXT NOT NULL,
  updatedAt INTEGER NOT NULL,
  PRIMARY KEY (targetType, targetId)
);
-- 收藏
CREATE TABLE favorite (
  targetType TEXT NOT NULL,             -- chapter|exercise|problem|knowledge
  targetId TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  PRIMARY KEY (targetType, targetId)
);
-- 学习日活（连续天数统计）
CREATE TABLE study_day (
  day TEXT PRIMARY KEY,                 -- 'YYYY-MM-DD'（本地时区）
  events INTEGER NOT NULL DEFAULT 0     -- 当日学习行为计数
);
-- 设置（少量非关键 UI 偏好可放 localStorage，但导出仍包含）
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

## 3. Migration

- `meta.schema_version` 记录当前版本；启动时顺序执行 `migrations[v]()`（v 从当前+1 到目标）。
- 全部 migration 在一个事务内执行；失败则回滚并报用户可见错误。
- v1 为初始建表。测试：从空库迁移到最新、从 v_n-1 模拟升级、重复执行幂等。

## 4. Repository 层（`src/storage/repos/`）

- `ChapterRepo / MasteryRepo / AttemptRepo / WrongBookRepo / SubmissionRepo / CodingRepo / NoteRepo / FavoriteRepo / StudyDayRepo / SettingsRepo`。
- 写操作统一走 `db.transaction()`，提交后触发防抖持久化与 `StudyDay.record()`。
- UI 只依赖 Repository 接口（便于测试用内存库替换）。

## 5. 掌握度规则（规则驱动，无 AI）

设某知识点近期（30 天）练习正确率 p，答题数 n：

| 条件 | level |
| --- | --- |
| 无任何学习行为 | unlearned |
| 有学习行为（读课/看动画）但 n=0 | learning |
| n ≥ 1 且 p < 50% | weak（待加强） |
| n < 3 或 50% ≤ p < 80% | basic（基本掌握） |
| n ≥ 3 且 p ≥ 80%，或错题已"标记掌握" | mastered（已掌握） |

课程阅读/动画播放上报为 learning 事件；答题/判题为统计事件。规则常量集中在 `storage/mastery-rules.ts`，单元测试覆盖边界。

## 6. 数据完整性

- 所有表带 NOT NULL/默认值；时间戳统一 epoch ms。
- 删除策略：错题"标记掌握"为软标记；无物理删除用户数据的操作（除设置页"清空数据"）。
- 启动自检：库损坏（sql.js 加载失败/JSON 导入校验失败）→ 错误 UI + 引导导出备份，不覆盖原文件。

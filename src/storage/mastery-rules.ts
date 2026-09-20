/**
 * 知识掌握度规则（DATA_SPEC §5，规则驱动，无 AI）。
 * 依据近期（30 天）答题正确率 p 与答题数 n：
 *   无学习行为 → unlearned；有行为无答题 → learning；
 *   n≥1 且 p<50% → weak；n<3 或 p<80% → basic；n≥3 且 p≥80%（或错题标记掌握）→ mastered
 */

export type MasteryLevel = 'unlearned' | 'learning' | 'weak' | 'basic' | 'mastered';

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  unlearned: '未学习',
  learning: '学习中',
  weak: '待加强',
  basic: '基本掌握',
  mastered: '已掌握',
};

/** 学习行为事件：读课/看动画 → learning；答题 → 统计 */
export interface MasteryInput {
  /** 近 30 天答题数 */
  attempts: number;
  /** 近 30 天答对数 */
  correct: number;
  /** 是否有学习行为（课程阅读/动画播放） */
  hasStudyActivity: boolean;
  /** 错题是否被手动标记掌握 */
  manuallyMastered: boolean;
}

export function computeMastery(input: MasteryInput): MasteryLevel {
  const { attempts, correct, hasStudyActivity, manuallyMastered } = input;
  if (manuallyMastered) return 'mastered';
  if (attempts === 0) return hasStudyActivity ? 'learning' : 'unlearned';
  const p = correct / attempts;
  if (p < 0.5) return 'weak';
  if (attempts < 3 || p < 0.8) return 'basic';
  return 'mastered';
}

/** 本地时区 YYYY-MM-DD */
export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 连续学习天数（含今天；从最近一天往前数连续） */
export function streakDays(days: Iterable<string>, today = todayKey()): number {
  const set = new Set(days);
  if (set.size === 0) return 0;
  // 从今天或昨天开始数（今天还没学不算断）
  const start = set.has(today) ? new Date(today) : new Date(dateAdd(today, -1));
  if (!set.has(today) && !set.has(dateAdd(today, -1))) return 0;
  let streak = 0;
  let cur = start;
  for (;;) {
    const key = todayKey(cur);
    if (!set.has(key)) break;
    streak += 1;
    cur = new Date(dateAdd(key, -1));
  }
  return streak;
}

function dateAdd(dateStr: string, delta: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + delta);
  return todayKey(d);
}

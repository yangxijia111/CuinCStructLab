/**
 * 练习系统类型与判分引擎（EXERCISE_SPEC.md）。
 * 题目数据只存放于 src/exercises/bank/（lint 边界约束），UI 不得内联题目。
 */

export type ExerciseType =
  | 'single' // 单选
  | 'multiple' // 多选
  | 'judge' // 判断
  | 'fill' // 填空
  | 'code-read' // 代码阅读
  | 'exec-result' // 执行结果
  | 'bug-find' // 找 Bug
  | 'code-complete'; // 代码补全

export type ErrorCategory =
  | 'concept'
  | 'pointer'
  | 'boundary'
  | 'loop'
  | 'memory'
  | 'algorithm'
  | 'complexity';

export const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  concept: '概念错误',
  pointer: '指针错误',
  boundary: '边界错误',
  loop: '循环错误',
  memory: '内存错误',
  algorithm: '算法理解错误',
  complexity: '复杂度错误',
};

export interface ExerciseOption {
  id: string; // 'A' | 'B' | ...
  text: string;
}

export type ExerciseAnswer =
  | { type: 'single'; value: string } // 选项 id
  | { type: 'multiple'; value: string[] } // 全对才得分
  | { type: 'judge'; value: boolean }
  | { type: 'text'; value: string[] } // 可接受答案（忽略首尾空白）
  | { type: 'blanks'; value: string[][] }; // 每空可接受答案数组

export interface Exercise {
  id: string; // 'ch03-q01'
  chapter: number; // 0..13
  knowledgePoint: string;
  difficulty: 1 | 2 | 3;
  type: ExerciseType;
  question: string; // 支持 ``` 代码块
  options?: ExerciseOption[];
  answer: ExerciseAnswer;
  explanation: string;
  tags: string[];
  /** 答错时归入的默认错因 */
  errorCategory: ErrorCategory;
}

/** 用户作答（与 answer 对应的形状） */
export type UserAnswer = string | string[] | boolean | null;

export interface JudgeResult {
  correct: boolean;
  /** 展示用的标准答案文本 */
  standardText: string;
}

const normalize = (s: string): string => s.replace(/\s+/g, '');

/** 判分（EXERCISE_SPEC §1） */
export function judge(exercise: Exercise, user: UserAnswer): JudgeResult {
  const { answer } = exercise;
  let correct = false;
  switch (answer.type) {
    case 'single':
      correct = typeof user === 'string' && user === answer.value;
      break;
    case 'multiple': {
      if (!Array.isArray(user)) break;
      const a = [...answer.value].sort();
      const u = [...user].sort();
      correct = a.length === u.length && a.every((v, i) => v === u[i]);
      break;
    }
    case 'judge':
      correct = typeof user === 'boolean' && user === answer.value;
      break;
    case 'text': {
      if (typeof user !== 'string') break;
      correct = answer.value.some((v) => normalize(v) === normalize(user));
      break;
    }
    case 'blanks': {
      if (!Array.isArray(user)) break;
      correct =
        user.length === answer.value.length &&
        answer.value.every((cands, i) => cands.some((c) => normalize(c) === normalize(user[i] ?? '')));
      break;
    }
  }
  return { correct, standardText: standardAnswerText(exercise) };
}

/** 标准答案展示文本 */
export function standardAnswerText(exercise: Exercise): string {
  const a = exercise.answer;
  switch (a.type) {
    case 'single': {
      const opt = exercise.options?.find((o) => o.id === a.value);
      return `${a.value}. ${opt?.text ?? ''}`;
    }
    case 'multiple': {
      return a.value
        .map((id) => {
          const opt = exercise.options?.find((o) => o.id === id);
          return `${id}. ${opt?.text ?? ''}`;
        })
        .join('；');
    }
    case 'judge':
      return a.value ? '正确（√）' : '错误（×）';
    case 'text':
      return a.value.join(' 或 ');
    case 'blanks':
      return a.value.map((c, i) => `第${i + 1}空：${c[0] ?? ''}`).join('；');
  }
}

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  single: '单选',
  multiple: '多选',
  judge: '判断',
  fill: '填空',
  'code-read': '代码阅读',
  'exec-result': '执行结果',
  'bug-find': '找 Bug',
  'code-complete': '代码补全',
};

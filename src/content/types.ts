/**
 * 课程内容数据模型：每章遵循统一 14 段教学结构（任务书第三节）。
 * 内容为结构化 TS 数据（ADR D8），含交互锚点（动画操作/测验/编程练习）。
 */

/** 14 段教学结构 */
export type SectionKind =
  | 'what' // 1 这是什么
  | 'why' // 2 为什么需要
  | 'analogy' // 3 现实世界类比
  | 'diagram' // 4 数据结构图示
  | 'struct' // 5 C 语言结构定义
  | 'operations' // 6 核心操作
  | 'code' // 7 逐行 C 代码
  | 'animation' // 8 动画演示
  | 'step' // 9 单步执行
  | 'time' // 10 时间复杂度
  | 'space' // 11 空间复杂度
  | 'pitfalls' // 12 常见错误
  | 'quiz' // 13 小测验
  | 'exercise'; // 14 编程练习

export const SECTION_KIND_TITLES: Record<SectionKind, string> = {
  what: '这是什么',
  why: '为什么需要它',
  analogy: '现实世界类比',
  diagram: '数据结构图示',
  struct: 'C 语言结构定义',
  operations: '核心操作',
  code: '逐行 C 代码',
  animation: '动画演示',
  step: '单步执行',
  time: '时间复杂度',
  space: '空间复杂度',
  pitfalls: '常见错误',
  quiz: '小测验',
  exercise: '编程练习',
};

/** 教学顺序（也是渲染顺序） */
export const SECTION_ORDER: SectionKind[] = [
  'what',
  'why',
  'analogy',
  'diagram',
  'struct',
  'operations',
  'code',
  'animation',
  'step',
  'time',
  'space',
  'pitfalls',
  'quiz',
  'exercise',
];

/** 可视化操作锚点：课程页据此打开对应动画 */
export interface VizOpSpec {
  /** 操作标识，由 visualization/ops 注册表解释 */
  op: string;
  /** 预置参数（如初始数据） */
  preset?: Record<string, unknown>;
  /** 按钮文字 */
  label: string;
}

export interface Section {
  kind: SectionKind;
  title: string;
  /** 正文段落（支持 \n 换行；以 ``` 包裹的段落渲染为代码块） */
  body?: string[];
  /** 要点列表 */
  bullets?: string[];
  /** 引用的 C 代码 id（chapters 内注册） */
  codeId?: string;
  /** 嵌入的可视化操作（animation/step 段） */
  vizOps?: VizOpSpec[];
  /** 表格（复杂度等） */
  table?: { headers: string[]; rows: string[][] };
  /** 关联练习题 id（quiz 段，P8 接题库） */
  quizIds?: string[];
  /** 关联编程题 id（exercise 段，P11 接编程题） */
  problemIds?: string[];
}

export interface Chapter {
  id: number;
  title: string;
  subtitle: string;
  /** 章节关键词（搜索用） */
  keywords: string[];
  sections: Section[];
}

/** 教学 C 代码注册表条目 */
export interface CProgramRef {
  id: string;
  title: string;
  lines: string[];
  /** 行级解释（行号从 1 开始） */
  notes?: Record<number, string>;
}

# EXERCISE_SPEC.md — 练习系统规格

## 1. 题型（8 种）

| type | 说明 | answer 结构 | 判分 |
| --- | --- | --- | --- |
| single | 单选 | 正确选项 id | 精确匹配 |
| multiple | 多选 | 正确选项 id 数组（全对才得分） | 集合相等 |
| judge | 判断 | true/false | 精确匹配 |
| fill | 填空 | 可接受答案数组（忽略首尾空白，大小写敏感除明确声明外） | 任一匹配 |
| code-read | 代码阅读（给代码问输出/结果） | 同 fill；也允许选择式（single + options） | 任一匹配 |
| exec-result | 执行结果（给代码问运行结果） | 同 fill | 任一匹配 |
| bug-find | 找 Bug（给含错代码选出错误行/原因） | 正确选项 id（或 fill） | 精确匹配 |
| code-complete | 代码补全（挖空） | 每空可接受答案数组，全空正确才得分 | 全部匹配 |

## 2. 题目 Schema（`src/exercises/bank/*.ts`，按章分文件）

```ts
interface Exercise {
  id: string;                 // 如 "ch03-q01"，全局唯一
  chapter: number;            // 0..13
  knowledgePoint: string;     // 如 "单链表-插入"
  difficulty: 1 | 2 | 3;      // 1 基础 2 进阶 3 挑战
  type: ExerciseType;
  question: string;           // 支持 \n 换行；代码题用 ``` 包裹的段落渲染为等宽块
  options?: ExerciseOption[]; // 选择类必有
  answer: ExerciseAnswer;     // 按题型
  explanation: string;        // 解析（答错必看，答对可看）
  tags: string[];             // 搜索用，如 ["指针","链表"]
  errorCategory?: ErrorCategory; // 答错时归入的默认错因（可被题目细分为覆盖）
}
```

- 题库只存放于 `src/exercises/bank/`，UI 组件不得内联题目（lint 约束）。
- 每章 ≥ 6 题；v1.0 总量 ≥ 84 题，覆盖全部 8 种题型。

## 3. 错误分类（ErrorCategory）

`concept 概念错误 | pointer 指针错误 | boundary 边界错误 | loop 循环错误 | memory 内存错误 | algorithm 算法理解错误 | complexity 复杂度错误`
编程题失败默认 `algorithm`，编译错误归 `memory`（含语法/内存类）之外的 `concept` 由题目 meta 指定。

## 4. 判分与记录

- 提交即判分：返回 `{ correct: boolean; userAnswer; standardAnswer }`。
- 记录 `AttemptRecord`：题目 id、时间戳、是否正确、用户答案（持久化）。
- 连续 2 次答对且近 7 天有答对 → 错题可"标记掌握"（自动建议 + 手动确认）。

## 5. 答题 UI 约定

- 单选/判断：点选即选中，"提交"按钮判分；判分后锁定并展示解析。
- 多选：复选；未选全提交视为错。
- 填空/代码阅读/执行结果/补全：文本输入（等宽字体，支持多行）。
- "重做本题"：清空作答重新开始（历史记录保留）。

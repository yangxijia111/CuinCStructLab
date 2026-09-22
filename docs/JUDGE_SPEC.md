# JUDGE_SPEC.md — 判题规格

## 1. 判题状态

| 状态 | 判定条件 |
| --- | --- |
| `Accepted` | 全部测试用例输出与期望一致（规范化比对后） |
| `Wrong Answer` | 任一用例不一致（展示 输入/Expected/Actual，首个失败用例） |
| `Compile Error` | 编译器非零退出（stderr 全量截断至 8KB 展示） |
| `Runtime Error` | 程序非零退出（区分信号/退出码，Windows 下 exit code ≠ 0 且非超时） |
| `Time Limit Exceeded` | 超过用例时限（默认 5s/用例，题目可覆盖） |

## 2. 输出比对规范化（严格且可解释）

按序执行，任一环节不一致即 WA：

1. 统一换行：CRLF → LF（`\r\n` → `\n`，单个 `\r` 亦按换行处理）。
2. 去除**每行行尾空白**（trailing spaces/tabs）。
3. 去除**末尾多余换行**：比较时忽略串尾所有 `\n`（即两侧 trim 尾部 `\n` 后相等即通过）。
4. 其余字符**逐字符严格比较**（含中间空行、行内空格、大小写、负号等）。

示例：`"5\n"` 与 `"5"`、`"5 \n"` 均视为相等；`"5\n\n"`（中间多空行后接内容）不等价于 `"5\n"`。

### 2.1 二分查找题（p-binary-search）的重复值语义

题目判定以输出比对为准；参考实现命中即返回，重复值场景输出**某个**匹配下标（any-match），
测试用例不构造"重复值且期望特定下标"的歧义场景（P15 裁决，与 DATA_STRUCTURE_SPEC §9 一致）。

## 3. 编程题定义（`src/coding/problems/*.ts`）

```ts
interface CodingProblem {
  id: string;                // 如 "p-seqlist-insert"
  title: string;
  chapter: number;
  difficulty: 1|2|3;
  statement: string;         // 题面（含数据范围/约定）
  signature: string;         // 函数签名（用户实现），如 "int seqListInsert(SeqList *L, int pos, int value);"
  template: string;          // 初始代码（含结构体定义与签名骨架）
  testCases: { stdin: string; expected: string; explanation?: string }[];
  timeLimitMs?: number;      // 默认 5000
  referenceSolution: string; // 参考答案（"查看参考"用，也用于自测判题器）
  tags: string[];
}
```

判题方式：用户代码 + 平台提供的 `runner_main.c`（读取约定输入、调用用户函数、打印输出）联合编译 → 逐用例运行 → 比对。runner_main 由平台内置，按题目 `harness` 字段选择生成。

## 4. Runner 安全边界（详见 SECURITY.md）

- 编译器与被测程序一律 `spawn(cmd, args[])`，**绝不拼接 shell 字符串**；文件名使用固定白名单（`main.c`/`program.exe`），用户输入只进入文件内容与 stdin。
- 每次判题独立临时目录（`os.tmpdir()/cclab-<uuid>/`），结束（无论成败）递归删除。
- 编译超时 15s；单用例运行超时（默认 5s）后 Windows `taskkill /PID <pid> /T /F` 终止进程树。
- stdout/stderr 各限 1MB，超出截断并标注。
- Runner 不可用（未探测到编译器）→ 前端显示安装指引（Windows: MinGW-w64/MSYS2、macOS: xcode-select --install、Linux: apt install gcc），不崩溃、不阻塞其他功能。

## 5. 判题结果持久化

`SubmissionRecord`：题目 id、时间、状态、失败用例摘要、代码全文。供错题本（编程失败题）与"我的提交"查看。

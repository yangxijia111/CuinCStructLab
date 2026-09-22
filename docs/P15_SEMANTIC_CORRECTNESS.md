# P15 — Semantic Correctness & Runner Reliability 设计文档

> 版本：v1.0（2026-09-22）
> 范围：教学 C ↔ TS Core 语义级差分验证、Compiler Adapter 架构、Runner 可靠性、跨平台 CI、E2E。
> 配套规格：[COMPILER_ADAPTER_SPEC.md](./COMPILER_ADAPTER_SPEC.md)、[DIFFERENTIAL_TEST_SPEC.md](./DIFFERENTIAL_TEST_SPEC.md)。

## 1. 当前架构审计（2026-09-22，基线 v1.0.1）

### 1.1 总体结构

| 层 | 位置 | 职责 |
|---|---|---|
| 渲染层 | `src/pages` `src/ui` `src/visualization` | React 19 页面、可视化回放 |
| 核心（纯函数） | `src/core/**` | 数据结构/算法的 TS 实现 + StepRecorder 步骤生成 + 教学 C 代码常量 |
| 判题 | `src/judge` | AC/WA/CE/RE/TLE 状态机（纯函数） |
| Runner 桥 | `src/runner/runner.ts` | 类型 + Electron IPC 桥 + Node 实现注册钩子 |
| Runner 唯一实现 | `electron/runner-core.cjs` | spawn 编译/运行、超时杀树、限幅、临时目录清理 |
| 桌面壳 | `electron/main.cjs` `protocol.cjs` `preload.cjs` | 窗口、app:// 协议、SQLite 文件桥、IPC 转发 |
| 存储 | `src/storage/**` | sql.js + IndexedDB 双后端 |

### 1.2 教学 C 代码来源

每个 core 模块导出 `XXX_C_CODE: string[]`（按行组织的完整函数集）：

- `SEQ_LIST_C_CODE` / `LINKED_LIST_C_CODE` / `DOUBLY_LIST_C_CODE` / `STACK_C_CODE` / `QUEUE_C_CODE` / `BST_C_CODE` / `HEAP_C_CODE` / `GRAPH_C_CODE` / `TREE_C_CODE`（数据结构）
- `SORT_C_CODES`（7 种排序）/ `SEARCH_C_CODE`（顺序 + 二分查找）

这些代码是**完整可编译的函数定义**（含 `#include`、typedef、函数体），但**从未被真实编译执行过**。P14 仅验证了 `src/coding/problems.ts` 的 10 道 CodingProblem referenceSolution。

### 1.3 TS Core 数据结构/算法来源

同模块内的步骤生成函数（如 `seqListInsert(state, pos, value): VizOutcome<ArrayState>`）。每个操作以快照方式生成教学步骤，终态 = 最后一步的 `afterState`。语义提取函数（`seqListValues` / `listValues` / `cqValues` / `bstInorder` / `heapValues` 等）已有，可直接作为差分比较的 TS 侧语义投影。

### 1.4 codeLine 映射方式

`buildLineMap(code, markers)`（`src/core/utils/code-lines.ts`）按"文本片段首次出现行"建立关键行号表；步骤记录时引用 `L.xxx`。`tests/audit-lines.test.ts` 验证所有 `step.codeLine` 落在对应 C 代码的合法行。已知瑕疵：`linked-list.ts` 有 9 处硬编码行号（69/74/80/81/85/96/100/101/125）绕过了行号表——audit 测试兜底但属于技术债，P15 不强制重构（与语义正确性正交）。

### 1.5 Runner 架构（现状）

`electron/runner-core.cjs`（唯一实现）：

- `execSafe(cmd, args, {cwd, timeoutMs, stdin})`：数组 argv、超时 `killTree`（Windows `taskkill /T /F`；POSIX 仅 `proc.kill('SIGKILL')` 杀父进程）、输出限幅（`if (stdout.length < MAX_OUTPUT) stdout += chunk`）、`performance.now` 计时。
- `detectCompiler(customPath)`：customPath 统一执行 `--version`；PATH 探测按 gcc → clang → cl 顺序 `tryExec`（cl 无参数运行）。
- `compileAndRun(...)`：临时目录 → 写 main.c → 编译 → 逐 case 运行 → cleanup（try/catch 包裹，异常路径也清理）。

### 1.6 Compiler Detection 逻辑（现状与缺陷）

| # | 缺陷 | 位置 | 影响 |
|---|---|---|---|
| D1 | customPath 对所有编译器统一 `--version`，`cl.exe` 不支持该参数（退出码非 0 / 打印用法），探测必然失败 | `runner-core.cjs` `detectCompiler` | MSVC 自定义路径不可用 |
| D2 | customPath 探测只验证"进程能启动"，不验证版本输出签名 | 同上 | 任意可执行文件（如 `notepad.exe`）可被误判为 gcc |
| D3 | `tryExec` 只收集 stdout；MSVC 版本 banner 输出在 stderr | `tryExec` | cl 探测成功时 version 恒为空/错误 |
| D4 | PATH 中 cl 探测成功即认为可用，不检查 INCLUDE/LIB 环境（Developer Command Prompt 未初始化时 cl 无法编译） | `detectCompiler` | 误报"可用"，用户判题时才失败 |
| D5 | `guessKind` 按路径名子串猜测（路径含 "clang" 即 clang），可被路径命名欺骗 | `guessKind` | 编译参数选错（cl 参数传给 gcc） |

### 1.7 当前 CI 编译器覆盖

- `verify`：ubuntu node 22/24 + windows node 22（lint/typecheck/test/coverage/build + Electron smoke）
- `gcc-runner`：ubuntu + gcc（10 道 referenceSolution 全 AC + WA/CE/RE/TLE/洪泛/Unicode/清理）
- `package`：**仅 `needs: verify`**（编译器测试失败不阻断打包）
- 缺失：clang、MSVC、差分、E2E。

### 1.8 当前缺陷与风险清单（P15 修复对象）

| # | 缺陷/风险 | 严重度 | 章节 |
|---|---|---|---|
| R1 | 教学 C 代码与 TS Core 语义一致性**零验证**（产品核心承诺无测试保障） | 高 | §三 |
| R2 | `execSafe` 限幅：单个 chunk 可使最终输出超过 `MAX_OUTPUT`（`if (len < MAX) += chunk` 无 slice） | 高 | §二十一 |
| R3 | spawn error 时 `code=null`，judge 仅在 `exitCode !== null && !== 0` 判 RE；`expected=''` 且输出为空时可误判 AC | 高 | §二十 |
| R4 | POSIX 无进程组：用户 C 程序 fork 的子进程在超时杀父后存活 | 高 | §二十三 |
| R5 | `app://` 用 `resolved.startsWith(DIST_ROOT)` 判界：兄弟目录 `dist-evil` 前缀匹配可通过 | 高 | §二十六 |
| R6 | customPath/MSVC 探测缺陷 D1–D5 | 高 | §十–十四 |
| R7 | package job 不依赖编译器测试 | 中 | §二十七 |
| R8 | README 声明 Node ≥20，实际 jsdom 30 要求 ≥22.22 | 中 | §二十八 |
| R9 | 无 E2E：关键学习流程（课程进度/实验室/判题/导入导出）无真实用户路径验证 | 中 | §二十四 |
| R10 | StepRecorder 快照引擎复杂度未量化（大数组排序可能内存/GC 风险） | 待审计 | §二十九 |

## 2. P15 目标架构

```
┌─ 渲染层（不变） ─────────────────────────────────────────────┐
│ pages / visualization / storage                               │
└──────────────┬───────────────────────────────────────────────┘
               │ ipc（preload 桥，不变）
┌──────────────▼───────────────────────────────────────────────┐
│ Electron 主进程                                                │
│  main.cjs ──► runner-core.cjs ──► compiler-adapters.cjs  ★新  │
│  protocol.cjs（resolveAppPath 抽出为纯函数，可单测）★改        │
└──────────────┬───────────────────────────────────────────────┘
               │ require（单一实现原则，不变）
┌──────────────▼───────────────────────────────────────────────┐
│ src/core/**（不变）     src/differential/** ★新（纯 TS，无 Node 依赖）│
│  XXX_C_CODE ────────► c-cases（差分用例 + C harness 生成）      │
│  操作函数 ──────────► ts-executor（执行操作序列 → SemanticState）│
└───────────────────────────────────────────────────────────────┘
               │ vitest（tests/differential/**，Node 环境）
┌──────────────▼───────────────────────────────────────────────┐
│ 差分执行器（tests 侧）：                                        │
│  OperationSequence → TS Executor ──► SemanticState ─┐          │
│  OperationSequence → C Harness Gen → gcc/clang/cl   │ compare   │
│                       → 运行 → 解析 STATE 行 ────────┘          │
└───────────────────────────────────────────────────────────────┘
```

要点：

1. **差分框架的纯逻辑（用例生成、C 代码生成、语义投影）放 `src/differential/`**，被 typecheck/lint 覆盖，不依赖 Node API（不进浏览器 bundle：无页面 import 它）。C 程序的编译执行器是 Node 专属，放 `src/differential/node/`，仅被测试引用。
2. **CompilerAdapter 收敛所有编译器差异**：`runner-core` 不再包含 `buildCompileArgs`/探测分支，委托 `compiler-adapters.cjs`。
3. **ProcessOutcome 平台无关抽象**：judge 不直接消费 Node close 事件原始字段。

## 3. 分阶段实施计划

| 阶段 | 内容 | 产出 | 依赖 |
|---|---|---|---|
| P15-A | 设计文档（本文档 + 两份 SPEC）并 Review | docs 三份 | — |
| P15-B | 差分框架核心：类型、seeded RNG、C Harness Generator、TS Executor、语义投影、C 执行器 | `src/differential/**` | A |
| P15-C | 8 类数据结构 + 7 排序 + 二分查找差分用例（定向 + 随机 property） | `tests/differential/*.test.ts` | B |
| P15-D | Compiler Adapter（GCC/Clang/MSVC）+ customPath 修复 + mock 测试 | `electron/compiler-adapters.cjs`、`tests/compiler-adapters/` | — |
| P15-E | Runner 修复：严格限幅、ProcessOutcome、spawnError 分类、cleanup finally、POSIX 进程组 | runner-core 改造 + 失败测试先行 | D |
| P15-F | app:// 路径边界修复（path.relative 方案）+ 穿越测试 | protocol.cjs + tests | — |
| P15-G | CI matrix：differential-gcc / differential-clang / msvc-runner / e2e + package 依赖修正 | ci.yml | C/D/E |
| P15-H | Playwright Electron E2E 6 场景 | `tests/e2e/` + script | — |
| P15-I | Node engines + README 同步 | package.json / README | — |
| P15-J | Snapshot Engine 审计 + benchmark（n=16..256） | `docs/SNAPSHOT_ENGINE_AUDIT.md` | — |
| P15-K | 全量验证、最终报告、v1.1.0 发布 | P15_FINAL_REPORT.md | 全部 |

每阶段：发现 Bug → 先写失败测试 → 修复 → 通过 → 记录。禁止 skip/only/降低断言。

## 4. 验收标准

1. `tests/differential/` 覆盖顺序表、单链表、双向链表、顺序栈、循环队列、BST、Heap（max/min）、Graph DFS/BFS、7 种排序、二分查找；每排序 ≥100 组固定 seed 随机输入；链表/队列/BST/Heap 各 ≥100 轮随机操作序列。
2. GCC 真编译差分全绿（CI ubuntu）；Clang 真编译差分全绿且判题结果与 GCC 一致；MSVC（CI windows + msvc-dev-cmd）真 cl 全部 CodingProblem AC + 差分通过（或逐项记录 BLOCKED 原因）。
3. CompilerAdapter 架构落地：`detect/getVersion/buildCompileArgs/normalizeDiagnostics/classifyExit/supports/getEnvironmentInfo`；customPath 逐 adapter probe + 版本签名验证；任意 exe 不再被误判。
4. Runner：输出恒 ≤ `MAX_OUTPUT + 截断提示固定长度`（字节级 slice）；SIGSEGV/SIGABRT/Access Violation/异常退出/spawn error 均不可能 AC；全失败分支 cleanup；POSIX 进程组终止经真实孙进程测试验证。
5. app:// 拒绝 `../`、`%2e%2e`、嵌套穿越、`dist-evil` 前缀、绝对路径逃逸。
6. E2E 6 场景（启动/课程进度持久化/实验室回放/判题 AC/WA/导入导出）通过（判题场景在有编译器的环境）。
7. `npm ci && npm run lint && npm run typecheck && npm run test && npm run coverage && npm run build` + Electron smoke + 差分（GCC/Clang）+ MSVC + E2E + Windows package 全绿。
8. README Node 版本与 `package.json engines` 一致且符合真实依赖（≥22.22）。
9. `docs/SNAPSHOT_ENGINE_AUDIT.md` 含 n=16/32/64/128/256 的 steps/time/serialized size/heap 实测数据与是否重构 Engine 的结论。

## 5. 回滚方案

- 每阶段独立 commit（`feat(diff):`/`feat(adapter):`/`fix(runner):`/`fix(protocol):`/`ci(p15):`…），任一阶段引入回归可 `git revert` 单阶段。
- `v1.0.1` tag 保留不动；v1.1.0 发布后若发现严重回归，revert 对应 commit 后发 v1.1.1，不覆盖任何已有 tag。
- CompilerAdapter/runner-core 改造保持导出接口（`detectCompiler`/`compileAndRun`/`validateRunnerPayload`/`buildCompileArgs` 签名不变或兼容包装），Electron IPC 协议不变，渲染层零改动即兼容。
- 差分框架是新增目录，回滚即删除，不影响运行时。
- CI workflow 修改保留旧 job 语义（gcc-runner 更名但职责延续），失败可单独禁用新 job 而不阻塞主验证。

## 6. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 教学 C 代码本身有 bug（差分发现真实缺陷） | 正是目标：SPEC 层面裁决 TS/C 谁对，更新 `DATA_STRUCTURE_SPEC`/`JUDGE_SPEC` 并记录原因 |
| MSVC 对 C99 语法/行为的兼容差异 | 编译参数 `/std:c11`；差分 C 代码避免 VLA/复杂 designated initializer；逐结构验证，不可行项记 BLOCKED |
| CI 时长膨胀（多编译器 × 差分） | 差分批量编译（每结构一个 C 文件含全部 case，编译一次）；clang job 复用差分套件 |
| Playwright 体积/下载 | 仅安装 `playwright` npm 包（`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`），用 Electron 自带 `_electron` API，不下载浏览器 |
| 本机无 gcc/cl，无法本地验证 C 侧 | 所有 C 侧真实验证推 CI；本地跑 TS 侧与 mock 测试；用 node 子进程验证 runner 行为 |

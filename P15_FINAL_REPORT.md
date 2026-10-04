# P15 Final Report — Semantic Correctness & Runner Reliability

> 完成：2026-09-22 · 基线 v1.0.1（6747719）→ 发布 **v1.1.0** · 全程 CI 驱动验证
> 设计文档：[P15_SEMANTIC_CORRECTNESS.md](docs/P15_SEMANTIC_CORRECTNESS.md) · [COMPILER_ADAPTER_SPEC.md](docs/COMPILER_ADAPTER_SPEC.md) · [DIFFERENTIAL_TEST_SPEC.md](docs/DIFFERENTIAL_TEST_SPEC.md)

## 1. 原始风险（P15 前的实证审计结论）

| # | 风险 | 审计证据 |
|---|---|---|
| R1 | 教学 C 代码与 TS Core 语义一致性零验证（产品核心承诺无保障） | 教学 C 常量（9 组 `XXX_C_CODE`）从未被编译执行过；P14 只验证过 coding problems |
| R2 | 输出限幅单 chunk 可超限 | `if (stdout.length < MAX) += chunk` 无 slice——8MB 单块实测超限 |
| R3 | **spawn error 可被误判 Accepted** | 失败测试实证：`exitCode:null + expected:'' + actual:''` → `accepted` |
| R4 | POSIX 进程树泄漏 | 只 `kill(pid)` 杀父进程，fork 的子进程存活 |
| R5 | app:// 前缀穿越 | `startsWith(DIST_ROOT)` 允许兄弟目录 `dist-evil`（失败测试证明） |
| R6 | customPath 探测缺陷 ×5 | 统一 `--version`（cl 不支持）；任意 exe 冒充；MSVC banner 在 stderr 但只读 stdout；cl 无 INCLUDE 误判可用；路径名猜 kind 可欺骗 |
| R7-R10 | package 依赖不足 / Node 版本声明错误 / 无 E2E / 快照引擎未量化 | ci.yml `needs: [verify]`；README ≥20 vs 实际 ≥22.22；selection n=256 单操作 JSON.stringify 超 V8 字符串上限 |

## 2. 实际发现并修复的 Bug（全部失败测试先行）

1. **judge 误判 Accepted**（R3，严重）：spawn error 场景实证误判——修复为 ProcessOutcome 分类（`spawn_error`/`signal`/`nonzero_exit` → RE，绝不进输出比对）。
2. **app:// 兄弟目录穿越**（R5，严重）：`%2e%2e/dist-evil/secret.txt` 在旧实现可读取 dist 外文件——`path.relative` 边界 + 13 个穿越用例。
3. **Windows 裸 LLVM clang 误报可用**（CI round 9 发现的真实产品缺陷）：`--version` 签名通过但任何 `#include` 都失败（无 MSVC 头）→ 用户判题全 CE。修复：win32 上 gcc/clang 探测追加最小编译探针（真实编译 `#include <stdio.h> main`）。
4. **输出限幅不严格**（R2）：字节级累加器（Buffer slice + 固定截断提示），最终输出恒 ≤ `MAX_OUTPUT + 提示长度`。
5. **差分框架开发期自发现 ×4**（CI 真编译轮次）：canonical 比较含 C 侧没有的 `kind` 字段；空池选取产生 `undefined` 注入 C 源码；排序/查找教学代码无 `#include`（clang/MSVC 拒绝隐式 printf 声明，gcc 容忍——**跨编译器差异被差分基础设施自身验证出来**）；graph 记录函数需前向声明。

## 3. C ↔ TS Differential 架构

```
DifferentialCase { structure, seed, initial, operations }
  → TS Executor（调用 src/core 步骤版真实实现）──→ SemanticState + observations
  → C Harness Generator（教学 C 代码 + 自动生成 main，STATE 行协议）
      → Compiler Adapter 编译执行 → parseCOutput ──→ SemanticState + observations
  → canonical JSON 深比较（排除地址/节点 id/kind）
```

- C 侧 = **项目自身教学 C 代码**（验证的正是产品展示的两套表述），非另写参考实现。
- 语义归一化：只比值序列/观察序列（`S:[…]`/`IN:[…]`/`ORDER:[…]`/`OBS:…`），min-heap 用"取负进 max-堆"对偶。
- 批量单编译（每结构一个 C 程序跑全部 case），固定 seed（mulberry32）CI 可复现。
- 失败报告携带 seed/initialState/operations/双方状态/firstDiff。

## 4. 覆盖的数据结构与规模（DIFFERENTIAL_TEST_SPEC §6）

顺序表、单链表（8 操作含越界/未找到失败语义）、双向链表（forward+backward，prev/next 一致性）、顺序栈（满/空）、循环队列（wrap-around/full/empty）、BST（删除覆盖 leaf/单孩子/双孩子/根，search 观察捕获结构差异）、Heap（max/min × insert/deleteTop/heapify + 堆性质校验）、Graph（DFS/BFS，邻接序固定=编号升序，随机 100 图 + 6 类定向拓扑）。

## 5. 随机差分测试数量

- 数据结构 × 8：各 **100 轮**（每轮随机初始 + 20~100 个操作）
- 排序 × 7：各 **100 组**（共 **700**；分布：空/单元素/已序/逆序/全重复/负数/随机/大重复率）
- 二分查找：**100 组**有序数组 × 6~9 个目标（首/末/随机存在/重复段/边界外/间隙），any-match 规范
- Graph 定向：链形/环形有向/非连通+孤立点/星形/有向不一致边/单点
- 全部固定 seed（20260922 系），同 seed 两轮 C 源码字节一致（可复现测试）

## 6-8. GCC / Clang / MSVC 结果（CI run 37175152710，全绿）

| Job | 结果 | 内容 |
|---|---|---|
| **GCC**（Ubuntu） | ✅ | 差分 12/12（含 8 结构 + 排序 700 + 二分 100 + 定向图 + 可复现性）；10 题 referenceSolution 全 AC；WA/CE/RE/TLE/洪泛/Unicode/清理 |
| **Clang**（Ubuntu） | ✅ | 同套差分全绿（跨编译器一致）；判题全绿；**GCC↔Clang 判题一致性**（AC/WA/CE/RE 四场景逐题一致） |
| **MSVC**（Windows + msvc-dev-cmd，真实 cl） | ✅ | 10 题 referenceSolution 全 AC（`/nologo /W4 /EHsc /std:c11 /Fe:`）；**全部差分套件在 cl 下通过** |
| E2E（Ubuntu + xvfb + gcc） | ✅ | 6/6 场景（含判题 Accepted / Wrong Answer 真实编译路径） |

## 9. Runner 修复清单

ProcessOutcome 平台无关抽象（exitCode/signal/timedOut/spawnError/durationMs + `classifyOutcome`）；崩溃分类（SIGSEGV/SIGABRT/Access Violation/异常退出/spawn error）绝不可能 AC；字节级限幅 + 固定截断提示；cleanup 全分支 finally 化；POSIX 进程组整树终止（detached + `kill(-pgid)`，孙进程心跳测试验证；Windows `taskkill /T /F`）。

## 10. app:// 路径安全修复

`startsWith(DIST_ROOT)` → `path.relative` 边界判定（`electron/app-path.cjs` 纯函数可单测）；拒绝 `../`、`%2e%2e`（含大小写变体）、嵌套穿越、`dist-evil` 前缀、绝对路径逃逸、NUL、非法编码；`protocol.cjs` 委托该函数。

## 11. E2E 测试结果（Playwright + Electron，真实 app:// 生产构建）

启动→首页 ✓；课程章节完成→**重启应用**→仍 done ✓；实验室单链表 10 20 30 → insertAt(1,15) → Next/Previous/Jump → 终态 10 15 20 30（含顺序断言）✓；referenceSolution 判题 **Accepted**（真实 gcc）✓；错误代码判题 **Wrong Answer** ✓；导出→清空→导入→数据恢复 ✓（`--user-data-dir` 隔离；Electron 锚点下载不出 playwright download 事件——改用页面内 blob 截获）。

## 12. Snapshot Engine Benchmark（docs/SNAPSHOT_ENGINE_AUDIT.md）

| 场景 | steps | 耗时 | serialized | heap 峰值 |
|---|---|---|---|---|
| bubble n=16→256 | 19→259 | 0.65→65.92ms | 0.03→4.78MB | 0.68→22.51MB |
| selection n=256 | 33,152 | 15,899ms | **653.29MB** | **872.98MB** |
| quick n=256 | 13,166 | 5,757ms | 279.99MB | 382.10MB |
| graph DFS/BFS 完全图 20 | ~412 | ~164ms | ~8MB | 12.6/61.5MB |

硬证据：selection n=256 整体 `JSON.stringify` **超出 V8 最大字符串长度**（RangeError 实测）。

## 13. 是否重构 Engine：**否（保持 Snapshot v1）**

教学 UI 硬上限 `slice(0, 40)` / 图 MAXN=20，实测全部 <1s、<100MB，且 Previous/Jump/Replay 依赖 O(1) 全量快照；v2（Checkpoint+Delta）触发条件已写入 Known Limitations（放开规模上限 / 用户可见 GC 卡顿 / 需导出完整步骤流）。

## 14. CI 结果

**8/8 job 全绿**（run 37175152710）：verify ×3（ubuntu node22/24 + windows node22）+ GCC 差分/判题 + Clang 差分/判题/一致性 + MSVC 判题/差分 + E2E + **Windows package**（NSIS + Portable 产物已生成）。package 现依赖全部关键编译器 job——编译器测试失败不再产出 Release 包。迭代 11 轮 CI（3 轮发现真实缺陷：undefined 注入/kind 字段/stdio 缺失/前向声明/裸 clang）。

## 15. 测试总数量

- 本地 `npm run test`：**404 passed + 25 skipped**（无编译器显式 skip）/ 429 total
- CI（含真编译器）：差分 12 + 一致性 2 + gcc-integration 29 + E2E 6 全量执行
- 单元/集成测试文件 40 个（P14 基线 24 个 → 新增 16：差分 3 + adapter 1 + reliability 1 + protocol 1 + E2E 1 + bench 1 等）

## 16. Coverage（threshold 85/80/85/85 强制）

**Statements 96.85% · Branches 84.41% · Functions 96.72% · Lines 97.84%**（`npm run coverage`，全部达标）

## 17. Package 结果

Windows x64：NSIS 安装包（CuinCStructLab-Setup-1.1.0.exe）+ Portable（CuinCStructLab-Portable-1.1.0.exe），CI artifact `windows-packages`，将作为 v1.1.0 Release 资产。

## 18. Commit 范围（v1.0.1..v1.1.0）

`4a14b08` docs(p15) specs → `f625d27` feat(diff) framework → `626ca61` feat(adapter)+runner fixes → `0dff662` fix(protocol) boundary → `7603bcd` feat(e2e)+CI matrix → `726624d` engines → `e686dfe` snapshot audit → `c2abe13`/`97ce160`/`24c118d`/`99ddc14`/`27b3871`/`f1d8ff3`/`61ab750`/`a8e8ad5`/`f14b5d8`/`c85b83a` CI 轮次修复 → `16f78b3` compile sanity probe → 版本/报告/发布 commit。

## 19. Tag：`v1.1.0`（v1.0 / v1.0.1 保留不动）

## 20. Release：https://github.com/yangxijia111/CuinCStructLab/releases/tag/v1.1.0

## 21. Known Limitations

1. **快照引擎规模上限**：>64 元素的 selection/quick 逐比较步骤会产生数百 MB 快照（UI 已硬限 40）；放开上限前需 Engine v2（触发条件见 SNAPSHOT_ENGINE_AUDIT）。
2. **Windows 裸 LLVM clang**：无 MSVC 头时探测直接判不可用并提示（正确行为）；用户需装 MSVC Build Tools 或 MSYS2 gcc。
3. **MSVC 差分覆盖**：本轮 cl 已全量通过全部差分（超出任务书"逐步覆盖"的最低要求），但 Windows 平台的 POSIX 进程组语义不适用（沿用 taskkill /T /F，孙进程测试在 Windows 验证通过）。
4. **Electron 锚点下载**与 playwright download 事件不兼容（E2E 用 blob 截获绕开，产品功能不受影响）。
5. 性能 NFR 测试（200ms 断言不变）在 CI 严重降速机器上依赖 retry×2 兜底（8 次取样取最小值）。
6. 应用图标仍为 Electron 默认（P14 遗留）。

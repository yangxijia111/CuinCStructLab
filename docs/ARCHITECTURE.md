# ARCHITECTURE.md — 架构设计

## 1. 技术选型论证

### 1.1 候选方案

| 方案 | 优点 | 缺点/风险 |
| --- | --- | --- |
| A. Electron + React + TS + Vite | 桌面端、本地文件、可调用本地编译器 | 二进制下载 ~100MB（网络风险）、原生模块 ABI 问题 |
| B. 纯 Web（Vite + React + TS） | 安装轻、开发快、测试容易 | 无桌面端、无本地进程能力 |
| C. Tauri | 轻量 | 需要 Rust 工具链，无人值守环境风险高 |
| D. CLI/Web Server | 不符合产品形态 | — |

### 1.2 决策：**方案 A′ = "Web 内核 + 可选 Electron 外壳"（分层架构）**

**结论：采用用户建议的 Electron + React + TypeScript + Vite，但用分层方式落地**：整个产品首先是**纯 Web 应用**（Vite 构建，可在浏览器完整运行），Electron 作为**可选外壳**叠加（提供桌面窗口、文件级 SQLite 持久化、本地 C Runner）。论证：

1. **不阻塞**：Electron 二进制下载失败不应阻塞学习平台开发（用户要求"不要因为 Runner/外壳阻塞整个项目"）。Web 内核保证 `npm run dev`/`build`/`test` 永远可用。
2. **测试友好**：核心逻辑（数据结构、步骤生成、判题）全部纯 TS，vitest 无需 GUI。
3. **架构同构**：Electron 主进程仅提供"能力桥"（文件读写、进程执行），渲染层不感知运行环境差异 → 通过 `PlatformAdapter` 接口抽象。
4. **满足桌面诉求**：安装 Electron 后（`npm run electron:dev` / `npm run electron:build`）即得到桌面产品。

### 1.3 数据库选型：**sql.js（SQLite WASM）**，而非 better-sqlite3

| 项 | better-sqlite3 | sql.js |
| --- | --- | --- |
| 原生编译 | 需要（Windows 需 VS Build Tools + node-gyp，且 Electron ABI 需 rebuild） | 不需要（WASM） |
| 无人值守风险 | 高 | 低 |
| 持久化 | 自动写文件 | 内存库，需手动导出字节流落盘 |
| SQL 能力 | 完整 | 完整（官方 SQLite 编译） |

**决策：sql.js。** 单一 schema/migration 代码路径，跨浏览器/Electron 一致。持久化策略（`PersistenceBackend` 接口）：

- **Electron**：主进程持有 DB，事务提交后（防抖 500ms）将导出的字节写入用户数据目录 `cuincstructlab.db`；启动时读取。
- **浏览器**：导出字节写入 IndexedDB（key: `sqlite-db`）。IndexedDB 是浏览器持久存储，非 localStorage；另有 JSON 导出/导入兜底，满足"重要数据不得只放 localStorage"。

写入失败（磁盘满等）→ 上抛为用户可见错误（NFR-06），绝不静默。

## 2. 总体架构

```
┌───────────────────────────── Electron 主进程（可选）─────────────────────┐
│  文件持久化（userData/cuincstructlab.db）   本地 C Runner（探测/编译/运行） │
└───────────────▲──────────────────────────────────────▲──────────────────┘
                │ preload (contextBridge, 最小 API)     │
┌───────────────┴──────────────────────────────────────┴──────────────────┐
│                         渲染层（React + TS，可独立跑在浏览器）              │
│  ui/（页面·组件·主题） ←→ pages/ 路由                                     │
│        │                    │                       │                    │
│  visualization/        exercises/ coding/          storage/              │
│  （Playback 控制器 +     （题库+判分）              （Repositories，       │
│   渲染器组件）                  │                  sql.js + migration）   │
│        │                        │                       │                │
│  ─────────────────── core/（纯 TS，零 UI 依赖） ──────────────────       │
│   data-structures/（模型+步骤生成）  algorithms/（排序/查找+步骤生成）      │
│   types.ts（Step/VisualModel）  recorder.ts（步骤记录器）                  │
└──────────────────────────────────────────────────────────────────────────┘
```

**依赖规则**（eslint 边界约束，见 §6）：
`pages → ui → { visualization, exercises, coding, storage, content } → core`
`core/` 不得 import 任何含 React 的模块。算法绝不写在 React 组件里。

## 3. 可视化引擎（核心）

### 3.1 数据流（单向）

```
用户操作（如 insert(1,15)）
  → core/data-structures/linked-list.ts: 产生 Step[]
  → visualization/engine/usePlayback: 管理 currentIndex/playing/speed
  → visualization/renderers/*: 渲染 steps[currentIndex].afterState + highlight
  → ui/CodePanel: 高亮 steps[currentIndex].codeLine
```

### 3.2 Step 模型（详见 VISUALIZATION_SPEC.md）

- `beforeState`/`afterState` 为**不可变快照**（Immutable Snapshot）。
- 回退策略 = **快照法**：显示第 i 步 = 渲染 `steps[i].afterState`；Previous/Jump 天然正确，无需重放。教学规模（n≤64）内存开销可忽略（快照做浅拷贝 + 结构共享）。
- Step 携带 `variables`（变量监视）、`memoryDelta`（内存面板增量）、`callStack`（调用栈快照）、`codeLine`（1-based）。

### 3.3 C 代码 ↔ 步骤同步

每个操作绑定一个 `CProgram`（代码行数组 + 行级解释）。步骤生成器在记录每步时给出对应 `codeLine`。**约束：步骤生成器与教学 C 代码必须行为等价**（同一套测试断言两者终态一致；C 代码以注释标明与 TS 函数的对应关系）。

## 4. 目录结构

```
CuinCStructLab/
├── docs/                       # 开发文档（本目录）
├── electron/                   # main.ts / preload.ts（可选外壳）
├── src/
│   ├── core/                   # 纯 TS：types.ts, recorder.ts, utils/
│   │   ├── data-structures/    # seqlist, linked-list, doubly-list, stack, queue,
│   │   │                       # bst, heap, graph（模型 + 步骤生成）
│   │   └── algorithms/         # sorting/(7种), search.ts
│   ├── visualization/          # engine/usePlayback + renderers/*
│   ├── content/                # 课程内容（ch00..ch13）、C 代码与逐行解释
│   ├── exercises/              # 题库数据 + 判分引擎
│   ├── coding/                 # 编程题定义（模板/测试用例/参考答案）
│   ├── judge/                  # 判题（比对规范化、状态机）
│   ├── runner/                 # C Runner（编译器探测、沙箱化执行）
│   ├── storage/                # db(sql.js)、schema、migrations、repositories
│   ├── ui/                     # 布局、主题、通用组件
│   ├── pages/                  # 路由页面
│   ├── App.tsx / main.tsx
│   └── app.css                 # 主题变量 + 全局样式
├── tests/                      # 集成测试（跨模块流程）
├── index.html
├── vite.config.ts / tsconfig.json / eslint.config.js
├── SECURITY.md / README.md / FINAL_REPORT.md
└── package.json
```

## 5. 关键设计决策记录（ADR 摘要）

| # | 决策 | 理由 |
| --- | --- | --- |
| D1 | Web 内核 + 可选 Electron 外壳 | 不被二进制下载阻塞；测试友好；见 §1.2 |
| D2 | sql.js + PersistenceBackend | 免原生编译；单一代码路径；见 §1.3 |
| D3 | 快照法回退（非重放） | 简单可靠，教学规模内存无压力；Previous 绝不猜状态 |
| D4 | 步骤生成器内嵌于数据结构模块 | 操作与步骤一体维护，保证代码行映射不漂移 |
| D5 | HashRouter | Electron `file://` 下无需服务端重写规则 |
| D6 | CodeMirror 6（非 Monaco） | 体积小一个量级、Vite 集成简单、C 高亮足够 |
| D7 | 判题输入经 stdin 喂入、结果经 stdout 比对 | 与 OJ 一致，教学可迁移 |
| D8 | 课程内容为结构化 TS 数据（非 MD 渲染） | 内容含交互锚点（动画/测验），TS 数据类型安全 |
| D9 | 掌握度为规则模型（答题正确率+学习行为加权），不用 AI API | 离线、可解释、满足 NFR |
| D10 | Runner 一律 `execFile`/`spawn` 数组 argv + 临时目录 + 超时 + taskkill /T /F | 防注入、可清理、可超时（Windows 进程树） |

## 6. 质量门禁

- `npm run verify` = `lint → typecheck → test → build`，全部通过才允许 commit 与进入下一 Phase。
- ESLint 边界规则：`core/**` 禁止 import `react`；`exercises/**`（数据文件）以外不得出现题目硬编码。
- CI 即本地：无人值守环境下以同一命令复现。

## 7. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| Electron 下载失败 | Web 内核继续开发；外壳列为可选增强 |
| 本机无 C 编译器 | Runner 探测给出安装指引；编程题降级为"查看测试用例+参考答案"；不阻塞平台 |
| sql.js WASM 加载失败 | 启动自检 + 明确错误 UI；JSON 导出兜底 |
| 内容量大导致后期失控 | 内容为数据驱动，先框架后逐章填充，Roadmap 分 Phase 验收 |

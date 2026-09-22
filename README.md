# CuinCStructLab

[![CI](https://github.com/yangxijia111/CuinCStructLab/actions/workflows/ci.yml/badge.svg)](https://github.com/yangxijia111/CuinCStructLab/actions/workflows/ci.yml)

**面向 C 语言初学者的数据结构学习、可视化、代码实践与刷题平台。**

看得见指针、跑得动代码、刷得了题——课程、动画、实验室、题库、本地判题、错题本一站式完成，全部数据保存在本地，无需联网、无需账号。

> 截图：暂未提供。仓库不包含占位截图；欢迎运行后自行体验，或提交 PR 补充 `docs/screenshots/`（首页 / 链表动画 / Compare Mode / 判题结果 / 学习统计）。

## Quick Start

```bash
# 需要 Node.js ≥ 22.22（jsdom 30 的最低要求，与 package.json engines 一致）
npm install
npm run dev              # 浏览器开发模式（完整功能，数据存 IndexedDB）
```

桌面版（本地判题需要 Electron + C 编译器）：

```bash
npm run electron:dev     # 桌面开发模式（先另起 npm run dev）
npm run electron:build   # Windows x64 打包（NSIS 安装包 + Portable）
```

> 桌面版本地判题需要 C 编译器：Windows 安装 [MSYS2/MinGW-w64](https://www.msys2.org/) 并把 `gcc.exe` 加入 `PATH`；macOS `xcode-select --install`；Linux `sudo apt install gcc`。没有编译器时其余功能全部可用，仅判题降级为指引提示。

## 主要功能（Features）

- **14 章系统课程**：C 预备知识 → 复杂度 → 顺序表/链表/双向链表/栈/队列/字符串数组 → 树/BST/堆/图 → 查找/排序。每章统一 14 段教学结构。
- **统一可视化引擎**：Operation → Step[]（不可变快照）→ Playback → Renderer。播放/暂停/单步/回退/重放/跳转，速度 0.25x–4x。回退基于快照，绝不"猜测状态"。
- **三者同步**：C 代码当前行高亮 ↔ 变量监视 ↔ 数据结构画面，任何时刻一一对应。
- **可视化实验室**：数组/顺序表、单/双向链表、栈/括号匹配、循环队列（wrap-around）/假溢出、树遍历（调用栈）、BST 删除三情形、堆、图（拖动/DFS/BFS）全部可互动。
- **排序实验室**：7 种算法动画 + **Compare Mode** 最多 3 算法并排同数据比较。
- **题库**：86 题、8 种题型，判分 + 解析。
- **编程练习 + 本地判题**：10 道题，CodeMirror 编辑器，判题 AC/WA/CE/RE/TLE，真实 gcc 自动验证（CI 全量运行 referenceSolution 判 Accepted）。
- **学习记录**：错题本（7 类错因）、学习统计、知识掌握度（基于知识点注册表全集，未做题的知识点也参与统计）、笔记与收藏。
- **数据管理**：JSON 导出 + **校验式导入**（schema/版本校验、预览、自动备份、事务导入）；一键清空（Web/Electron 统一 API）。
- **新手模式**、暗色优先主题、键盘快捷键（Space/←→/R/↑↓）、统一键盘焦点样式（`:focus-visible`）、1024×680 与 900×600 小窗口可用。

## 技术栈与架构（Architecture）

| 层 | 技术 |
| --- | --- |
| 渲染层 | React 19 + TypeScript (strict) + Vite + React Router |
| 可视化 | 自研 Step/Snapshot 引擎 + SVG/DOM 渲染器 |
| 编辑器 | CodeMirror 6（@uiw/react-codemirror + lang-cpp） |
| 存储 | sql.js（SQLite asm.js）+ IndexedDB / Electron 文件双后端 + migration |
| 桌面外壳 | Electron（contextIsolation + sandbox + webSecurity 全开启，`app://` 标准协议加载，CSP，IPC 参数验证） |
| 本地判题 | 单一 Runner Core（`electron/runner-core.cjs`）：payload 验证、超时杀树、输出限幅、真实计时 |
| 质量 | Vitest 364 用例 + coverage 门禁（85/80/85/85）+ ESLint（typed-lint + 架构边界规则） |

架构决策（Web 内核 + 可选桌面外壳、sql.js、快照回退等）详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

依赖规则（ESLint 强制）：`core/` 禁止依赖 React/UI；题目数据只在 `exercises/bank/`；Runner 逻辑只在 `electron/runner-core.cjs`。

## Testing

```bash
npm run test        # 全部单元 + 集成测试（364 用例）
npm run coverage    # 覆盖率（thresholds 85/80/85/85 真正执行）
npm run verify      # lint + typecheck + test + build 一键质量门禁
npm run electron:smoke  # Electron 冒烟（app:// 协议加载生产构建）
```

测试亮点：

- **真实 gcc 集成**（`tests/gcc-integration.test.ts`）：全部 10 道编程题的 referenceSolution 编译运行全用例必须 Accepted，另覆盖 WA/CE/RE/TLE、无限循环终止、输出洪泛限幅、stdin、Unicode、临时目录清理。CI 的 `gcc-runner` job（Ubuntu）强制 gcc 存在后全量执行。
- **持久化竞态**：flush 进行期间的新写入保证不丢（revision + 串行链 + while-dirty）。
- **章节状态单调性**：done 不被复习降级（内存/SQLite/刷新恢复三层）。
- **导入安全**：损坏 JSON/未来版本/非法字段拒绝；注入故障时事务回滚、原库零影响。
- **Electron 安全红线**：`webSecurity`/`sandbox` 配置静态断言防回归。

## Security

本地编译运行 ≠ 安全沙箱（详见 [SECURITY.md](SECURITY.md)）。桌面外壳防护：contextIsolation + sandbox + webSecurity 全开启、`app://` 标准协议加载（无需关闭同源限制）、CSP、导航/新窗口限制、preload 最小暴露（7 个函数）、IPC 参数验证（渲染层不可信：payload 全字段校验后才进入 Runner Core）。

## Release

- 当前版本：**v1.0.1**（见 [docs/CHANGELOG.md](docs/CHANGELOG.md)）。
- Windows x64 安装包（NSIS）与 Portable 由 CI 的 `package` job 构建并上传 Artifact；本地可用 `npm run electron:build` 构建。
- 发布产物不入 Git。

## 项目结构

```
CuinCStructLab/
├── docs/                   # 开发文档（产品/需求/架构/各模块规格/测试计划/路线图/变更日志/加固记录）
├── electron/               # 桌面外壳（main/preload/protocol/runner-core/smoke）
├── src/
│   ├── core/               # 纯 TS：类型 + recorder + 数据结构/算法（模型+步骤+教学C代码）
│   ├── visualization/      # usePlayback + 渲染器 + 实验室注册表
│   ├── content/            # 14 章课程内容
│   ├── exercises/          # 8 题型判分引擎 + 86 题题库
│   ├── coding/             # 10 道编程题（模板/用例/参考答案/harness）
│   ├── judge/              # 判题比对规范化 + 状态机
│   ├── runner/             # Runner 类型定义与运行环境桥
│   ├── storage/            # sql.js 数据库 + migration + 仓库 + 知识点注册表 + 导入
│   ├── ui/                 # 布局/主题/AppStore
│   └── pages/              # 全部路由页面
├── tests/                  # 集成测试（持久化/竞态/导入/安全/gcc 集成/冒烟）
├── SECURITY.md             # 本地编译 ≠ 沙箱等安全说明
└── FINAL_REPORT.md         # 项目最终报告
```

## 学习路线

第 0 章 C 预备知识 → 第 1 章 复杂度 → 第 2–7 章线性结构 → 第 8–11 章树与图 → 第 12–13 章查找与排序。每章按"学（课程）→ 看（动画）→ 练（实验室）→ 测（题库）→ 写（编程判题）→ 记（错题本）"闭环推进。

## 贡献方式

1. Fork 并创建特性分支；2. 保持 `npm run verify` 全绿；3. 新功能先补测试；4. 遵循现有目录边界（core 无 UI 依赖）；5. 提交信息用约定式（feat/test/fix/docs）。文档位于 `docs/`，与代码同步维护。

## License

[MIT](LICENSE) © 2026 CuinCStructLab Contributors

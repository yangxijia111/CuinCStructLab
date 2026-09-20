# CuinCStructLab

**面向 C 语言初学者的数据结构学习、可视化、代码实践与刷题平台。**

看得见指针、跑得动代码、刷得了题——课程、动画、实验室、题库、本地判题、错题本一站式完成，全部数据保存在本地，无需联网、无需账号。

> 截图位置：`docs/screenshots/`（课程页三栏布局、链表插入动画、Compare Mode、判题结果——可在运行后自行补充）

## 主要功能

- **14 章系统课程**：C 预备知识 → 复杂度 → 顺序表/链表/双向链表/栈/队列/字符串数组 → 树/BST/堆/图 → 查找/排序。每章统一 14 段教学结构（是什么/为什么/类比/图示/C 定义/操作/逐行代码/动画/单步/复杂度/常见错误/测验/编程练习）。
- **统一可视化引擎**：Operation → Step[]（不可变快照）→ Playback → Renderer。播放/暂停/单步/回退/重放/跳转，速度 0.25x–4x。回退基于快照，绝不"猜测状态"。
- **三者同步**：C 代码当前行高亮 ↔ 变量监视 ↔ 数据结构画面，任何时刻一一对应；行号由 `buildLineMap` 按代码文本运行时定位，杜绝漂移。
- **可视化实验室**：数组/顺序表、单/双向链表、顺序栈/链栈/括号匹配、循环队列（wrap-around）/链队列/假溢出演示、二叉树四种遍历（递归调用栈）、BST 删除三情形、堆上滤/下滤/Floyd 建堆、图（增删点边/拖动/DFS/BFS + 栈队列面板）全部可互动。
- **排序实验室**：7 种算法柱状图动画（比较/交换/已排序区/pivot/merge 区间 + 计数）；**Compare Mode** 最多 3 个算法并排同数据比较。
- **内存面板**：变量/模拟地址/值/指针箭头，演示 malloc/free/悬垂指针（地址标注"教学模拟"）。
- **题库**：86 题、8 种题型（单选/多选/判断/填空/代码阅读/执行结果/找 Bug/代码补全），判分 + 解析。
- **编程练习 + 本地判题**：10 道题（顺序表插入/链表尾插删除/栈/循环队列/BST 查找/冒泡/快排/二分/strlen），CodeMirror 编辑器，判题状态 AC/WA/CE/RE/TLE（WA 展示 输入/Expected/Actual），自动探测 gcc/clang/MSVC。
- **学习记录**：错题本（7 类错因/次数/重练/标记掌握）、学习统计（完成度/正确率/连续天数/掌握分布/趋势）、知识掌握度（规则模型）、笔记与收藏。
- **本地持久化**：SQLite（sql.js），浏览器存 IndexedDB、桌面版存 userData 文件，JSON 导出备份；刷新/重启数据不丢。
- **新手模式**：每步附加更详细的解释（"current 当前指向值为 10 的节点……"）。
- **暗色优先**主题 + 亮色切换；键盘快捷键（Space/←→/R/↑↓）。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 渲染层 | React 19 + TypeScript (strict) + Vite + React Router |
| 可视化 | 自研 Step/Snapshot 引擎 + SVG/DOM 渲染器 |
| 编辑器 | CodeMirror 6（@uiw/react-codemirror + lang-cpp） |
| 存储 | sql.js（SQLite asm.js）+ IndexedDB / Electron 文件双后端 + migration |
| 桌面外壳 | Electron（contextIsolation + preload 最小暴露，可选启用） |
| 质量 | Vitest（254+ 测试）+ ESLint（typed-lint + 架构边界规则） |

架构决策（Web 内核 + 可选桌面外壳、sql.js、快照回退等）详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 安装

```bash
# 需要 Node.js ≥ 20
npm install

# Electron 二进制若下载失败（网络原因），使用镜像：
# Windows (Git Bash)
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js
```

## 运行

```bash
npm run dev              # 浏览器开发模式（完整功能，数据存 IndexedDB）
npm run electron:dev     # 桌面开发模式（先另起 npm run dev，本地判题走 IPC）
npm run electron:start   # 桌面运行生产构建（需先 build）
```

> 桌面版本地判题需要 C 编译器：Windows 安装 [MSYS2/MinGW-w64](https://www.msys2.org/) 并把 `gcc.exe` 加入 `PATH`；macOS `xcode-select --install`；Linux `sudo apt install gcc`。没有编译器时其余功能全部可用，仅判题降级为指引提示。

## 测试

```bash
npm run test        # 全部单元 + 集成测试
npm run coverage    # 覆盖率（core/storage/exercises/judge）
npm run electron:smoke  # Electron 冒烟（需先 build）
```

## 构建

```bash
npm run build       # 产出到 dist/
npm run verify      # lint + typecheck + test + build 一键质量门禁
```

## 项目结构

```
CuinCStructLab/
├── docs/                   # 13 份开发文档（产品/需求/架构/各模块规格/测试计划/路线图/变更日志）
├── electron/               # 桌面外壳（main/preload/smoke）
├── src/
│   ├── core/               # 纯 TS：types(Step/VisualState) + recorder(快照/冻结/模拟内存)
│   │   ├── data-structures/    # 顺序表/链表×2/栈/队列/树/BST/堆/图（模型+步骤+教学C代码）
│   │   └── algorithms/         # 7 种排序 + 顺序/二分查找（纯函数版+步骤版）
│   ├── visualization/      # usePlayback 播放器 + 7 类渲染器 + 实验室注册表 + 排序实验室
│   ├── content/            # 14 章课程内容（14 段教学结构）
│   ├── exercises/          # 8 题型判分引擎 + 86 题题库
│   ├── coding/             # 10 道编程题（模板/用例/参考答案/harness）
│   ├── judge/              # 判题比对规范化 + 状态机
│   ├── runner/             # 本地 C Runner（探测/安全执行/超时/进程树终止）
│   ├── storage/            # sql.js 数据库 + migration + 仓库 + 掌握度规则
│   ├── ui/                 # 布局/主题/AppStore（双写 SQLite）
│   └── pages/              # 全部路由页面
├── tests/                  # 集成测试（持久化/同步性/审计/冒烟）
├── SECURITY.md             # 本地编译 ≠ 沙箱等安全说明
└── FINAL_REPORT.md         # 项目最终报告
```

依赖规则（ESLint 强制）：`core/` 禁止依赖 React/UI；题目数据只在 `exercises/bank/`。

## 支持的数据结构

顺序表（含扩容）、单链表（带头节点）、双向链表、顺序栈/链栈、循环队列/链队列（含假溢出演示）、数组与字符串、二叉树（四种遍历+调用栈）、二叉搜索树（删除三情形）、最大/最小堆（上滤/下滤/Floyd 建堆）、图（邻接矩阵/表、增删点边、DFS/BFS）。

## 支持的算法

查找：顺序查找、二分查找（含无序告警）。排序：冒泡、选择、插入、希尔、归并、快速、堆排序（各配动画、复杂度、稳定性、比较/交换计数、Compare Mode）。

## 学习路线

第 0 章 C 预备知识 → 第 1 章 复杂度 → 第 2–7 章线性结构 → 第 8–11 章树与图 → 第 12–13 章查找与排序。每章按"学（课程）→ 看（动画）→ 练（实验室）→ 测（题库）→ 写（编程判题）→ 记（错题本）"闭环推进。

## 贡献方式

1. Fork 并创建特性分支；2. 保持 `npm run verify` 全绿；3. 新功能先补测试；4. 遵循现有目录边界（core 无 UI 依赖）；5. 提交信息用约定式（feat/test/fix/docs）。文档位于 `docs/`，与代码同步维护。

## License

MIT License © 2026 CuinCStructLab Contributors

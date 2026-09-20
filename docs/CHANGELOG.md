# CHANGELOG.md

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，版本遵循语义化。

## [Unreleased]

### Added
- 完成全部开发文档（PRODUCT / REQUIREMENTS / ARCHITECTURE / DATA_STRUCTURE_SPEC / VISUALIZATION_SPEC / C_CODE_SPEC / EXERCISE_SPEC / JUDGE_SPEC / DATA_SPEC / UI_UX_SPEC / TEST_PLAN / ROADMAP / CHANGELOG）。
- Architecture Review：确认技术选型（Web 内核 + 可选 Electron 外壳、sql.js、快照回退、CodeMirror），修正了循环队列判满约定、BST 删除采用中序前驱等决策并回写文档。
- P0：Vite + React + TS strict 脚手架、ESLint 边界规则（core 禁 UI 依赖）、Vitest 流水线（verify = lint+typecheck+test+build）、GitHub 仓库创建。
- P1：核心类型系统（Step / VisualState / MemorySnapshot）、StepRecorder（structuredClone 快照 + deepFreeze 防御性不可变）、SimMem 模拟内存面板；顺序表（含扩容三步搬移）、单链表（插入两步接线/删除绕过/销毁先存 next）、双向链表（四步插入/两步绕过）、顺序栈/链栈/括号匹配、循环队列（wrap-around）/链队列（空队特判）/假溢出演示、二叉树四种遍历（CallStack 同步）、BST（删除三情形 + 中序前驱）、堆（上滤/下滤/Floyd 建堆）、图（邻接矩阵/表、增删点边、DFS 递归栈/BFS 队列）；全部配教学 C 代码与 codeLine 映射。

- P2：usePlayback 播放控制器（快照回退/5 档速度/键盘快捷键/末尾自动暂停）、CodePanel（行高亮+行级解释+新手模式说明条）、Variables/Memory/CallStack 面板、PlaybackBar、VisualizationShell 组合容器。

- P3：7 种排序（纯函数版 + 步骤版 + 计数器 + 复杂度/稳定性元数据 + 各自教学 C 代码）、顺序/二分查找（含无序告警）、compareSorts 多算法比较数据基础。

- P4：课程内容数据模型（14 段教学结构 + vizOp 锚点）、全部 14 章内容（Ch0 预备知识 ~ Ch13 排序，含 30+ 段教学 C 代码与行级 notes）、App 布局（侧栏导航/新手模式开关/主题切换）、课程列表页 + 章节页三栏布局（左目录/中正文/右代码面板）、AppStore 全局状态、内容完整性测试。

- P5：ArrayView（index/value/写操作突出/容量标尺）、BarsView、ListView（节点双格/指针 chips/floating 行）、StackView、QueueView（环形格子+front/rear 游标）、StateRenderer 分发；Labs 注册表（7 个线性实验室，含 Ch0 指针内存演示、假溢出演示、括号匹配）；LabPage（结构选择/数据初始化/操作参数/动画执行）；行号审计测试与三者同步性集成测试。
- 行号系统重构：全部数据结构模块改用 buildLineMap（按 C 代码文本运行时定位行号），修复多处硬编码行号偏移导致的"动画与代码不同步"。

### Fixed
- bstInsert 缓存旧快照节点引用导致父指针未接上（断链）——改为 mutate 内按 id 重新定位。
- deletePure 情形三"前驱即左孩子"分支挂接错误。
- graphFrom 无向图只存单向边导致邻接矩阵不对称、DFS 邻居缺失。
- StepRecorder.finish 递归冻结全部步骤（快照防篡改）。

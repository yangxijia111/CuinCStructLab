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

- P6：TreeView（中序 x/深度 y 布局、遍历序号、freed 虚化、层序队列面板）、HeapView（树+数组双视图）、GraphView（SVG 拖动节点、visited/current/next 三态、frontier 面板、有向箭头）；4 个进阶实验室（树遍历含调用栈、BST 删除三情形、堆三操作、图 DFS/BFS/增删）。
- P7：SortingLab（单算法动画 + 查找模式）、Compare Mode（≤3 算法并排、共享步进、到尾停留显示最终计数）、排序/查找实验室集成测试。

- P8：8 题型判分引擎（多选集合相等/填空白白宽容/补全全对才得分）、题库 86 题（14 章每章 ≥6 题，覆盖全部题型）、题库页（章节/题型筛选 + 答题 + 解析 + 重做）、AppStore 答题记录与错题本内存实现、题库完整性与判分矩阵测试。

- P9：sql.js（asm.js 版，零 wasm 配置）AppDatabase（防抖持久化/事务/JSON 导出/损坏报错不覆盖）、IndexedDb/Memory 双后端、schema v1 migration（幂等）、全部仓库（进度/答题/错题/笔记/收藏/设置/日活/提交）、掌握度规则与连续天数、AppStore 双写 SQLite + 启动恢复 + 存储错误横幅；持久化集成测试（模拟重启数据不丢）。

- P10：错题本页（错因筛选/重练/标记掌握）、学习统计页（完成度/正确率/连续天数/章节进度条/掌握分布/近 30 天趋势柱图）、全局搜索页（章节/算法/题目，搜"指针"命中预期）、页面冒烟测试（9 个路由 + 答题交互）。

- P11：判题比对规范化（CRLF/LF、行尾空白、末尾换行；中间空行/大小写/行内空格严格）、判题状态机（AC/WA/CE/RE/TLE，WA 展示 输入/Expected/Actual/差异行）、本地 Runner（编译器探测 gcc/clang/cl + Windows 常见路径、spawn 数组 argv 防注入、独立临时目录、超时 + taskkill /T /F 进程树终止、1MB 输出限制、用后清理）、10 道编程题（题面/模板/用例/参考答案/判题 harness）、CodeMirror 编辑器 CodingPage（无编译器降级提示）、SECURITY.md。

### Fixed
- bstInsert 缓存旧快照节点引用导致父指针未接上（断链）——改为 mutate 内按 id 重新定位。
- deletePure 情形三"前驱即左孩子"分支挂接错误。
- graphFrom 无向图只存单向边导致邻接矩阵不对称、DFS 邻居缺失。
- StepRecorder.finish 递归冻结全部步骤（快照防篡改）。

# ROADMAP.md — 开发路线图

每个 Phase 结束执行：lint → typecheck → test → build 全绿 → 更新 CHANGELOG → git commit → 自动进入下一 Phase。
（本文件含"状态"列，随进度更新：⬜ 未开始 / 🔄 进行中 / ✅ 完成。）

---

## P0 项目脚手架与工具链 ✅
- **目标**：可构建、可测试、可 lint 的 TypeScript strict 工程。
- **功能**：Vite + React + TS、ESLint（含架构边界规则）、Vitest（jsdom）、目录骨架、`verify` 合成命令、.gitignore、首次 commit。
- **范围**：无业务功能；Hello World 页 + 示例测试。
- **验收**：`npm run verify` 全绿；`dist/` 产出；strict 无 any 绕过。
- **测试**：示例单测跑通。
- **完成标准**：工具链就绪，GitHub 仓库创建（如可行）。

## P1 核心数据结构库 ✅
- **目标**：全部线性结构与树/堆/图的核心逻辑 + Direct 版 + 步骤版雏形。
- **功能**：SeqList、单链表、双向链表、顺序栈/链栈、循环队列/链队列、二叉树遍历、BST、堆、图（邻接矩阵/表、DFS/BFS）。
- **范围**：含 StepRecorder 与模拟内存模型；不含渲染。
- **验收**：TEST_PLAN §2 数据结构矩阵全部通过；覆盖率 ≥ 90%。
- **测试**：每结构独立 test 文件 + 属性断言（BST 中序递增、堆性质全量断言）。
- **完成标准**：核心逻辑可被上层安全依赖。

## P2 Visualizer Engine ✅
- **目标**：Step 模型定稿 + 播放控制器 + 通用面板组件。
- **功能**：types.ts 定稿、usePlayback（含 5 档速度/快照回退）、CodePanel/VariablesPanel/MemoryPanel/CallStackPanel、PlaybackBar。
- **验收**：引擎测试全绿（next/prev/restart/jump/速度/边界）。
- **测试**：hook 测试（renderHook + fake timers）+ 快照不变量。
- **完成标准**：任一 Step[] 可驱动完整播放 UI。

## P3 排序与查找算法 ⬜
- **目标**：7 种排序 + 2 种查找，纯函数版与步骤版。
- **功能**：bubble/selection/insertion/shell/merge/quick/heap；linear/binary；计数器；Compare Mode 数据基础（同数据多算法 steps）。
- **验收**：TEST_PLAN §2 排序/查找矩阵通过（8 组固定数据 + 随机）。
- **完成标准**：算法层完成，等待渲染。

## P4 课程系统框架 + 章节内容 ⬜
- **目标**：14 章内容全部落地，课程页可用。
- **功能**：内容数据模型（14 段结构）、Ch0–Ch13 全部正文、教学 C 代码（C_CODE_SPEC §3 清单）与逐行解释、课程页布局（左目录/中正文/右状态/底部播放器雏形）、章节进度上报。
- **验收**：每章 14 段结构齐全；C 代码行数 ≥ 规格清单；课程页可导航；进度持久化（先内存接口，P9 接库）。
- **测试**：内容完整性测试（结构字段、codeLine 映射、id 唯一）。
- **完成标准**：能从头读到尾学完 14 章（文字+代码层面）。

## P5 线性结构可视化 + Playground（一） ⬜
- **目标**：数组/顺序表/链表/双向链表/栈/队列的渲染器与互动实验。
- **功能**：ArrayView/ListView/StackView/QueueView/MemoryPanel 联动、实验室页框架（结构选择/数据输入/操作执行）、排序外全部线性操作动画。
- **验收**：同步性集成测试（codeLine/variables/highlight 一致）；手工清单：`10 20 30` 插入 pos=1 value=15 → `10→15→20→30`。
- **完成标准**：FR-VIZ-05/06/07、FR-LAB 线性部分达成。

## P6 树/堆/图可视化 + Playground（二） ⬜
- **目标**：TreeView/BSTView/HeapView/GraphView。
- **功能**：遍历 + CallStack 同步、BST 删除三情形动画、堆上滤/下滤、图增删点边/拖动/DFS/BFS + 队列栈面板。
- **验收**：遍历动画与测试序列一致；图交互（增删/拖动）事件测试。
- **完成标准**：FR-VIZ-08/09 达成。

## P7 排序可视化 + Compare Mode ⬜
- **目标**：BarsView、排序动画、比较模式。
- **功能**：柱状图（比较/交换/已排序/pivot/merge 区间 + 三计数）、Compare Mode（≤3 算法并排、共享节拍）。
- **验收**：7 算法动画步进抽样断言；Compare Mode 三算法同步推进。
- **完成标准**：FR-VIZ-10/11 达成。

## P8 练习系统 ⬜
- **目标**：题库 + 判分 + 答题 UI + 错题记录（内存接口）。
- **功能**：8 题型判分引擎、题库数据（≥84 题）、题库页/答题组件、答题记录、错题数据流。
- **验收**：题库完整性测试 + 判分矩阵测试 + 答题交互冒烟。
- **完成标准**：FR-EXE-01..05、FR-WRONG-01..03（逻辑层）。

## P9 本地存储层 ⬜
- **目标**：SQLite（sql.js）+ migration + 全部仓库 + 接线。
- **功能**：DB 单例、schema v1、migrations、防抖持久化（IndexedDB/Electron 文件）、全部 Repo、进度/错题/笔记/收藏/设置/学习日活落库、JSON 导出导入。
- **验收**：CRUD/migration/掌握度/连续天数测试；刷新后数据仍在（jsdom + fake-indexeddb 集成）。
- **完成标准**：FR-DATA-01..04 达成。

## P10 Dashboard + 掌握度 + 搜索 ⬜
- **目标**：统计与检索体验完整。
- **功能**：首页总览、学习统计页（趋势/掌握分布/编程完成度）、知识掌握度计算接线、全局搜索（知识点/数据结构/算法/题目）、收藏与笔记 UI。
- **验收**：统计数字与库数据一致性的集成测试；搜索命中（"指针"→ 指针基础/链表/malloc/树节点/相关题目）。
- **完成标准**：FR-STAT-01/02、FR-SRCH-01、FR-FAV-01。

## P11 C Runner + 判题 + 编程练习 ⬜
- **目标**：本地编译运行 + 自动判题 + 编程题闭环。
- **功能**：编译器探测（gcc/clang/cl）、安全执行（临时目录/超时/进程树终止/输出限制/清理）、判题状态机、CodeMirror 编辑器、≥9 道编程题（模板/用例/参考答案）、提交记录、SECURITY.md。
- **验收**：有编译器环境判题集成测试（AC/WA/CE/TLE）；无编译器环境降级提示且不阻塞。本机无编译器时以"runner 逻辑单测（mock child_process）+ 手动指引"替代并记录 Known Limitation。
- **完成标准**：FR-COD/RUN/JUDGE 全部达成（或记录环境限制）。

## P12 新手模式 + 设置 + 打磨 ⬜
- **目标**：体验层完整。
- **功能**：Beginner Mode 全局接线（步骤 + 代码行解释）、设置页（主题/速度/编译器路径/导出导入/清空）、键盘快捷键、空态/错误 toast、reduced-motion、对比度修正。
- **验收**：设置持久化测试；快捷键行为测试；UI 走查清单（各页面空态/错误态）。
- **完成标准**：FR-UI-03、NFR-06 达成。

## P13 最终审计 + v1.0 ⬜
- **目标**：按完成标准全项目审计并修复。
- **功能**：Architecture/数据结构正确性/算法/C 代码/指针解释/可视化/播放状态/练习/数据库/错误处理/UX/无障碍/性能/安全/测试覆盖 共 15 项审计（重点：链表断链、空指针、off-by-one、循环队列 front/rear、BST 删除、堆性质、递归状态、BFS/DFS 重复访问、排序边界、Previous 恢复、动画代码同步、数据丢失）→ 修复 → 重跑 verify。
- **验收**：README.md 完成（介绍/截图位/功能/技术栈/安装/运行/测试/构建/结构/数据结构/算法/学习路线/贡献/License）；FINAL_REPORT.md；打 v1.0 tag；push GitHub（如可行）。
- **完成标准**：三十二节"完成标准"逐条核对通过。

---

## v1.0 完成标准（对任务书第三十二节逐条映射）

课程系统可用 / 数据结构教学可用 / C 代码展示可用 / 动画系统可用 / Next-Previous 正确 / 数组·链表·栈·队列·树·BST·Heap·Graph·排序可视化可用 / 搜索可用 / 练习题可用 / 编程练习基础系统可用 / 错题本可用 / 学习记录可用 / Dashboard 可用 / 笔记收藏可用 / SQLite 保存正常 / 刷新重启数据不丢 / 无明显 Blocking Bug / lint+typecheck+test+production build 全绿 / README 完成 / docs 与代码一致。

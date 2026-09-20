# REQUIREMENTS.md — 需求规格

需求编号规则：`FR-<域>-<序号>` 功能需求，`NFR-<序号>` 非功能需求。
域：COURSE 课程 / VIZ 可视化 / CODE 代码教学 / LAB 实验室 / EXE 练习 / COD 编程 / RUN Runner / JUDGE 判题 / WRONG 错题 / STAT 统计 / SRCH 搜索 / FAV 收藏笔记 / DATA 数据 / UI 界面 / SEC 安全。

## 1. 课程系统

- FR-COURSE-01 提供 14 章课程（Ch0 C 预备知识 … Ch13 排序），顺序面向 C 初学者。
- FR-COURSE-02 每章内容遵循统一 14 段结构：是什么/为什么需要/现实类比/数据结构图示/C 结构定义/核心操作/逐行 C 代码/动画演示/单步执行/时间复杂度/空间复杂度/常见错误/小测验/编程练习。
- FR-COURSE-03 Ch0 覆盖：struct、typedef、指针、指针与数组、malloc/free、递归、函数参数、地址、NULL、sizeof，不默认学生已掌握。
- FR-COURSE-04 Ch1 覆盖 O(1)/O(n)/O(log n)/O(n log n)/O(n²)，配动画与代码示例。
- FR-COURSE-05 Ch2–Ch13 覆盖：顺序表（初始化/插入/删除/查找/修改/遍历/扩容）、单链表（含头节点/头插/尾插/指定位置插入/删除/查找/修改/遍历/释放）、双向链表（prev/next/插入/删除/遍历）、栈（顺序栈/链栈/push/pop/top/isEmpty/括号匹配/表达式求值思想/递归调用栈）、队列（顺序/循环/链式/enqueue/dequeue/front/rear/循环队列 (rear+1)%capacity）、字符串与数组（数组存储/二维数组/字符串/C 内存模型）、树（概念/二叉树/创建/插入/遍历：先序中序后序层序/递归调用栈）、BST（Insert/Search/Delete，删除覆盖叶节点/单子节点/双子节点）、堆（Max/Min Heap、insert/delete/heapify、Heap Sort）、图（邻接矩阵/邻接表/DFS/BFS/增删点边）、查找（顺序/二分，强调二分需有序）、排序（Bubble/Selection/Insertion/Shell/Merge/Quick/Heap）。
- FR-COURSE-06 课程页布局：左课程目录，中正文与 C 代码，右变量/内存/数据结构状态，底部播放器。
- FR-COURSE-07 课程学习进度（已读/学习中/已完成）持久化。

## 2. 可视化引擎

- FR-VIZ-01 统一 Visualizer Engine：Operation → Step[] → Engine → Renderer → PlaybackController；禁止每个页面自造动画。
- FR-VIZ-02 Step 至少包含：id、type、description、codeLine、variables、highlight、beforeState、afterState。
- FR-VIZ-03 Playback 支持 Play/Pause/Next/Previous/Restart/Jump To Step；速度 0.25x/0.5x/1x/2x/4x。
- FR-VIZ-04 Previous/Jump 必须基于快照或确定性重放，禁止猜测状态。
- FR-VIZ-05 数组可视化：`[1][2][3][4][5]` 样式，显示 index 与 value；`a[2]=10` 突出 index=2、3→10。
- FR-VIZ-06 链表可视化：节点 `[data|next]` 双格，HEAD 标识，NULL 结尾；插入逐步展示 newNode/current/next 与 `newNode->next=current->next; current->next=newNode;` 的指针变化；删除同理。
- FR-VIZ-07 内存面板：变量（名/模拟地址/值）+ 指针箭头；地址为教学用模拟地址，须标注"模拟"。
- FR-VIZ-08 树可视化：树形布局、遍历逐个高亮、同时显示 Call Stack。
- FR-VIZ-09 图可视化：增删点、拖动节点、增删边；BFS 显示 Queue，DFS 显示 Stack/递归栈；展示 visited/current/next。
- FR-VIZ-10 排序可视化：柱状图 + 当前比较/当前交换/已排序区域/Pivot/Merge Range + Comparisons/Swaps/Steps 计数。
- FR-VIZ-11 Compare Mode：同一组数据同时选最多 3 个排序算法并排比较。
- FR-VIZ-12 代码播放器：左侧 C 代码 + 当前行高亮；代码行/变量/画面三者同步（如 `current=current->next` 时链表 current 指针同步移动）。

## 3. 代码教学

- FR-CODE-01 所有数据结构提供真实 C 实现：初学者友好、注释充分、不炫技、无复杂宏、不为简短牺牲可读性。
- FR-CODE-02 关键代码逐行解释（如 `Node *newNode = malloc(sizeof(Node));` 拆解 Node*、malloc、sizeof、为何 free）。
- FR-CODE-03 代码展示组件支持行号、当前执行行高亮、行级解释悬浮/展开。

## 4. 互动实验室（Playground）

- FR-LAB-01 支持 Array/Linked List/Doubly List/Stack/Queue/Tree/BST/Heap/Graph/Sorting 的互动实验。
- FR-LAB-02 用户可输入初始数据（如 10 20 30）、选择操作与参数（如 insert pos=1 value=15），动画执行并得到结果（10→15→20→30）。
- FR-LAB-03 每个实验均可使用完整播放控制（FR-VIZ-03）。

## 5. 练习系统

- FR-EXE-01 题型：单选/多选/判断/填空/代码阅读/执行结果/找 Bug/代码补全。
- FR-EXE-02 每章至少 6 道基础示例题（v1.0 总量 ≥ 84）。
- FR-EXE-03 题目数据独立保存于数据文件，不硬编码在 UI 组件。
- FR-EXE-04 题目 schema：id、chapter、knowledgePoint、difficulty、type、question、options、answer、explanation、tags。
- FR-EXE-05 答题判分、答题记录持久化。

## 6. 编程训练与判题

- FR-COD-01 代码编辑器（CodeMirror），含 C 语法高亮。
- FR-COD-02 编程题：题目/函数签名/初始模板/示例/测试用例；v1.0 覆盖：顺序表插入、单链表尾插、链表删除、栈 push、循环队列 enqueue、BST search、冒泡排序、快速排序、二分查找（≥9）。
- FR-RUN-01 本地 C Runner：自动探测 gcc/clang/MSVC cl；不存在时给出清晰提示，不崩溃。
- FR-RUN-02 Runner 要求：临时目录、超时控制、stdout/stderr/exit code、进程树终止、临时文件清理、输出大小限制。
- FR-RUN-03 严禁 `shell + 用户代码字符串` 拼接，必须 argv 数组方式调用编译器与程序，防止命令注入。
- FR-RUN-04 若 Runner 不可用，不得阻塞学习平台其他功能。
- FR-JUDGE-01 判题状态：Accepted/Wrong Answer/Compile Error/Runtime Error/Time Limit Exceeded。
- FR-JUDGE-02 WA 显示 输入/Expected/Actual。
- FR-JUDGE-03 比对规范化：CRLF/LF、末尾换行、行尾空格。

## 7. 错题与统计

- FR-WRONG-01 自动记录答错题目与编程失败题目：知识点、错误次数、最近错误时间、错误类型。
- FR-WRONG-02 错误类型：概念/指针/边界/循环/内存/算法理解/复杂度。
- FR-WRONG-03 支持重新练习、标记掌握。
- FR-STAT-01 Dashboard：课程完成度、已学章节、题目正确率、编程题完成度、错题数、连续学习天数、最近学习、知识点掌握。
- FR-STAT-02 知识掌握度模型：未学习/学习中/待加强/基本掌握/已掌握（规则驱动，不使用 AI API）。
- FR-SRCH-01 搜索：知识点/数据结构/算法/题目（如搜"指针"返回 指针基础/链表/malloc/树节点/相关题目）。
- FR-FAV-01 收藏知识点与题目；简单学习笔记；本地保存。

## 8. 数据与安全

- FR-DATA-01 本地 SQLite 保存：学习进度、练习记录、错题、笔记、收藏、代码提交、设置。
- FR-DATA-02 实现 migration。
- FR-DATA-03 重要数据不得只放 localStorage。
- FR-DATA-04 刷新/重启后数据不丢失；支持导出/导入备份（JSON）。
- FR-SEC-01 SECURITY.md 明确：本地编译运行不等价于真正安全沙箱。
- FR-SEC-02 模拟内存地址必须标注"教学模拟地址"，不冒充真实系统地址。

## 9. UI/UX

- FR-UI-01 导航：首页/课程/数据结构/算法/可视化实验室/代码练习/题库/错题本/学习统计/设置。
- FR-UI-02 风格：现代、简洁、学习型、桌面优先；Dark Mode 优先，支持 Dark/Light 切换。
- FR-UI-03 Beginner Mode：开启后每步显示更详细说明（如逐步解释 `current=current->next` 的含义）。

## 10. 非功能需求

- NFR-01 TypeScript strict 模式，禁止 `any` 绕过类型错误。
- NFR-02 核心算法与 UI 解耦：算法/步骤生成不写在 React 组件中。
- NFR-03 每阶段流水线：lint + typecheck + unit/integration test + build 全绿才可进入下一阶段。
- NFR-04 无人值守可构建：`npm ci && npm run verify` 一条命令完成质量验证。
- NFR-05 教学规模性能：n≤64 的排序步骤生成 < 200ms；页面操作无明显卡顿（<100ms 交互反馈）。
- NFR-06 数据安全：所有存储写入失败必须有用户可见的错误提示，不得静默吞异常。

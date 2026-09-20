# TEST_PLAN.md — 测试计划

## 1. 流水线（每 Phase 结束必须全绿）

```
npm run lint        # eslint（含边界规则：core 禁 react、题库外禁硬编码题目）
npm run typecheck   # tsc --noEmit（strict）
npm run test        # vitest run（单元 + 集成，jsdom 环境）
npm run build       # vite 生产构建
```
合成命令：`npm run verify`。失败必须修复后重跑；禁止删测试/skip/any/吞异常换通过。

## 2. 单元测试矩阵（`src/**/*.test.ts`，与源码同目录）

### 数据结构（每项含 正常 + 边界 + 错误路径）
- SeqList：初始化、尾插、任意位插（0/size/中间）、越界插删、删除、查找（存在/不存在）、修改、遍历、扩容触发与容量翻倍、destroy 步骤存在。
- 单链表：空链表操作、头插、尾插、中间插、删头、删尾、删不存在值、查找、修改、遍历序列、destroy（每个节点 free 步骤数 = 节点数）。
- 双向链表：插入后 prev/next 双向一致（前向与后向遍历互逆）、删除、边界。
- 栈：push/pop/top/isEmpty；顺序栈溢出（isFull 报错）；空栈 pop 报错；括号匹配（匹配/不匹配/左多/右多/嵌套）。
- 队列：enqueue/dequeue/front/rear、空队列出队报错；循环队列：满（留一空位）、空、**wrap-around（rear 回绕）**、顺序队列假溢出演示数据。
- 二叉树：先/中/后/层序结果正确（多棵树，含单节点、斜树、完全树）；遍历步骤的 CallStack 压栈/出栈平衡。
- BST：insert（重复值策略）、search（存在/不存在/空树）、delete 三情形（叶/单子/双子）+ 删除根 + 级联（删后仍为 BST，用中序严格递增断言）。
- 堆：insert/维持堆性质（父 ≥/≤ 子 全量断言）、deleteTop、heapify 自底向上、随机数组建堆性质成立；Max/Min 两模式。
- 图：邻接矩阵与邻接表一致性、增删点边（含级联删边）、DFS/BFS 序列（多图：连通/非连通/有环/有向）、visited 无重复访问。
- 查找：顺序查找（存在/不存在/空）；二分查找：存在、不存在、首元素、末元素、空数组、单元素、无序数组时结果未定义的告警步骤存在。

### 排序（每种算法）
- 数据集：`[]`、`[1]`、`[2,1]`、`[1,2]`、`[3,2,1]`、重复值 `[5,1,5,1,5]`、负数 `[-3,7,-1,0]`、随机 20 个（固定种子）。
- 断言：结果 === `[...input].sort((a,b)=>a-b)`；步骤版终态一致；comparisons/swaps 计数与步骤中事件计数一致；稳定性标注与算法声明一致。
- 额外：quick/merge 的 pivot/range 步骤存在；shell 的 gap 序列步骤存在。

### 可视化引擎
- Playback：next 到末尾自动暂停；prev 回到 -1（初始态）；jumpTo 夹取；restart；速度档位映射间隔；index=-1 渲染 beforeState。
- Step 不变量：id 连续、beforeState/afterState 均存在、codeLine 在 [0, lines] 范围。
- 快照不可变：修改 afterState 不影响后续步骤（深断言）。
- 同步性（集成）：抽样操作（链表插入/删除、BST 删除、排序）遍历全部步骤，断言 codeLine 有效且高亮 id 存在于 state 元素集合。

### 练习系统
- 8 种题型判分：全对/全错/多选漏选/填空多候选/补全部分对；解析展示。
- 题库完整性：id 全局唯一、每章 ≥ 6 题、题型覆盖、answer 与 options 结构匹配（单选 answer ∈ options 等）。

### 判题
- 比对规范化：CRLF/LF、行尾空格、末尾换行（等价组）与严格差异组（中间空行、大小写、行内空格）。
- 状态判定：CE/RE/TLE/WA/AC 的纯逻辑分支（runner 结果 → 状态映射）。

### 存储层
- CRUD 全仓库；migration：空库→最新、v(n-1)→vn、幂等重跑。
- 掌握度规则边界（p/n 组合全表）。
- 连续学习天数计算（连续/中断/跨午夜）。
- 浏览器后端：IndexedDB 读写（fake-indexeddb）。

## 3. 集成测试（`tests/`）

- 学习闭环：读章节→答对/答错题目→错题本出现→重练→标记掌握→掌握度变化。
- 判题闭环（有 gcc 的环境跑，否则自动 skip 并标注）：参考答案 AC；错误答案 WA 展示 diff；死循环 TLE。
- 页面冒烟：App 路由渲染（首页/课程 Ch3/实验室/题库/错题本/统计/设置），核心交互（播放 next/prev、答题提交）用 @testing-library。

## 4. 构建验证

- `vite build` 产物存在且 > 阈值；`tsc --noEmit` 零错误。
- Electron（若安装）：`electron . --smoke` 启动即退出返回 0。

## 5. 覆盖标准

- `core/`（数据结构/算法/recorder）：语句覆盖 ≥ 90%（vitest coverage）。
- `storage/`、`exercises/`（判分）、`judge/`（比对）≥ 85%。
- UI 组件不设硬指标，但关键交互有冒烟测试。

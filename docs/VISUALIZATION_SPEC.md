# VISUALIZATION_SPEC.md — 可视化规格

## 1. 引擎架构

```
Operation(数据结构操作/算法)
   ↓ 产生
Step[]（不可变步骤序列，含快照）
   ↓ 交由
PlaybackController（usePlayback：index/playing/speed 定时推进）
   ↓ 驱动
Renderer（按 afterState + highlight 渲染 SVG/DOM）+ CodePanel（行高亮）+ VariablesPanel / MemoryPanel / CallStackPanel
```

禁止：页面自建动画循环、用 CSS transition 模拟步骤、Previous 时"反向猜测"。

## 2. Step 模型（`src/core/types.ts`）

```ts
interface Step<S = unknown> {
  id: number;                 // 从 0 递增
  type: StepType;             // 见 §3
  title: string;              // 短标题，如 "current->next = newNode"
  description: string;        // 标准解释（中文）
  beginnerNote?: string;      // 新手模式详细解释
  codeLine: number;           // 对应 C 代码 1-based 行号（0 表示无对应）
  variables: VarSnapshot[];   // 变量监视快照
  memory: MemorySnapshot;     // 内存面板快照（变量/地址/值/指针箭头）
  callStack?: CallFrame[];    // 调用栈快照（递归类操作）
  highlight: string[];        // 需高亮的视觉元素 id（节点/下标/边）
  beforeState: S;             // 执行前快照（不可变）
  afterState: S;              // 执行后快照（不可变）
  metrics?: Metrics;          // comparisons/swaps/visits 等计数
}
```

`VarSnapshot = { name: string; type: string; value: string | null; refTarget?: string }`
（`value: null` 表示 NULL，渲染为 `NULL` 灰色；`refTarget` 指向元素 id 用于画箭头。）

`MemorySnapshot = { cells: MemCell[]; label: '模拟地址' }`，`MemCell = { id; name; addr; value; dtype; freed? }`。

## 3. StepType 枚举

`init | create | assign | compare | swap | insert | delete | free | call | return | visit | mark | move | grow | wraparound | error | info`

（排序用 compare/swap/mark；链表用 create/assign/move/free；递归用 call/return/visit；循环队列用 wraparound；越界等失败用 error。）

## 4. 播放控制器（`visualization/engine/usePlayback.ts`）

- 状态：`steps`、`index`（当前步，-1 表示尚未开始/初始态）、`playing`、`speed`。
- 动作：play / pause / toggle / next / prev / restart / jumpTo(i) / setSpeed(x)。
- 速度档位：0.25 / 0.5 / 1 / 2 / 4，基准步进间隔 1200ms/x。
- 渲染约定：`index === -1` 渲染 `steps[0].beforeState`；`index >= 0` 渲染 `steps[index].afterState`；高亮/变量/代码行取 `steps[index]`（index=-1 时不高亮）。
- 回退：直接渲染目标步快照（快照法），O(1)，确定性。
- 边界：next 到末尾自动 pause；jumpTo 夹取到 [-1, len-1]。

## 5. 渲染器规格（`visualization/renderers/`）

### 5.1 ArrayView（数组/顺序表）
- 单元格横排：`[1][2][3][4][5]`，上方 index、格内 value。
- 状态样式：normal / comparing（黄）/ swapping（红闪）/ sorted（绿底）/ pivot（紫边）/ current-write（蓝）。
- 写操作突出：`index=2`，旧值 3 划线 → 新值 10。
- 附 `size/capacity` 标尺与已用/空闲区（顺序表）。

### 5.2 ListView（单/双向链表）
- 节点双格 `[data|next]`（双向 `[prev|data|next]`），尾节点 next 显示 `NULL`（斜杠/地面符号）。
- 指针箭头：head/current/prev/newNode 用带标签箭头指向节点；多指针可并列（上下错开）。
- 插入/删除时：新箭头先以虚线出现（before 态）→ 实线化（after 态）；被断开的旧箭头淡出。
- 高亮正在改写的指针字段（格子内 next 格闪烁）。

### 5.3 StackView
- 垂直堆叠帧；push 自顶入、pop 自顶出；显示 top 指示；溢出时红框警示（顺序栈）。

### 5.4 QueueView
- 顺序/循环队列：环形布局（capacity 格圆环）或线性带 front/rear 游标；wrap-around 时箭头从尾部跳回头部并高亮。
- 链队列：节点横排 + front/rear 标签箭头。

### 5.5 TreeView / BSTView
- 自动布局：中序位置定 x，深度定 y（tidy 布局的简化版，节点不重叠即可）。
- 遍历高亮：当前访问节点描边 + 已访问序列展示（如 `8 3 1 6 10`）。
- CallStack 面板同步显示 `preorder(8)` → `preorder(3)` …。

### 5.6 HeapView
- 数组柱状/格 + 对应二叉树双视图同步；父子边高亮（上滤/下滤路径）。

### 5.7 GraphView
- 力导向/固定网格坐标 + 节点可拖动（pointer events，坐标存于模型）。
- 增删点、增删边（点击两点连边）；DFS 栈/BFS 队列面板；visited/current/next 三色。

### 5.8 BarsView（排序）
- 柱状图：高度=value；比较对高亮黄、交换红、已排序绿、pivot 紫、merge range 背景色带。
- 计数条：Comparisons / Swaps / Steps 实时显示。
- Compare Mode：2–3 个算法并排（独立 playback 但共享步进节拍：以"步"对齐，各自渲染各自 steps[i]，到各自末尾停住）。

### 5.9 MemoryPanel / CallStackPanel / VariablesPanel / CodePanel
- MemoryPanel：表格式 变量名/模拟地址/值 + 指针箭头连线；显著位置标注"教学模拟地址"。
- CallStack：自底向上帧列表，压栈动画进入、出栈淡出；帧含函数名与参数。
- CodePanel：C 代码 + 行号；当前行高亮（左侧三角+底色）；行级解释（title 属性 + Beginner Mode 展开区）。

## 6. 同步性验收（对应 JUDGE/TEST）

对任一步 i：CodePanel 高亮行 = steps[i].codeLine；变量面板 = steps[i].variables；画面 = steps[i].afterState + steps[i].highlight。集成测试遍历全部步骤断言三者存在且一致（codeLine 在代码行范围内）。

## 7. 性能

- 步骤生成在操作调用时一次性完成；播放期零计算（只查表渲染）。
- n≤64 排序步骤 ≤ ~5000 步，快照采用数组 slice（64 长度）≈ 可忽略内存。

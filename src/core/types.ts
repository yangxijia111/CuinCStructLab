/**
 * 核心类型定义：Step 模型与全部可视化状态（VISUALIZATION_SPEC.md §2）。
 * 本文件属于 core 层：禁止依赖 React / UI / 平台模块。
 */

/* ============ Step 模型 ============ */

/** 步骤类型（语义见 VISUALIZATION_SPEC §3） */
export type StepType =
  | 'init' // 初始化
  | 'create' // 创建节点/对象
  | 'assign' // 赋值（含指针改写）
  | 'compare' // 比较
  | 'swap' // 交换
  | 'insert' // 插入完成
  | 'delete' // 删除完成
  | 'free' // 释放内存
  | 'call' // 函数调用压栈
  | 'return' // 函数返回出栈
  | 'visit' // 访问节点
  | 'mark' // 标记（已排序区等）
  | 'move' // 指针移动
  | 'grow' // 扩容
  | 'wraparound' // 循环队列回绕
  | 'error' // 操作失败（越界/空栈等）
  | 'info'; // 说明性步骤

/** 变量监视快照中的一个变量 */
export interface VarSnapshot {
  name: string;
  kind: 'int' | 'pointer' | 'index' | 'bool' | 'size' | 'other';
  /** null 表示 NULL 指针；数值显示为十进制字符串；地址显示为 0x 格式 */
  value: string | null;
  /** 指针变量指向的可视化元素 id（用于画箭头） */
  refTarget?: string;
}

/** 内存面板单元格（教学模拟地址，非真实系统地址） */
export interface MemCell {
  id: string;
  name: string;
  addr: string;
  value: string;
  dtype: string;
  freed?: boolean;
}

export interface MemorySnapshot {
  cells: MemCell[];
  /** 面板显著标注：教学模拟地址 */
  simulated: true;
}

/** 递归调用栈帧 */
export interface CallFrame {
  fn: string;
  detail?: string;
}

/** 算法计数器 */
export interface StepMetrics {
  comparisons: number;
  swaps: number;
  visits?: number;
}

/** 通用步骤。S 为该操作家族的可视化状态类型。 */
export interface Step<S = VisualState> {
  id: number;
  type: StepType;
  title: string;
  description: string;
  /** 新手模式附加的更详细解释 */
  beginnerNote?: string;
  /** 对应教学 C 代码行（1-based；0 表示无对应行） */
  codeLine: number;
  variables: VarSnapshot[];
  memory: MemorySnapshot;
  callStack: CallFrame[];
  /** 需要高亮的可视化元素 id */
  highlight: string[];
  beforeState: S;
  afterState: S;
  metrics?: StepMetrics;
}

/* ============ 可视化状态（discriminated union on kind） ============ */

/** 数组/顺序表格子标记 */
export type CellFlag =
  | 'comparing' // 正在比较
  | 'swapping' // 正在交换
  | 'sorted' // 已就位/已排序区
  | 'pivot' // 基准元素
  | 'writing' // 正在写入
  | 'visited' // 已访问
  | 'inRange' // 当前处理区间（merge range 等）
  | 'removed'; // 逻辑删除（显示划线）

export interface ArrayCell {
  id: string;
  /** null 表示空槽（顺序表未使用区间） */
  value: number | null;
  flags: CellFlag[];
}

/** 数组 / 顺序表 / 排序柱状图 共用状态 */
export interface ArrayState {
  kind: 'array';
  label: string; // 显示名，如 "a" / "L.data"
  cells: ArrayCell[];
  /** 有效元素个数（纯数组 = cells.length；顺序表可小于 capacity） */
  size: number;
  capacity: number;
  /** 当前处理区间（merge sort 等），闭区间下标 */
  range?: [number, number];
  /** 模拟内存：下一个分配地址（跨操作保持递增） */
  nextAddr: number;
  /** 节点/元素序号发生器 */
  seq: number;
}

/** 链表节点（单向/双向统一） */
export interface ListNodeV {
  id: string;
  /** 头节点（哨兵）为 null */
  value: number | null;
  freed?: boolean;
  /** 不在主链上（新建未接线 / 被绕过待释放），渲染在链下方 */
  floating?: boolean;
}

/** 链表上的命名指针（current/prev/newNode/front/rear...） */
export interface PointerLabel {
  name: string;
  /** 指向的节点 id；null 表示 NULL */
  target: string | null;
  /** ghost: 新箭头尚未接通（虚线展示） */
  ghost?: boolean;
  /** dying: 即将断开的旧箭头（淡出展示） */
  dying?: boolean;
}

/** 单向/双向链表状态 */
export interface ListState {
  kind: 'list';
  /** 按链顺序排列的节点（含哨兵头节点，若有） */
  nodes: ListNodeV[];
  /** 是否带头节点（哨兵）。若有，nodes[0] 为哨兵 */
  sentinel: boolean;
  /** 双向链表标记 */
  doubly: boolean;
  pointers: PointerLabel[];
  nextAddr: number;
  seq: number;
}

/** 栈状态（顺序栈/链栈共用；frames 自底向上） */
export interface StackState {
  kind: 'stack';
  frames: { id: string; label: string }[];
  /** 顺序栈容量；链栈为 undefined */
  capacity?: number;
  /** 触发溢出提示 */
  overflow?: boolean;
  impl: 'array' | 'linked';
  nextAddr: number;
  seq: number;
}

/** 循环队列状态（环形格子） */
export interface QueueState {
  kind: 'queue';
  /** 环形槽位；null 为空槽 */
  slots: ({ id: string; value: number } | null)[];
  /** front 指向队头元素下标；rear 指向下一个入队位置（留一空位判满） */
  front: number;
  rear: number;
  capacity: number;
  impl: 'circular' | 'array' | 'linked';
  /** 链队列节点（impl=linked 时使用） */
  linkedNodes?: ListNodeV[];
  nextAddr: number;
  seq: number;
}

/** 树节点 */
export interface TreeNodeV {
  id: string;
  value: number;
  left: string | null;
  right: string | null;
  freed?: boolean;
}

/** 二叉树 / BST 状态 */
export interface TreeState {
  kind: 'tree';
  nodes: Record<string, TreeNodeV>;
  root: string | null;
  /** 命名指针（current/parent/child 等） */
  pointers: PointerLabel[];
  /** 遍历已访问的节点 id 序列 */
  visitOrder?: string[];
  /** 当前遍历输出值序列（展示 8 3 1 …） */
  visitValues?: number[];
  /** 层序遍历辅助队列内容（节点 id） */
  frontier?: string[];
  nextAddr: number;
  seq: number;
}

/** 堆状态：数组顺序（层序）+ 比较模式 */
export interface HeapState {
  kind: 'heap';
  /** 层序节点（同时是数组下标顺序） */
  order: string[];
  nodes: Record<string, TreeNodeV>;
  root: string | null;
  compare: 'max' | 'min';
  nextAddr: number;
  seq: number;
}

/** 图节点（坐标用于渲染与拖动） */
export interface GraphNodeV {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  weight?: number;
}

/** 图状态 */
export interface GraphState {
  kind: 'graph';
  nodes: Record<string, GraphNodeV>;
  edges: GraphEdge[];
  directed: boolean;
  representation: 'matrix' | 'list';
  /** 已访问（visit 完成）的节点 id */
  visited: string[];
  /** 当前正在处理的节点 id */
  current: string | null;
  /** 正在考察的邻居 id */
  next: string | null;
  /** DFS 栈 / BFS 队列 内容（自底向上） */
  frontier: string[];
  frontierKind: 'stack' | 'queue' | null;
  seq: number;
}

/** 全部可视化状态 */
export type VisualState =
  | ArrayState
  | ListState
  | StackState
  | QueueState
  | TreeState
  | HeapState
  | GraphState;

/* ============ 教学结果 ============ */

/**
 * 一次可视化操作的返回：步骤序列 + 是否以错误结束。
 * 约定：若操作失败，最后一步 type === 'error' 且 afterState === beforeState。
 */
export interface VizOutcome<S> {
  steps: Step<S>[];
  ok: boolean;
  /** 失败原因（ok=false 时） */
  error: string | null;
}

export type OpStatus = 'ok' | 'error';

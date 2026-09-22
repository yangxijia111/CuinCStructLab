/**
 * 差分测试类型定义（DIFFERENTIAL_TEST_SPEC §2）。
 * 本目录（除 node/）禁止依赖 Node API，保证可被任意环境复用且不进浏览器 bundle。
 */

/** 受支持的结构 id（数据结构 + 排序 + 查找） */
export type StructureId =
  | 'seqlist'
  | 'linked-list'
  | 'doubly-list'
  | 'stack'
  | 'circular-queue'
  | 'bst'
  | 'heap'
  | 'graph'
  | 'sorting'
  | 'binary-search';

/** 一条操作：op 为结构相关操作名，args 为参数（数字/字符串） */
export interface Operation {
  op: string;
  args: Array<number | string>;
}

/** 初始状态（判别联合；structure 决定解释） */
export interface StructureInit {
  structure: StructureId;
  /** 线性/树/堆：初始值序列；队列容量；图：见 graph 字段 */
  values?: number[];
  /** 容量类结构（顺序表/栈/循环队列/堆 max 容量固定） */
  capacity?: number;
  /** 堆比较方向 */
  compare?: 'max' | 'min';
  /** 图：顶点标签（按序编号 = 差分约定的邻接升序） */
  labels?: string[];
  /** 图：边列表（标签对，u→v；无向图双向） */
  edges?: Array<[string, string]>;
  /** 图：是否有向 */
  directed?: boolean;
}

/** 语义状态（canonical 投影；禁止地址/节点 id） */
export interface SemanticState {
  /** 结构标识（宽松字符串：C 侧解析初值为 'unknown'，最终由 suite 语义字段比较） */
  kind: string;
  values?: number[];
  size?: number;
  backward?: number[];
  full?: 0 | 1;
  empty?: 0 | 1;
  heapProperty?: 0 | 1;
  inorder?: number[];
  order?: number[];
  foundIndex?: number;
}

/** 单个差分用例 */
export interface DifferentialCase {
  structure: StructureId;
  /** 可复现种子（随机用例必填；定向用例可为 0） */
  seed: number;
  initial: StructureInit;
  operations: Operation[];
  /** 定向用例可给期望；随机用例省略（TS/C 互为 oracle） */
  expectedSemanticState?: SemanticState;
}

/** TS 侧执行结果 */
export interface TsRunResult {
  state: SemanticState;
  /** 查询类操作的中途观察（与 C 侧 OBS 行一一对应） */
  observations: string[];
}

/** C 侧单个 case 的解析结果 */
export interface CCaseOutput {
  index: number;
  state: SemanticState;
  observations: string[];
}

/** 差分比较结果 */
export interface DiffCaseResult {
  pass: boolean;
  caseIndex: number;
  seed: number;
  /** 首个差异描述（失败时） */
  firstDiff: string | null;
  ts: TsRunResult | null;
  c: CCaseOutput | null;
}

/** 结构差分套件接口（每结构实现三件套） */
export interface StructureSuite {
  id: StructureId;
  /** 生成随机用例（由 seed 完全确定） */
  generateCases(seed: number, count: number): DifferentialCase[];
  /** TS 侧执行（调用 src/core 真实实现） */
  runTs(c: DifferentialCase): TsRunResult;
  /** 生成 C 程序源码（教学 C 代码 + main；一次编译跑全部 case） */
  generateC(cases: DifferentialCase[]): string;
}

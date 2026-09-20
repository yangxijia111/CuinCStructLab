/**
 * StepRecorder：步骤记录器（快照法，VISUALIZATION_SPEC §2/§4）。
 * SimMem：教学模拟内存面板模型（DATA_STRUCTURE_SPEC §10）。
 * 地址均为教学用模拟地址（0x1000 起步），不代表真实系统内存。
 */
import type {
  CallFrame,
  MemorySnapshot,
  MemCell,
  Step,
  StepMetrics,
  StepType,
  VarSnapshot,
  VisualState,
  VizOutcome,
} from './types';

/* ============ 模拟内存 ============ */

const OBJECT_SIZE = 16; // 教学约定：每个堆对象占 16 字节（对齐展示）
const VAR_SIZE = 8; // 每个变量占 8 字节

function toHex(addr: number): string {
  return '0x' + addr.toString(16).padStart(4, '0');
}

/**
 * 教学模拟内存：只用于内存面板展示，绝不冒充真实地址。
 * 变量区（低地址）与堆对象区（高地址）分开，模拟"栈区/堆区"的直觉。
 */
export class SimMem {
  private readonly objects = new Map<string, MemCell>();
  private readonly vars = new Map<string, MemCell>();
  /** 下一个堆对象地址 */
  private heapPtr: number;
  /** 下一个变量地址（从低处开始，向高生长） */
  private varPtr: number;

  constructor(startHeapAddr = 0x8000, startVarAddr = 0x2000) {
    this.heapPtr = startHeapAddr;
    this.varPtr = startVarAddr;
  }

  /** 在堆上分配一个对象（节点/数组等），返回模拟地址 */
  allocObject(id: string, name: string, value: string, dtype: string): string {
    const addr = toHex(this.heapPtr);
    this.heapPtr += OBJECT_SIZE;
    this.objects.set(id, { id, name, addr, value, dtype });
    return addr;
  }

  /** 定义/更新一个变量（可带指向对象 id 用于箭头连线） */
  defineVar(name: string, value: string | null, dtype: string): void {
    const existing = this.vars.get(name);
    if (existing !== undefined) {
      existing.value = value === null ? 'NULL' : value;
      return;
    }
    const addr = toHex(this.varPtr);
    this.varPtr += VAR_SIZE;
    this.vars.set(name, { id: 'var:' + name, name, addr, value: value === null ? 'NULL' : value, dtype });
  }

  removeVar(name: string): void {
    this.vars.delete(name);
  }

  /** 查询对象地址（供指针变量的值） */
  addrOf(id: string): string | null {
    const cell = this.objects.get(id);
    return cell === undefined ? null : cell.addr;
  }

  /** 下一个堆地址（操作结束时写回 state.nextAddr，保证跨操作地址递增） */
  get heapTop(): number {
    return this.heapPtr;
  }

  /** 更新对象的值描述（节点值变化/next 变化等） */
  setObjectName(id: string, name: string): void {
    const cell = this.objects.get(id);
    if (cell !== undefined) cell.name = name;
  }

  /** 更新对象的值描述文本 */
  setObjectValue(id: string, value: string): void {
    const cell = this.objects.get(id);
    if (cell !== undefined && !cell.freed) cell.value = value;
  }

  /** 释放堆对象：标记 freed，地址不复用（杜绝悬垂地址歧义） */
  freeObject(id: string): void {
    const cell = this.objects.get(id);
    if (cell !== undefined && !cell.freed) {
      cell.freed = true;
      cell.value = '(已释放)';
    }
  }

  /** 从面板彻底移除（用于清空/destroy 后的整洁展示，仍保留 free 历史） */
  dropObject(id: string): void {
    this.objects.delete(id);
  }

  snapshot(): MemorySnapshot {
    const cells: MemCell[] = [];
    for (const cell of this.vars.values()) cells.push({ ...cell });
    for (const cell of this.objects.values()) cells.push({ ...cell });
    return { cells, simulated: true };
  }
}

/* ============ 步骤记录器 ============ */

export interface RecordInput<S> {
  type: StepType;
  title: string;
  description: string;
  beginnerNote?: string;
  /** 对应教学 C 代码行（1-based），默认 0 */
  codeLine?: number;
  variables?: VarSnapshot[];
  memory?: MemorySnapshot;
  callStack?: CallFrame[];
  highlight?: string[];
  metrics?: StepMetrics;
  /** 对克隆出的下一状态进行变更（保持快照不可变） */
  mutate?: (draft: S) => void;
}

/** 递归冻结（含数组）；VisualState 无循环引用，深度安全 */
function deepFreeze<T>(obj: T): T {
  if (obj !== null && typeof obj === 'object') {
    Object.freeze(obj);
    for (const value of Object.values(obj as Record<string, unknown>)) {
      deepFreeze(value);
    }
  }
  return obj;
}

/**
 * 使用方式：
 *   const rec = new StepRecorder(initialState);
 *   rec.record({ ...meta, mutate: (s) => { s.xxx = yyy; } });
 *   return rec.finish();
 *
 * 每步状态经 structuredClone 深拷贝；finish() 时全部步骤递归冻结，
 * 任何对已记录快照的意外写入都会直接抛 TypeError（防御性不可变）。
 */
export class StepRecorder<S extends VisualState> {
  private readonly steps: Step<S>[] = [];
  private current: S;

  constructor(initial: S) {
    this.current = structuredClone(initial);
  }

  /** 当前（最新）状态，只读用途 */
  get state(): S {
    return this.current;
  }

  /** 记录一步（可附带状态变更） */
  record(input: RecordInput<S>): void {
    const before = this.current;
    const after = structuredClone(before) as S;
    input.mutate?.(after);
    this.steps.push({
      id: this.steps.length,
      type: input.type,
      title: input.title,
      description: input.description,
      beginnerNote: input.beginnerNote,
      codeLine: input.codeLine ?? 0,
      variables: input.variables ?? [],
      memory: input.memory ?? { cells: [], simulated: true },
      callStack: input.callStack ?? [],
      highlight: input.highlight ?? [],
      beforeState: before,
      afterState: after,
      metrics: input.metrics,
    });
    this.current = after;
  }

  /** 记录失败步骤（状态不变） */
  fail(title: string, description: string, codeLine = 0): void {
    this.record({ type: 'error', title, description, codeLine });
  }

  /** 直接追加一条已构造好的步骤（id 自动重排；用于复用其他操作生成的步骤） */
  appendRaw(step: Step<S>): void {
    const clone = structuredClone(step);
    clone.id = this.steps.length;
    // 当前状态推进到该步骤的终态
    this.current = clone.afterState;
    this.steps.push(clone);
  }

  /** 结束并返回结果。ok = 最后一步不是 error。返回前冻结全部步骤。 */
  finish(): VizOutcome<S> {
    const last = this.steps[this.steps.length - 1];
    const ok = last === undefined || last.type !== 'error';
    for (const step of this.steps) deepFreeze(step);
    return {
      steps: this.steps,
      ok,
      error: ok ? null : (last.description ?? null),
    };
  }
}

/* ============ 变量快照便捷构造 ============ */

export function intVar(name: string, value: number | null): VarSnapshot {
  return { name, kind: 'int', value: value === null ? null : String(value) };
}

export function indexVar(name: string, value: number | null): VarSnapshot {
  return { name, kind: 'index', value: value === null ? null : String(value) };
}

export function boolVar(name: string, value: boolean | null): VarSnapshot {
  return { name, kind: 'bool', value: value === null ? null : value ? 'true' : 'false' };
}

export function sizeVar(name: string, value: number): VarSnapshot {
  return { name, kind: 'size', value: String(value) };
}

/** 指针变量快照；addrStr 为模拟地址字符串，targetId 用于画箭头 */
export function ptrVar(name: string, addrStr: string | null, targetId?: string | null): VarSnapshot {
  return {
    name,
    kind: 'pointer',
    value: addrStr,
    refTarget: targetId ?? undefined,
  };
}

export function otherVar(name: string, value: string | null): VarSnapshot {
  return { name, kind: 'other', value };
}

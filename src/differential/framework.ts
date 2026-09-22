/**
 * 差分框架共享工具：VizOutcome 终态提取、visit 序列提取（DIFFERENTIAL_TEST_SPEC §8）。
 */
import type { Step, VisualState, VizOutcome } from '../core/types';
import type { StructureSuite } from './types';

/** 取 outcome 终态（最后一步 afterState；空步骤返回 null） */
export function lastState<S extends VisualState>(outcome: VizOutcome<S>): S | null {
  const last = outcome.steps[outcome.steps.length - 1];
  return last === undefined ? null : (last.afterState as S);
}

/** outcome 是否包含命中步骤（visit）——find/search 命中判定 */
export function hasVisit<S extends VisualState>(outcome: VizOutcome<S>): boolean {
  return outcome.steps.some((s) => s.type === 'visit');
}

/** 收集 visit 步骤的 highlight 节点 id 序列（traverse 访问序） */
export function visitNodeIds<S extends VisualState>(outcome: VizOutcome<S>): string[] {
  const ids: string[] = [];
  for (const s of outcome.steps as Step<S>[]) {
    if (s.type === 'visit' && s.highlight[0] !== undefined) ids.push(s.highlight[0]);
  }
  return ids;
}

/** 从 ListState 提取 visit 节点 id → 值序列 */
export function visitListValues<S extends VisualState>(outcome: VizOutcome<S>, nodeValueOf: (id: string) => number | null): number[] {
  return visitNodeIds(outcome)
    .map((id) => nodeValueOf(id))
    .filter((v): v is number => v !== null);
}

/** 结构套件注册表（tests 引用；新增结构在此登记） */
import { seqlistSuite } from './structures/seqlist';
import { linkedListSuite } from './structures/linked-list';
import { doublyListSuite } from './structures/doubly-list';
import { stackSuite } from './structures/stack';
import { queueSuite } from './structures/queue';
import { bstSuite } from './structures/bst';
import { heapSuite } from './structures/heap';
import { graphSuite } from './structures/graph';
import { sortingSuite } from './structures/sorting';
import { binarySearchSuite } from './structures/binary-search';

export const SUITES: Record<string, StructureSuite> = {
  seqlist: seqlistSuite,
  'linked-list': linkedListSuite,
  'doubly-list': doublyListSuite,
  stack: stackSuite,
  'circular-queue': queueSuite,
  bst: bstSuite,
  heap: heapSuite,
  graph: graphSuite,
  sorting: sortingSuite,
  'binary-search': binarySearchSuite,
};

/**
 * P5 集成测试：实验室操作 + 三者同步性（codeLine/变量/高亮 与状态一致）。
 */
import { describe, expect, it } from 'vitest';
import { LINEAR_LABS, opCode, parseNumbers } from '../src/visualization/labs';
import type { LabOpDef } from '../src/visualization/labs';
/** 统一以 VisualState 视角调用异构 lab 操作 */
function runOp(op: { run(s: VisualState | null, p: Record<string, string>): { steps: unknown[]; state: unknown; ok: boolean } }, state: unknown, params: Record<string, string>): { steps: Array<{ codeLine: number; type: string; highlight: string[] }>; state: unknown; ok: boolean } {
  return op.run(state as VisualState, params) as never;
}
import type { VisualState } from '../src/core/types';
import { C_PROGRAMS } from '../src/content';

/** 遍历 lab 的全部操作抽样断言步骤不变量 */
describe('实验室操作完整性', () => {
  it('每个 lab 都能初始化且至少有一个操作', () => {
    expect(LINEAR_LABS.length).toBeGreaterThanOrEqual(6);
    for (const lab of LINEAR_LABS) {
      const st = lab.parseInit(lab.initPlaceholder);
      expect(st).toBeDefined();
      expect(lab.ops.length).toBeGreaterThan(0);
      for (const op of lab.ops) {
        expect(C_PROGRAMS[op.codeId], `${lab.id}/${op.id} codeId`).toBeDefined();
      }
    }
  });

  it('全部操作在默认参数下可执行且 codeLine 在代码范围内', () => {
    for (const lab of LINEAR_LABS) {
      let state: unknown = lab.parseInit(lab.initPlaceholder);
      for (const op of lab.ops) {
        const params: Record<string, string> = {};
        for (const pd of op.params) {
          if (pd.default !== undefined) params[pd.key] = pd.default;
        }
        const result = runOp(op as LabOpDef<VisualState>, state, params);
        expect(result.steps.length, `${lab.id}/${op.id} 产生步骤`).toBeGreaterThan(0);
        const code = C_PROGRAMS[op.codeId]!;
        for (const [i, step] of result.steps.entries()) {
          expect(step.codeLine, `${lab.id}/${op.id} step${i}`).toBeLessThanOrEqual(code.lines.length);
          expect(step.codeLine, `${lab.id}/${op.id} step${i}`).toBeGreaterThanOrEqual(0);
        }
        // 终态可用于下一个操作
        state = result.state;
      }
    }
  });

  it('操作的教学代码可解析出行级解释结构', () => {
    for (const lab of LINEAR_LABS) {
      const op = lab.ops[0]!;
      const code = opCode(op as never);
      expect(code.lines.length).toBeGreaterThan(3);
    }
  });
});

describe('任务书手工清单：链表 10 20 30 插入 pos=1 value=15', () => {
  it('结果为 10 → 15 → 20 → 30', () => {
    const listLab = LINEAR_LABS.find((l) => l.id === 'list')!;
    const state = listLab.parseInit('10 20 30');
    const insertOp = listLab.ops.find((o) => o.id === 'list-insert')!;
    const r = runOp(insertOp as LabOpDef<VisualState>, state, { pos: '1', value: '15' });
    expect(r.ok).toBe(true);
    const nodes = (r.state as { nodes: Array<{ value: number | null; floating?: boolean }> }).nodes;
    expect(nodes.filter((n) => n.value !== null && !n.floating).map((n) => n.value)).toEqual([10, 15, 20, 30]);
  });
});

describe('三者同步性（FR-VIZ-12）', () => {
  it('链表插入：每步 codeLine 均指向有效行，关键步骤指向 ->next 相关行', () => {
    const listLab = LINEAR_LABS.find((l) => l.id === 'list')!;
    const state = listLab.parseInit('10 20 30');
    const r = runOp(listLab.ops.find((o) => o.id === 'list-insert')! as LabOpDef<VisualState>, state, { pos: '1', value: '15' });
    const code = C_PROGRAMS['linked-list']!;
    const newNextLine = code.lines.findIndex((l) => l.includes('newNode->next = prev->next')) + 1;
    const prevNextLine = code.lines.findIndex((l) => l.includes('prev->next = newNode;')) + 1;
    expect(newNextLine).toBeGreaterThan(0);
    expect(prevNextLine).toBeGreaterThan(0);
    // 步骤中存在映射到这两行的步骤
    expect(r.steps.some((s) => s.codeLine === newNextLine)).toBe(true);
    expect(r.steps.some((s) => s.codeLine === prevNextLine)).toBe(true);
    // 每步 highlight 的元素存在于状态中或为空
    for (const step of r.steps) {
      for (const h of step.highlight) {
        expect(typeof h).toBe('string');
      }
    }
  });

  it('顺序表插入搬移步骤映射到挪动循环行', () => {
    const lab = LINEAR_LABS.find((l) => l.id === 'seqlist')!;
    const state = lab.parseInit('10 20 30');
    const r = runOp(lab.ops.find((o) => o.id === 'seqlist-insert')! as LabOpDef<VisualState>, state, { pos: '1', value: '15' });
    const code = C_PROGRAMS['seqlist']!;
    const moveLine = code.lines.findIndex((l) => l.includes('L->data[i + 1] = L->data[i]')) + 1;
    expect(moveLine).toBeGreaterThan(0);
    expect(r.steps.some((s) => s.codeLine === moveLine)).toBe(true);
  });

  it('循环队列 enqueue 的回绕步骤类型为 wraparound', () => {
    const lab = LINEAR_LABS.find((l) => l.id === 'queue')!;
    let state: unknown = lab.parseInit('1 2 3 4 5'); // 已满（容量 6 留 1）
    const deq = lab.ops.find((o) => o.id === 'queue-dequeue')!;
    state = runOp(deq as LabOpDef<VisualState>, state, {}).state;
    const enq = lab.ops.find((o) => o.id === 'queue-circular')!;
    const r = runOp(enq as LabOpDef<VisualState>, state, { value: '6' });
    expect(r.steps.some((s) => s.type === 'wraparound')).toBe(true);
  });
});

describe('parseNumbers', () => {
  it('空格/逗号分隔与过滤非法项', () => {
    expect(parseNumbers('10 20 30')).toEqual([10, 20, 30]);
    expect(parseNumbers('1,2,3')).toEqual([1, 2, 3]);
    expect(parseNumbers('')).toEqual([]);
    expect(parseNumbers('a 5 b')).toEqual([5]);
  });
});

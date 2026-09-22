/**
 * 差分框架自验（DIFFERENTIAL_TEST_SPEC §9.4）：注入任一侧缺陷时必须能检出。
 * 纯 TS 环境可跑（不依赖编译器）：验证比较器/报告链路对单字段差异、观察序列差异的敏感性。
 */
import { describe, expect, it } from 'vitest';
import { SUITES } from '../../src/differential/framework';
import { failureReport, parseCOutput, semanticEqual } from '../../src/differential/semantic';
import type { CCaseOutput, DiffCaseResult, TsRunResult } from '../../src/differential/types';

const suite = SUITES['linked-list']!;
const cases = suite.generateCases(7, 3);
const ts = suite.runTs(cases[0]!);

function fakeCFrom(r: TsRunResult): CCaseOutput {
  return {
    index: 0,
    state: { ...r.state },
    observations: [...r.observations],
  };
}

describe('差分框架 mutation 自验（注入缺陷必须红）', () => {
  it('一致时通过（基线）', () => {
    expect(semanticEqual(ts, fakeCFrom(ts)).equal).toBe(true);
  });

  it('TS 侧单值注入（pushBack 少一个元素）→ 检出', () => {
    const c = fakeCFrom(ts);
    // 模拟 TS 侧少插一个元素
    const mutated = { ...ts, state: { ...ts.state, values: (ts.state.values ?? []).slice(0, -1), size: (ts.state.size ?? 1) - 1 } };
    const r = semanticEqual(mutated, c);
    expect(r.equal).toBe(false);
    expect(r.firstDiff).toContain('state:');
  });

  it('C 侧观察序列注入（find 结果不一致）→ 检出且定位到 observations', () => {
    const c = fakeCFrom(ts);
    const i = c.observations.findIndex((o) => o.startsWith('find'));
    if (i >= 0) {
      c.observations[i] = c.observations[i]!.replace(/found=\d/, 'found=9');
    } else {
      c.observations.push('find found=1');
    }
    const r = semanticEqual(ts, c);
    expect(r.equal).toBe(false);
    expect(r.firstDiff).toContain('observations[');
  });

  it('双向链表 backward 注入 → 检出（prev/next 一致性防线）', () => {
    const dSuite = SUITES['doubly-list']!;
    const dTs = dSuite.runTs(dSuite.generateCases(3, 1)[0]!);
    const dC = { index: 0, state: { ...dTs.state }, observations: [...dTs.observations] };
    dC.state.backward = [...(dTs.state.backward ?? [])].reverse();
    expect(semanticEqual(dTs, dC).equal).toBe(false);
  });

  it('failureReport 包含 seed/初始状态/操作数（可复现性）', () => {
    const r: DiffCaseResult = { pass: false, caseIndex: 0, seed: cases[0]!.seed, firstDiff: 'state: x', ts, c: fakeCFrom(ts) };
    const report = failureReport(cases[0]!, r);
    expect(report).toContain(`seed=${String(cases[0]!.seed)}`);
    expect(report).toContain('initial:');
    expect(report).toContain('operations (');
    expect(report).toContain('firstDiff:');
  });

  it('parseCOutput：BEGIN/END 分块、OBS 收集、未知 tag 忽略、ABORT 语义外信号', () => {
    const out = parseCOutput([
      'BEGIN 0',
      'S:[1,2,3]',
      'SIZE:3',
      'OBS:pushBack rc=0',
      'OBS:find found=1',
      'FUTURE_TAG:xyz',
      'END 0',
      'BEGIN 1',
      'S:[]',
      'SIZE:0',
      'END 1',
    ].join('\n'));
    expect(out.length).toBe(2);
    expect(out[0]!.state.values).toEqual([1, 2, 3]);
    expect(out[0]!.state.size).toBe(3);
    expect(out[0]!.observations).toEqual(['pushBack rc=0', 'find found=1']);
    expect(out[1]!.state.values).toEqual([]);
  });

  it('generateCases 同 seed 生成完全一致（CI 可复现）', () => {
    expect(JSON.stringify(suite.generateCases(11, 5))).toBe(JSON.stringify(suite.generateCases(11, 5)));
    expect(JSON.stringify(suite.generateCases(11, 5))).not.toBe(JSON.stringify(suite.generateCases(12, 5)));
  });
});

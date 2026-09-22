/**
 * Node 专属：差分统一运行器（tests/differential 的唯一入口；差分逻辑不散落在各 test 文件）。
 * 流水线：generateCases → TS 执行 ∥ C 生成/编译/运行/解析 → 语义比较 → 聚合报告。
 */
import type { DiffCaseResult, StructureId } from '../types';
import { parseCOutput, semanticEqual } from '../semantic';
import { SUITES } from '../framework';
import { detectCompilerByKind, runCProgram, type CCompilerSpec } from './c-exec';

export interface DiffOptions {
  /** 固定种子（默认 20260922，CI 可复现） */
  seed?: number;
  /** 随机用例数（默认 100） */
  count?: number;
  /** 指定编译器（默认自动探测 gcc → clang → cl） */
  compiler?: CCompilerSpec;
}

export interface DiffReport {
  structure: StructureId;
  compiler: string;
  totalCases: number;
  failures: DiffCaseResult[];
  /** C 侧全局失败（编译错误/运行失败/输出不完整） */
  fatal: string | null;
  /** C 程序编译 + 运行总耗时 */
  durationMs: number;
}

export async function runDifferential(structure: StructureId, opts: DiffOptions = {}): Promise<DiffReport> {
  const suite = SUITES[structure];
  if (suite === undefined) throw new Error(`未知差分结构: ${structure}`);
  const seed = opts.seed ?? 20260922;
  const count = opts.count ?? 100;
  const compiler = opts.compiler ?? (await detectCompilerByKind('gcc')) ?? (await detectCompilerByKind('clang')) ?? (await detectCompilerByKind('cl'));
  if (compiler === null) {
    throw new Error('无可用的 C 编译器（差分测试需要真实编译环境）');
  }

  const cases = suite.generateCases(seed, count);
  const started = performance.now();

  // C 侧：一次编译跑全部 case
  const cResult = await runCProgram(suite.generateC(cases), compiler);
  if (!cResult.ok || cResult.compileError !== null) {
    return {
      structure,
      compiler: `${compiler.kind}(${compiler.path})`,
      totalCases: cases.length,
      failures: [],
      fatal: cResult.compileError ?? `C 程序运行异常 exit=${String(cResult.exitCode)}`,
      durationMs: performance.now() - started,
    };
  }
  const cOutputs = parseCOutput(cResult.stdout);
  if (cOutputs.length !== cases.length) {
    return {
      structure,
      compiler: `${compiler.kind}(${compiler.path})`,
      totalCases: cases.length,
      failures: [],
      fatal: `C 输出 case 数不匹配：期望 ${cases.length}，实际 ${cOutputs.length}（stdout 前 2000 字符：${cResult.stdout.slice(0, 2000)}）`,
      durationMs: performance.now() - started,
    };
  }

  // TS 侧逐 case 执行并比较
  const failures: DiffCaseResult[] = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]!;
    const ts = suite.runTs(c);
    const co = cOutputs[i]!;
    const eq = semanticEqual(ts, co);
    if (!eq.equal) {
      failures.push({ pass: false, caseIndex: i, seed: c.seed, firstDiff: eq.firstDiff, ts, c: co });
    }
  }
  return {
    structure,
    compiler: `${compiler.kind}(${compiler.path})`,
    totalCases: cases.length,
    failures,
    fatal: null,
    durationMs: performance.now() - started,
  };
}

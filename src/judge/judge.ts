/**
 * 判题状态机（JUDGE_SPEC §1）：AC / WA / CE / RE / TLE。
 */
import { firstDiffLine, outputMatches } from './compare';

export type JudgeStatus = 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'time_limit_exceeded';

export const JUDGE_STATUS_LABELS: Record<JudgeStatus, string> = {
  accepted: 'Accepted',
  wrong_answer: 'Wrong Answer',
  compile_error: 'Compile Error',
  runtime_error: 'Runtime Error',
  time_limit_exceeded: 'Time Limit Exceeded',
};

/** 单个测试用例的运行结果（来自 Runner；ProcessOutcome 字段为平台无关失败分类依据） */
export interface CaseRunResult {
  index: number;
  stdin: string;
  expected: string;
  actual: string;
  exitCode: number | null;
  /** 终止信号（SIGSEGV/SIGABRT/SIGKILL…；null=正常退出）。Windows 异常终止由 runner 映射为非零 exitCode */
  signal?: string | null;
  /** 启动失败（spawn error，如可执行文件缺失）：绝不判 Accepted */
  spawnError?: string | null;
  timedOut: boolean;
  durationMs: number;
}

/** 判题输入 */
export interface JudgeInput {
  /** 编译是否成功（exitCode !== 0 时为 CE，stderr 为编译信息） */
  compileExitCode: number;
  compileStderr: string;
  cases: CaseRunResult[];
  timeLimitMs: number;
}

/** 判题输出 */
export interface JudgeOutput {
  status: JudgeStatus;
  /** 首个失败用例（WA 时展示 输入/Expected/Actual） */
  failedCase: CaseRunResult | null;
  /** 差异行（WA 时） */
  diff: { lineNo: number; expected: string; actual: string } | null;
  /** 通过的用例数 */
  passedCount: number;
  totalCases: number;
  compileMessage: string;
}

export function judgeSubmission(input: JudgeInput): JudgeOutput {
  const totalCases = input.cases.length;
  if (input.compileExitCode !== 0) {
    return {
      status: 'compile_error',
      failedCase: null,
      diff: null,
      passedCount: 0,
      totalCases,
      compileMessage: input.compileStderr.slice(0, 8 * 1024),
    };
  }

  let passedCount = 0;
  for (const c of input.cases) {
    if (c.timedOut) {
      return {
        status: 'time_limit_exceeded',
        failedCase: c,
        diff: null,
        passedCount,
        totalCases,
        compileMessage: '',
      };
    }
    // 崩溃分类（平台无关）：启动失败 / 信号终止 / 非零退出码 —— 一律 Runtime Error，绝不允许进入输出比对
    const crashed =
      (c.spawnError !== null && c.spawnError !== undefined) ||
      (c.signal !== null && c.signal !== undefined) ||
      c.exitCode === null ||
      c.exitCode !== 0;
    if (crashed) {
      const why =
        c.spawnError !== null && c.spawnError !== undefined
          ? `spawn error = ${c.spawnError}`
          : c.signal !== null && c.signal !== undefined
            ? `signal = ${c.signal}`
            : `exit code = ${String(c.exitCode)}`;
      return {
        status: 'runtime_error',
        failedCase: c,
        diff: null,
        passedCount,
        totalCases,
        compileMessage: why,
      };
    }
    if (!outputMatches(c.expected, c.actual)) {
      return {
        status: 'wrong_answer',
        failedCase: c,
        diff: firstDiffLine(c.expected, c.actual),
        passedCount,
        totalCases,
        compileMessage: '',
      };
    }
    passedCount += 1;
  }

  return {
    status: 'accepted',
    failedCase: null,
    diff: null,
    passedCount,
    totalCases,
    compileMessage: '',
  };
}

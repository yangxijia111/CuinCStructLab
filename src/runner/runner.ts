/**
 * Runner 类型定义与运行环境桥（JUDGE_SPEC §4 / SECURITY.md）。
 *
 * 分层（单一实现原则）：
 *   - 本文件只包含：类型、桌面 IPC 桥调用、Node 实现注册钩子。
 *   - 真正的编译/运行逻辑唯一存在于 `electron/runner-core.cjs`（主进程 require），
 *     Node 测试环境通过 `registerNodeRunner` 注入同一实现，禁止再复制逻辑。
 *   - 浏览器模式：无桥也无注册实现 → detectCompilers 返回不可用并给出指引。
 *
 * 安全红线：本地 Runner ≠ 安全沙箱（见 SECURITY.md）。
 */
import type { CaseRunResult } from '../judge/judge';

export type CompilerKind = 'gcc' | 'clang' | 'cl';

export interface CompilerInfo {
  kind: CompilerKind;
  path: string;
  version: string;
}

export interface RunnerAvailability {
  available: boolean;
  /** 不可用原因与安装指引 */
  reason: string;
  installHint: string;
  compiler: CompilerInfo | null;
}

export interface CompileRunOutcome {
  compileExitCode: number;
  compileStdout: string;
  compileStderr: string;
  cases: CaseRunResult[];
  /** 临时目录是否清理成功 */
  cleaned: boolean;
}

/** Runner 载荷（IPC / Node 实现共用结构） */
export interface RunnerPayload {
  compiler: CompilerInfo;
  userCode: string;
  harness: string;
  cases: Array<{ stdin: string; expected: string }>;
  timeLimitMs: number;
}

/** Node 端 Runner 实现接口（由 electron/runner-core.cjs 提供的唯一实现） */
export interface NodeRunnerImplementation {
  detectCompiler(customPath?: string): Promise<RunnerAvailability>;
  compileAndRun(
    compiler: CompilerInfo,
    userCode: string,
    harness: string,
    cases: Array<{ stdin: string; expected: string }>,
    timeLimitMs?: number,
  ): Promise<CompileRunOutcome>;
}

let nodeRunner: NodeRunnerImplementation | null = null;

/** Node 环境入口（测试/CLI）注入 runner-core 实现；传 null 撤销注册 */
export function registerNodeRunner(impl: NodeRunnerImplementation | null): void {
  nodeRunner = impl;
}

/** 桌面桥（preload 暴露的最小 API） */
export interface DesktopBridge {
  isDesktop: true;
  runnerDetect(customPath?: string): Promise<RunnerAvailability>;
  runnerCompileAndRun(payload: RunnerPayload): Promise<CompileRunOutcome>;
  dbReset(): Promise<void>;
  chooseCompilerPath(): Promise<string | null>;
}

function getDesktopBridge(): DesktopBridge | null {
  const bridge = (globalThis as { cclabBridge?: DesktopBridge }).cclabBridge;
  return bridge !== undefined && bridge.isDesktop ? bridge : null;
}

export const DEFAULT_CASE_TIMEOUT_MS = 5000;

/** 是否在可执行子进程的环境（Electron 主进程 / Node） */
function hasNodeRuntime(): boolean {
  return (
    typeof process !== 'undefined' &&
    typeof (globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node === 'string'
  );
}

const BROWSER_UNAVAILABLE: RunnerAvailability = {
  available: false,
  reason: '当前运行在浏览器模式，本地编译判题需要桌面版（Electron）。',
  installHint: '使用桌面版应用，或安装 C 编译器后在支持的环境运行。',
  compiler: null,
};

/** 探测编译器：桌面桥 → 注册的 Node 实现 → 浏览器不可用指引 */
export async function detectCompilers(customPath?: string): Promise<RunnerAvailability> {
  const bridge = getDesktopBridge();
  if (bridge !== null) {
    return bridge.runnerDetect(customPath);
  }
  if (nodeRunner !== null) {
    return nodeRunner.detectCompiler(customPath);
  }
  void hasNodeRuntime;
  return BROWSER_UNAVAILABLE;
}

/**
 * 编译并逐用例运行（判题主入口）。
 * harness：平台提供的判题 main（读取 stdin、调用用户函数、打印结果）。
 */
export async function compileAndRun(
  compiler: CompilerInfo,
  userCode: string,
  harness: string,
  cases: Array<{ stdin: string; expected: string }>,
  timeLimitMs: number = DEFAULT_CASE_TIMEOUT_MS,
): Promise<CompileRunOutcome> {
  const bridge = getDesktopBridge();
  if (bridge !== null) {
    return bridge.runnerCompileAndRun({ compiler, userCode, harness, cases, timeLimitMs });
  }
  if (nodeRunner !== null) {
    return nodeRunner.compileAndRun(compiler, userCode, harness, cases, timeLimitMs);
  }
  throw new Error('compileAndRun 仅在桌面（Electron）或已注册 Runner 实现的环境可用');
}

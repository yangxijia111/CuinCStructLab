/** electron/runner-core.cjs 的最小类型声明（差分/测试 Node 环境经 createRequire 加载） */
declare module '../electron/runner-core.cjs' {
  export interface ProcessOutcome {
    exitCode: number | null;
    signal: string | null;
    timedOut: boolean;
    spawnError: string | null;
    durationMs: number;
    stdout: string;
    stderr: string;
  }
  export function execSafe(
    cmd: string,
    args: string[],
    opts: { cwd?: string; timeoutMs: number; stdin?: string },
  ): Promise<ProcessOutcome>;
  export function buildCompileArgs(kind: 'gcc' | 'clang' | 'cl', binaryPath: string, sourcePath: string): string[];
  export function detectCompiler(customPath?: string): Promise<{
    available: boolean;
    reason: string;
    installHint: string;
    compiler: { kind: 'gcc' | 'clang' | 'cl'; path: string; version: string } | null;
  }>;
}

/**
 * 本地 C Runner（JUDGE_SPEC §4 / SECURITY.md）。
 * 仅在 Electron 主进程（或 Node 环境）可用；浏览器模式 detectCompilers 返回不可用并给出指引。
 * 安全红线：
 *   - 一律 spawn(cmd, args[])，绝不拼接 shell 字符串（防命令注入）
 *   - 文件名固定白名单（main.c / program.exe），用户输入只进入文件内容与 stdin
 *   - 独立临时目录 + 用后递归删除；编译/运行超时；Windows 进程树 taskkill /T /F
 *   - stdout/stderr 各限 1MB
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

const MAX_OUTPUT = 1024 * 1024; // 1MB
const COMPILE_TIMEOUT_MS = 15_000;
const DEFAULT_CASE_TIMEOUT_MS = 5_000;

/** 是否在可执行子进程的环境（Electron 主进程 / Node） */
function hasNodeRuntime(): boolean {
  return (
    typeof process !== 'undefined' &&
    typeof (globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node === 'string'
  );
}

/** 探测编译器（PATH + Windows 常见安装位置） */
export async function detectCompilers(customPath?: string): Promise<RunnerAvailability> {
  if (!hasNodeRuntime()) {
    return {
      available: false,
      reason: '当前运行在浏览器模式，本地编译判题需要桌面版（Electron）或本地 Node 环境。',
      installHint: '使用桌面版应用，或安装 C 编译器后在支持的环境运行。',
      compiler: null,
    };
  }
  let childProcess: typeof import('node:child_process');
  let fsPromises: typeof import('node:fs/promises');
  let os: typeof import('node:os');
  try {
    childProcess = await import('node:child_process');
    fsPromises = await import('node:fs/promises');
    os = await import('node:os');
  } catch {
    return { available: false, reason: '无法加载进程模块。', installHint: '', compiler: null };
  }
  void fsPromises;
  void os;

  const tryExec = (cmd: string, args: string[]): Promise<{ code: number; out: string } | null> =>
    new Promise((resolve) => {
      try {
        const proc = childProcess.spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
        let out = '';
        const timer = setTimeout(() => {
          proc.kill();
          resolve(null);
        }, 5000);
        proc.stdout?.on('data', (d: Buffer) => {
          out += d.toString();
        });
        proc.on('error', () => {
          clearTimeout(timer);
          resolve(null);
        });
        proc.on('close', (code) => {
          clearTimeout(timer);
          resolve({ code: code ?? -1, out });
        });
      } catch {
        resolve(null);
      }
    });

  // 用户指定的编译器路径优先
  if (customPath !== undefined && customPath.trim() !== '') {
    const r = await tryExec(customPath, ['--version']);
    if (r !== null) {
      return {
        available: true,
        reason: '',
        installHint: '',
        compiler: { kind: guessKind(customPath), path: customPath, version: r.out.split('\n')[0] ?? '' },
      };
    }
    return { available: false, reason: `指定的编译器路径无法执行：${customPath}`, installHint: '检查路径是否正确。', compiler: null };
  }

  const candidates: Array<{ kind: CompilerKind; cmd: string; winFallbacks: string[] }> = [
    { kind: 'gcc', cmd: 'gcc', winFallbacks: ['C:\\MinGW\\bin\\gcc.exe', 'C:\\msys64\\mingw64\\bin\\gcc.exe', 'C:\\msys64\\ucrt64\\bin\\gcc.exe', 'C:\\TDM-GCC-64\\bin\\gcc.exe', 'C:\\Program Files\\mingw-w64\\*\\mingw64\\bin\\gcc.exe'] },
    { kind: 'clang', cmd: 'clang', winFallbacks: ['C:\\Program Files\\LLVM\\bin\\clang.exe'] },
    { kind: 'cl', cmd: 'cl', winFallbacks: [] },
  ];

  for (const c of candidates) {
    const r = await tryExec(c.cmd, c.kind === 'cl' ? [] : ['--version']);
    if (r !== null) {
      return {
        available: true,
        reason: '',
        installHint: '',
        compiler: { kind: c.kind, path: c.cmd, version: (r.out.split('\n')[0] ?? '').trim() },
      };
    }
    if (process.platform === 'win32') {
      for (const p of c.winFallbacks) {
        if (p.includes('*')) continue; // 通配路径需展开，跳过（PATH 探测已覆盖主流安装）
        const rr = await tryExec(p, c.kind === 'cl' ? [] : ['--version']);
        if (rr !== null) {
          return {
            available: true,
            reason: '',
            installHint: '',
            compiler: { kind: c.kind, path: p, version: (rr.out.split('\n')[0] ?? '').trim() },
          };
        }
      }
    }
  }

  return {
    available: false,
    reason: '未探测到 C 编译器（gcc / clang / MSVC cl）。',
    installHint: 'Windows：安装 MSYS2 或 MinGW-w64 后把 gcc.exe 所在目录加入 PATH；macOS：xcode-select --install；Linux：sudo apt install gcc',
    compiler: null,
  };
}

function guessKind(path: string): CompilerKind {
  const p = path.toLowerCase();
  if (p.includes('clang')) return 'clang';
  if (p.includes('cl')) return 'cl';
  return 'gcc';
}

/** 安全执行外部命令（数组 argv + 超时 + 输出限制） */
interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function execSafe(
  childProcess: typeof import('node:child_process'),
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeoutMs: number; stdin?: string },
): Promise<ExecResult> {
  return new Promise((resolve) => {
    let proc: import('node:child_process').ChildProcess;
    try {
      proc = childProcess.spawn(cmd, args, { cwd: opts.cwd, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
    } catch (err) {
      resolve({ code: null, stdout: '', stderr: String(err), timedOut: false });
      return;
    }
    let stdout = '';
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      killTree(childProcess, proc);
    }, opts.timeoutMs);
    proc.stdout?.on('data', (d: Buffer) => {
      if (stdout.length < MAX_OUTPUT) stdout += d.toString();
    });
    proc.stderr?.on('data', (d: Buffer) => {
      if (stderr.length < MAX_OUTPUT) stderr += d.toString();
    });
    proc.on('error', (err: Error) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: `${stderr}${err.message}`, timedOut: killed });
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut: killed });
    });
    if (opts.stdin !== undefined && proc.stdin !== null) {
      proc.stdin.write(opts.stdin);
      proc.stdin.end();
    } else {
      proc.stdin?.end();
    }
  });
}

/** Windows：taskkill /T /F 杀进程树；其他平台 kill */
function killTree(childProcess: typeof import('node:child_process'), proc: import('node:child_process').ChildProcess): void {
  if (process.platform === 'win32' && proc.pid !== undefined) {
    try {
      childProcess.spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', shell: false });
    } catch {
      proc.kill();
    }
  } else {
    proc.kill('SIGKILL');
  }
}

/**
 * 编译并逐用例运行（判题主入口；仅 Node/Electron 环境）。
 * harness：平台提供的判题 main（读取 stdin、调用用户函数、打印结果）。
 */
export async function compileAndRun(
  compiler: CompilerInfo,
  userCode: string,
  harness: string,
  cases: Array<{ stdin: string; expected: string }>,
  timeLimitMs = DEFAULT_CASE_TIMEOUT_MS,
): Promise<CompileRunOutcome> {
  if (!hasNodeRuntime()) {
    throw new Error('compileAndRun 仅在桌面（Node/Electron）环境可用');
  }
  const childProcess = await import('node:child_process');
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const crypto = await import('node:crypto');

  // 1. 独立临时目录
  const dir = path.join(os.tmpdir(), `cclab-${crypto.randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  const sourcePath = path.join(dir, 'main.c');
  const binaryPath = path.join(dir, process.platform === 'win32' ? 'program.exe' : 'program');

  let cleaned = false;
  const cleanup = async (): Promise<void> => {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      cleaned = true;
    } catch {
      cleaned = false;
    }
  };

  try {
    // 2. 写入源文件（用户代码 + harness），文件名固定白名单
    await fs.writeFile(sourcePath, `${userCode}\n\n${harness}`, 'utf8');

    // 3. 编译（argv 数组，绝不拼 shell）
    const compileArgs =
      compiler.kind === 'cl'
        ? ['/nologo', '/W4', '/EHsc', '/Fe:', binaryPath, sourcePath]
        : ['-std=c99', '-Wall', '-O0', '-o', binaryPath, sourcePath];
    const compile = await execSafe(childProcess, compiler.path, compileArgs, {
      cwd: dir,
      timeoutMs: COMPILE_TIMEOUT_MS,
    });
    if (compile.code !== 0) {
      const outcome: CompileRunOutcome = {
        compileExitCode: compile.code ?? -1,
        compileStdout: compile.stdout,
        compileStderr: compile.stderr,
        cases: [],
        cleaned: false,
      };
      await cleanup();
      outcome.cleaned = cleaned;
      return outcome;
    }

    // 4. 逐用例运行
    const results: CaseRunResult[] = [];
    for (const [i, c] of cases.entries()) {
      const r = await execSafe(childProcess, binaryPath, [], {
        cwd: dir,
        timeoutMs: timeLimitMs,
        stdin: c.stdin,
      });
      results.push({
        index: i,
        stdin: c.stdin,
        expected: c.expected,
        actual: r.stdout,
        exitCode: r.code,
        timedOut: r.timedOut,
        durationMs: 0,
      });
    }
    await cleanup();
    return {
      compileExitCode: 0,
      compileStdout: compile.stdout,
      compileStderr: compile.stderr,
      cases: results,
      cleaned,
    };
  } catch (err) {
    await cleanup();
    throw err;
  }
}

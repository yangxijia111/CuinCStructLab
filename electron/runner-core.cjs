/**
 * Runner Core —— 本地 C 编译/运行的唯一 Node 端实现（JUDGE_SPEC §4 / SECURITY.md）。
 * electron/main.cjs（IPC 层）与 Node 测试环境都只调用本模块，禁止再复制 Runner 逻辑。
 *
 * 安全红线：
 *   - 一律 spawn(cmd, args[])，绝不拼接 shell 字符串（防命令注入）
 *   - 文件名固定白名单（main.c / program[.exe]），用户输入只进入文件内容与 stdin
 *   - 独立临时目录 + 用后递归删除；编译/运行超时；Windows 进程树 taskkill /T /F
 *   - stdout/stderr 各限 1MB；payload 全字段校验（渲染层不可信）
 *   - 本地 Runner ≠ 安全沙箱（见 SECURITY.md）
 */
'use strict';
const { spawn } = require('node:child_process');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_OUTPUT = 1024 * 1024; // 1MB
const COMPILE_TIMEOUT_MS = 15000;
const DEFAULT_CASE_TIMEOUT_MS = 5000;
/** payload 输入上限（渲染层不可信，主进程强制验证） */
const LIMITS = {
  MAX_CASES: 100,
  MAX_SOURCE_CHARS: 512 * 1024,
  MAX_STDIN_CHARS: 256 * 1024,
  MAX_PATH_CHARS: 1024,
  MIN_TIME_LIMIT_MS: 100,
  MAX_TIME_LIMIT_MS: 30000,
};

const COMPILER_KINDS = ['gcc', 'clang', 'cl'];

/**
 * 校验 runner payload（IPC 层与测试共用；返回 ok=false 时 errors 给出全部原因）。
 */
function validateRunnerPayload(payload) {
  const errors = [];
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['payload 必须是对象'], value: null };
  }
  const p = payload;

  const compiler = p.compiler;
  if (compiler === null || typeof compiler !== 'object' || Array.isArray(compiler)) {
    errors.push('compiler 必须是对象');
  } else {
    if (!COMPILER_KINDS.includes(compiler.kind)) errors.push(`compiler.kind 必须是 ${COMPILER_KINDS.join('/')} 之一`);
    if (typeof compiler.path !== 'string' || compiler.path.trim() === '') errors.push('compiler.path 必须是非空字符串');
    else if (compiler.path.length > LIMITS.MAX_PATH_CHARS) errors.push(`compiler.path 超长（>${LIMITS.MAX_PATH_CHARS}）`);
    if (compiler.version !== undefined && typeof compiler.version !== 'string') errors.push('compiler.version 必须是字符串');
  }

  for (const key of ['userCode', 'harness']) {
    if (typeof p[key] !== 'string') errors.push(`${key} 必须是字符串`);
    else if (p[key].length > LIMITS.MAX_SOURCE_CHARS) errors.push(`${key} 超长（>${LIMITS.MAX_SOURCE_CHARS} 字符）`);
  }

  if (!Array.isArray(p.cases) || p.cases.length === 0) {
    errors.push('cases 必须是非空数组');
  } else {
    if (p.cases.length > LIMITS.MAX_CASES) errors.push(`cases 数量超过上限（>${LIMITS.MAX_CASES}）`);
    p.cases.forEach((c, i) => {
      if (c === null || typeof c !== 'object' || Array.isArray(c)) {
        errors.push(`cases[${i}] 必须是对象`);
        return;
      }
      if (typeof c.stdin !== 'string') errors.push(`cases[${i}].stdin 必须是字符串`);
      else if (c.stdin.length > LIMITS.MAX_STDIN_CHARS) errors.push(`cases[${i}].stdin 超长（>${LIMITS.MAX_STDIN_CHARS} 字符）`);
      if (typeof c.expected !== 'string') errors.push(`cases[${i}].expected 必须是字符串`);
      else if (c.expected.length > LIMITS.MAX_STDIN_CHARS) errors.push(`cases[${i}].expected 超长（>${LIMITS.MAX_STDIN_CHARS} 字符）`);
    });
  }

  if (!Number.isInteger(p.timeLimitMs) || p.timeLimitMs < LIMITS.MIN_TIME_LIMIT_MS || p.timeLimitMs > LIMITS.MAX_TIME_LIMIT_MS) {
    errors.push(`timeLimitMs 必须是 [${LIMITS.MIN_TIME_LIMIT_MS}, ${LIMITS.MAX_TIME_LIMIT_MS}] 内的整数`);
  }

  if (errors.length > 0) return { ok: false, errors, value: null };
  return {
    ok: true,
    errors: [],
    value: {
      compiler: { kind: compiler.kind, path: compiler.path, version: compiler.version ?? '' },
      userCode: p.userCode,
      harness: p.harness,
      cases: p.cases.map((c) => ({ stdin: c.stdin, expected: c.expected })),
      timeLimitMs: p.timeLimitMs,
    },
  };
}

/** 编译参数统一构造（消除双实现漂移；MSVC /Fe: 与目标文件同段 argv） */
function buildCompileArgs(kind, binaryPath, sourcePath) {
  return kind === 'cl'
    ? ['/nologo', '/W4', '/EHsc', `/Fe:${binaryPath}`, sourcePath]
    : ['-std=c99', '-Wall', '-O0', '-o', binaryPath, sourcePath];
}

/** 探测结果结构 */
function unavailable(reason, installHint) {
  return { available: false, reason, installHint, compiler: null };
}

/** 试运行一条命令收集版本输出；无法执行返回 null */
function tryExec(cmd, args, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    } catch {
      resolve(null);
      return;
    }
    let out = '';
    const timer = setTimeout(() => {
      try { proc.kill(); } catch { /* 已退出 */ }
      resolve(null);
    }, timeoutMs);
    proc.stdout?.on('data', (d) => { out += d.toString(); });
    proc.on('error', () => { clearTimeout(timer); resolve(null); });
    proc.on('close', (code) => { clearTimeout(timer); resolve({ code: code === null ? -1 : code, out }); });
  });
}

function firstVersionLine(out) {
  return (out.split('\n')[0] ?? '').trim();
}

/** 按文件路径猜测编译器类型 */
function guessKind(compilerPath) {
  const p = compilerPath.toLowerCase();
  if (p.includes('clang')) return 'clang';
  const base = path.basename(p);
  if (base === 'cl' || base === 'cl.exe') return 'cl';
  return 'gcc';
}

/**
 * 探测编译器：customPath 优先；否则按 gcc → clang → cl 探测 PATH，
 * Windows 下再尝试常见安装位置。返回 RunnerAvailability。
 */
async function detectCompiler(customPath, platform = process.platform) {
  const INSTALL_HINT =
    platform === 'win32'
      ? 'Windows：安装 MSYS2 或 MinGW-w64 后把 gcc.exe 所在目录加入 PATH'
      : platform === 'darwin'
        ? 'macOS：xcode-select --install'
        : 'Linux：sudo apt install gcc';

  if (customPath !== undefined && customPath !== null && String(customPath).trim() !== '') {
    const p = String(customPath).trim();
    if (p.length > LIMITS.MAX_PATH_CHARS) return unavailable('指定的编译器路径超长。', '');
    const r = await tryExec(p, ['--version']);
    if (r !== null) {
      return { available: true, reason: '', installHint: '', compiler: { kind: guessKind(p), path: p, version: firstVersionLine(r.out) } };
    }
    return unavailable(`指定的编译器路径无法执行：${p}`, '检查路径是否正确（需可直接执行，如 …/bin/gcc.exe）。');
  }

  const candidates = [
    {
      kind: 'gcc',
      cmd: 'gcc',
      winFallbacks: ['C:\\MinGW\\bin\\gcc.exe', 'C:\\msys64\\mingw64\\bin\\gcc.exe', 'C:\\msys64\\ucrt64\\bin\\gcc.exe', 'C:\\TDM-GCC-64\\bin\\gcc.exe'],
    },
    { kind: 'clang', cmd: 'clang', winFallbacks: ['C:\\Program Files\\LLVM\\bin\\clang.exe'] },
    { kind: 'cl', cmd: 'cl', winFallbacks: [] },
  ];
  for (const c of candidates) {
    const args = c.kind === 'cl' ? [] : ['--version'];
    const r = await tryExec(c.cmd, args);
    if (r !== null) {
      return { available: true, reason: '', installHint: '', compiler: { kind: c.kind, path: c.cmd, version: firstVersionLine(r.out) } };
    }
    if (platform === 'win32') {
      for (const p of c.winFallbacks) {
        const rr = await tryExec(p, args);
        if (rr !== null) {
          return { available: true, reason: '', installHint: '', compiler: { kind: c.kind, path: p, version: firstVersionLine(rr.out) } };
        }
      }
    }
  }
  return unavailable('未探测到 C 编译器（gcc / clang / MSVC cl）。', `INSTALL_HINT:${INSTALL_HINT}`);
}

/** Windows：taskkill /T /F 杀整个进程树；其他平台 SIGKILL */
function killTree(proc) {
  if (process.platform === 'win32' && proc.pid !== undefined) {
    try {
      spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', shell: false });
    } catch {
      try { proc.kill(); } catch { /* 已退出 */ }
    }
  } else {
    try { proc.kill('SIGKILL'); } catch { /* 已退出 */ }
  }
}

/** 安全执行：数组 argv + 超时杀树 + 双向输出限幅 + 真实耗时 */
function execSafe(cmd, args, opts) {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(cmd, args, { cwd: opts.cwd, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
    } catch (err) {
      resolve({ code: null, stdout: '', stderr: String(err), timedOut: false, durationMs: 0 });
      return;
    }
    const started = performance.now();
    let stdout = '';
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      killTree(proc);
    }, opts.timeoutMs);
    proc.stdout?.on('data', (d) => {
      // 限幅：超限后丢弃但继续消费，避免子进程因管道写满而阻塞
      if (stdout.length < MAX_OUTPUT) stdout += d.toString();
    });
    proc.stderr?.on('data', (d) => {
      if (stderr.length < MAX_OUTPUT) stderr += d.toString();
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: `${stderr}${stderr === '' ? '' : '\n'}${err.message}`, timedOut: killed, durationMs: performance.now() - started });
    });
    proc.on('close', (code, signal) => {
      clearTimeout(timer);
      // 信号终止（SIGSEGV/SIGABRT/SIGKILL…）时 code 为 null：映射为非零退出码，
      // 保证"崩溃"不会被误判为通过（timedOut 的 TLE 判定在 judge 层优先于 RE）
      resolve({
        code: code ?? (signal ? -1 : null),
        stdout,
        stderr,
        timedOut: killed,
        durationMs: performance.now() - started,
      });
    });
    if (opts.stdin !== undefined && proc.stdin !== null) {
      // 子进程可能先于写入退出（如不读 stdin 的程序）：EPIPE 属预期，不作为判题错误
      proc.stdin.on('error', () => {});
      proc.stdin.write(opts.stdin);
      proc.stdin.end();
    } else {
      proc.stdin?.end();
    }
  });
}

/**
 * 编译并逐用例运行（判题主入口）。
 * 返回 CompileRunOutcome；每个 case 的 durationMs 为真实耗时（performance.now）。
 */
async function compileAndRun(compiler, userCode, harness, cases, timeLimitMs = DEFAULT_CASE_TIMEOUT_MS) {
  // 主进程/测试环境入口再次验证（纵深防御：本函数也可能被非 IPC 调用方使用）
  const check = validateRunnerPayload({ compiler, userCode, harness, cases, timeLimitMs });
  if (!check.ok) {
    throw new Error(`runner payload 非法：${check.errors.join('；')}`);
  }
  const v = check.value;

  const dir = path.join(os.tmpdir(), `cclab-${crypto.randomUUID()}`);
  await fsp.mkdir(dir, { recursive: true });
  const sourcePath = path.join(dir, 'main.c');
  const binaryPath = path.join(dir, process.platform === 'win32' ? 'program.exe' : 'program');

  let cleaned = false;
  const cleanup = async () => {
    try {
      await fsp.rm(dir, { recursive: true, force: true });
      cleaned = true;
    } catch {
      cleaned = false;
    }
  };

  try {
    await fsp.writeFile(sourcePath, `${v.userCode}\n\n${v.harness}`, 'utf8');

    const compile = await execSafe(v.compiler.path, buildCompileArgs(v.compiler.kind, binaryPath, sourcePath), {
      cwd: dir,
      timeoutMs: COMPILE_TIMEOUT_MS,
    });
    if (compile.code !== 0) {
      await cleanup();
      return {
        compileExitCode: compile.code ?? -1,
        compileStdout: compile.stdout,
        compileStderr: compile.stderr,
        cases: [],
        cleaned,
      };
    }

    const results = [];
    for (const [i, c] of v.cases.entries()) {
      const r = await execSafe(binaryPath, [], { cwd: dir, timeoutMs: v.timeLimitMs, stdin: c.stdin });
      results.push({
        index: i,
        stdin: c.stdin,
        expected: c.expected,
        actual: r.stdout,
        exitCode: r.code,
        timedOut: r.timedOut,
        durationMs: r.durationMs,
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

module.exports = {
  LIMITS,
  COMPILER_KINDS,
  MAX_OUTPUT,
  COMPILE_TIMEOUT_MS,
  DEFAULT_CASE_TIMEOUT_MS,
  validateRunnerPayload,
  buildCompileArgs,
  detectCompiler,
  execSafe,
  compileAndRun,
};

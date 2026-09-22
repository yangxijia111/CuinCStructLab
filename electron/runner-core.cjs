/**
 * Runner Core —— 本地 C 编译/运行的唯一 Node 端实现（JUDGE_SPEC §4 / SECURITY.md / COMPILER_ADAPTER_SPEC）。
 * electron/main.cjs（IPC 层）与 Node 测试环境都只调用本模块，禁止再复制 Runner 逻辑。
 *
 * 安全红线：
 *   - 一律 spawn(cmd, args[])，绝不拼接 shell 字符串（防命令注入）
 *   - 文件名固定白名单（main.c / program[.exe]），用户输入只进入文件内容与 stdin
 *   - 独立临时目录 + finally 递归删除（全部分支）；编译/运行超时；整进程树终止
 *   - stdout/stderr 字节级限幅：最终长度 ≤ MAX_OUTPUT + 固定截断提示长度
 *   - payload 全字段校验（渲染层不可信）
 *   - 本地 Runner ≠ 安全沙箱（见 SECURITY.md）
 */
'use strict';
const { spawn } = require('node:child_process');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createCompilerAdapters, detectCompilerAdapter, classifyExit } = require('./compiler-adapters.cjs');

const MAX_OUTPUT = 1024 * 1024; // 1MB（字节）
/** 截断提示（固定长度：限幅承诺 = 最终输出 ≤ MAX_OUTPUT + 本提示长度） */
const OUTPUT_TRUNCATION_NOTICE = '\n[输出超过上限，已截断]';
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

/** 默认适配器集合（真实 spawn 探测） */
const adapters = createCompilerAdapters();

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
      else if (c.stdin.length > LIMITS.MAX_STDIN_CHARS) errors.push(`cases[${i}].stdin 超长（>${LIMITS.MAX_STDIN_CHARS}）`);
      if (typeof c.expected !== 'string') errors.push(`cases[${i}].expected 必须是字符串`);
      else if (c.expected.length > LIMITS.MAX_STDIN_CHARS) errors.push(`cases[${i}].expected 超长（>${LIMITS.MAX_STDIN_CHARS}）`);
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

/** 编译参数：委托 Compiler Adapter（消除本文件内的编译器分支） */
function buildCompileArgs(kind, binaryPath, sourcePath) {
  const adapter = adapters[kind];
  if (adapter === undefined) throw new Error(`未知编译器类型: ${kind}`);
  return adapter.buildCompileArgs(binaryPath, sourcePath);
}

/** 探测编译器：委托 adapter 层（customPath 签名验证 / MSVC 环境提示） */
async function detectCompiler(customPath, platform = process.platform) {
  return detectCompilerAdapter(customPath, adapters, platform);
}

/**
 * 整进程树终止：
 *   Windows：taskkill /T /F（作业对象不可用时的标准做法）
 *   POSIX：子进程以新进程组启动（detached），kill(-pid, SIGKILL) 杀整组
 */
function killTree(proc) {
  if (proc.pid === undefined) return;
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', shell: false });
    } catch {
      try { proc.kill(); } catch { /* 已退出 */ }
    }
  } else {
    try {
      process.kill(-proc.pid, 'SIGKILL'); // 进程组（detached 保证 pgid == pid）
    } catch {
      try { proc.kill('SIGKILL'); } catch { /* 已退出 */ }
    }
  }
}

/** 字节级限幅累加器：超出 max 后丢弃，记录 truncated */
function makeOutputCap(max) {
  const chunks = [];
  let total = 0;
  let truncated = false;
  return {
    push(buf) {
      if (total >= max) {
        truncated = true;
        return;
      }
      const remaining = max - total;
      if (buf.length > remaining) {
        chunks.push(buf.slice(0, remaining));
        total = max;
        truncated = true;
      } else {
        chunks.push(buf);
        total += buf.length;
      }
    },
    text() {
      const body = Buffer.concat(chunks).toString('utf8');
      return truncated ? body + OUTPUT_TRUNCATION_NOTICE : body;
    },
    get truncated() {
      return truncated;
    },
  };
}

/**
 * 安全执行：数组 argv + 超时杀树 + 字节级限幅 + ProcessOutcome（平台无关）。
 * 返回 { exitCode, signal, timedOut, spawnError, durationMs, stdout, stderr }。
 */
function execSafe(cmd, args, opts) {
  return new Promise((resolve) => {
    const posixDetached = process.platform !== 'win32';
    let proc;
    try {
      proc = spawn(cmd, args, {
        cwd: opts.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        detached: posixDetached, // POSIX：独立进程组，超时可 kill(-pgid) 整组终止
      });
    } catch (err) {
      resolve({
        exitCode: null,
        signal: null,
        timedOut: false,
        spawnError: String(err),
        durationMs: 0,
        stdout: '',
        stderr: '',
      });
      return;
    }
    const started = performance.now();
    const outCap = makeOutputCap(MAX_OUTPUT);
    const errCap = makeOutputCap(MAX_OUTPUT);
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      killTree(proc);
    }, opts.timeoutMs);
    proc.stdout.on('data', (d) => outCap.push(d));
    proc.stderr.on('data', (d) => errCap.push(d));
    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: null,
        signal: null,
        timedOut: killed,
        spawnError: err.message,
        durationMs: performance.now() - started,
        stdout: outCap.text(),
        stderr: errCap.text(),
      });
    });
    proc.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode: code === null || code === undefined ? null : code,
        signal: signal === undefined ? null : signal,
        timedOut: killed,
        spawnError: null,
        durationMs: performance.now() - started,
        stdout: outCap.text(),
        stderr: errCap.text(),
      });
    });
    if (opts.stdin !== undefined && proc.stdin !== null) {
      // 子进程可能先于写入退出（如不读 stdin 的程序）：EPIPE 属预期，不作为判题错误
      proc.stdin.on('error', () => {});
      proc.stdin.write(opts.stdin);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }
  });
}

/** 失败分类（委托 adapter 层；judge 消费） */
function classifyOutcome(outcome) {
  return classifyExit(outcome);
}

/**
 * 编译并逐用例运行（判题主入口）。
 * 返回 CompileRunOutcome；每个 case 附 ProcessOutcome 字段（signal/spawnError）。
 * 全部分支 finally 清理临时目录。
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
  let outcome = null;
  try {
    await fsp.writeFile(sourcePath, `${v.userCode}\n\n${v.harness}`, 'utf8');

    const compile = await execSafe(v.compiler.path, buildCompileArgs(v.compiler.kind, binaryPath, sourcePath), {
      cwd: dir,
      timeoutMs: COMPILE_TIMEOUT_MS,
    });
    if (compile.exitCode !== 0) {
      outcome = {
        compileExitCode: compile.exitCode ?? (compile.spawnError !== null ? -2 : -1),
        compileStdout: compile.stdout,
        compileStderr: compile.stderr,
        cases: [],
        cleaned,
      };
      return outcome;
    }

    const results = [];
    for (const [i, c] of v.cases.entries()) {
      const r = await execSafe(binaryPath, [], { cwd: dir, timeoutMs: v.timeLimitMs, stdin: c.stdin });
      results.push({
        index: i,
        stdin: c.stdin,
        expected: c.expected,
        actual: r.stdout,
        exitCode: r.exitCode,
        signal: r.signal,
        spawnError: r.spawnError,
        timedOut: r.timedOut,
        durationMs: r.durationMs,
      });
    }
    outcome = {
      compileExitCode: 0,
      compileStdout: compile.stdout,
      compileStderr: compile.stderr,
      cases: results,
      cleaned,
    };
    return outcome;
  } finally {
    // 所有分支（成功/编译失败/运行异常/throw）都清理临时目录
    try {
      await fsp.rm(dir, { recursive: true, force: true });
      cleaned = true;
    } catch {
      cleaned = false;
    }
    if (outcome !== null) outcome.cleaned = cleaned;
  }
}

module.exports = {
  LIMITS,
  COMPILER_KINDS,
  MAX_OUTPUT,
  OUTPUT_TRUNCATION_NOTICE,
  COMPILE_TIMEOUT_MS,
  DEFAULT_CASE_TIMEOUT_MS,
  validateRunnerPayload,
  buildCompileArgs,
  detectCompiler,
  execSafe,
  classifyOutcome,
  compileAndRun,
};

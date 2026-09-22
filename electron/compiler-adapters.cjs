/**
 * Compiler Adapter 层（COMPILER_ADAPTER_SPEC）：收敛 gcc/clang/cl 全部差异。
 * runner-core 不再自带探测/参数分支，一律委托本模块。
 *
 * 设计要点：
 *   - createCompilerAdapters(execProbe) 工厂：探测函数可注入（生产真实 spawn / 测试 mock）
 *   - 版本探测同时收集 stdout 与 stderr（MSVC banner 在 stderr）
 *   - customPath 结论由版本签名决定（文件名只影响尝试顺序），任意 exe 无法冒充
 *   - MSVC：无参数运行读 banner；识别"存在但 INCLUDE/LIB 未初始化"并明确提示
 *   - classifyExit：平台无关失败分类（judge 的唯一依据）
 */
'use strict';
const path = require('node:path');

/** 探测函数协议（生产 makeSpawnProbe；测试注入 mock） */
// execProbe(cmd, args, timeoutMs) -> { ran, exitCode, signal, stdout, stderr, durationMs }

/** 生产探测实现：真实 spawn，收集 stdout+stderr，超时/启动失败 → ran=false */
function makeSpawnProbe() {
  const { spawn } = require('node:child_process');
  return (cmd, args, timeoutMs = 8000) =>
    new Promise((resolve) => {
      let proc;
      try {
        proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
      } catch {
        resolve({ ran: false, exitCode: null, signal: null, stdout: '', stderr: '', durationMs: 0 });
        return;
      }
      let stdout = '';
      let stderr = '';
      const cap = 64 * 1024; // 版本输出很小，防滥用上限
      const timer = setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch { /* 已退出 */ }
        resolve({ ran: true, exitCode: null, signal: 'SIGKILL', stdout, stderr, durationMs: 0 });
      }, timeoutMs);
      proc.stdout.on('data', (d) => { if (stdout.length < cap) stdout += d.toString(); });
      proc.stderr.on('data', (d) => { if (stderr.length < cap) stderr += d.toString(); });
      proc.on('error', () => {
        clearTimeout(timer);
        resolve({ ran: false, exitCode: null, signal: null, stdout, stderr, durationMs: 0 });
      });
      proc.on('close', (code, signal) => {
        clearTimeout(timer);
        resolve({ ran: true, exitCode: code === null ? null : code, signal: signal ?? null, stdout, stderr, durationMs: 0 });
      });
    });
}

const GCC_COMPILE_ARGS = (binaryPath, sourcePath) => ['-std=c99', '-Wall', '-O0', '-o', binaryPath, sourcePath];

/** 创建三个适配器（execProbe 注入；默认真实 spawn） */
function createCompilerAdapters(execProbe = makeSpawnProbe()) {
  const gcc = {
    kind: 'gcc',
    versionArgs: () => ['--version'],
    versionSignature: () => /gcc|Free Software Foundation/i,
    parseVersion: (stdout) => (stdout.split('\n')[0] || '').trim() || null,
    buildCompileArgs: GCC_COMPILE_ARGS,
    probe: async (cmd) => probeWith(execProbe, cmd, gcc),
    supports: () => ({ c99: true, signalExit: true, devEnvRequired: false }),
    getEnvironmentInfo: () => ({}),
  };

  const clang = {
    kind: 'clang',
    versionArgs: () => ['--version'],
    versionSignature: () => /clang/i,
    parseVersion: (stdout) => (stdout.split('\n')[0] || '').trim() || null,
    buildCompileArgs: GCC_COMPILE_ARGS,
    probe: async (cmd) => probeWith(execProbe, cmd, clang),
    supports: () => ({ c99: true, signalExit: true, devEnvRequired: false }),
    getEnvironmentInfo: () => ({}),
  };

  const cl = {
    kind: 'cl',
    // cl 不支持 --version：无参数运行打印 banner（在 stderr）到用法信息，退出码非 0 属预期
    versionArgs: () => [],
    versionSignature: () => /Microsoft \(R\)|Optimizing Compiler|Version \d+\.\d+/i,
    parseVersion: (_stdout, stderr) => {
      const m = /Version (\d+(?:\.\d+)*)/.exec(stderr) || /Version (\d+(?:\.\d+)*)/.exec(_stdout);
      return m === null ? 'Microsoft C/C++ Compiler' : `MSVC ${m[1]}`;
    },
    buildCompileArgs: (binaryPath, sourcePath) => ['/nologo', '/W4', '/EHsc', '/std:c11', `/Fe:${binaryPath}`, sourcePath],
    probe: async (cmd) => probeWith(execProbe, cmd, cl),
    supports: () => ({ c99: true, signalExit: false, devEnvRequired: true }),
    getEnvironmentInfo: () => ({ hasInclude: !!process.env.INCLUDE, hasLib: !!process.env.LIB }),
  };

  async function probeWith(probe, cmd, adapter) {
    const r = await probe(cmd, adapter.versionArgs(), 8000);
    if (!r.ran) return { found: false, version: null, reason: '无法启动进程' };
    const out = `${r.stdout}\n${r.stderr}`;
    if (!adapter.versionSignature().test(out)) {
      return { found: false, version: null, reason: '版本输出签名不匹配（不是该编译器）' };
    }
    return { found: true, version: adapter.parseVersion(r.stdout, r.stderr) ?? '', reason: '' };
  }

  return { gcc, clang, cl, probeWith };
}

/** customPath 候选顺序：文件名只影响尝试顺序，结论由签名决定 */
function guessAdapterOrder(compilerPath, adapters) {
  const p = compilerPath.toLowerCase();
  const base = path.basename(p).replace(/\.exe$/i, '');
  if (base === 'cl') return [adapters.cl, adapters.gcc, adapters.clang];
  if (p.includes('clang')) return [adapters.clang, adapters.gcc, adapters.cl];
  return [adapters.gcc, adapters.clang, adapters.cl];
}

/** MSVC 环境未初始化提示（任务书十三：不得误判为正常可用） */
const MSVC_ENV_HINT =
  'cl.exe 存在，但 MSVC 开发环境未初始化（缺少 INCLUDE/LIB）。请在 Visual Studio Developer Command Prompt 中启动应用，或通过 vcvarsall.bat 初始化后用自定义路径指定 cl.exe。';

/**
 * 统一探测入口（runner-core.detectCompiler 委托）。
 * customPath：按 guess 顺序逐 adapter probe，签名匹配者胜出；
 * 无 customPath：PATH 探测 gcc → clang → cl（Windows 附带常见安装位置）。
 */
async function detectCompilerAdapter(customPath, adapters, platform = process.platform) {
  const INSTALL_HINT =
    platform === 'win32'
      ? 'Windows：安装 MSYS2 或 MinGW-w64 后把 gcc.exe 所在目录加入 PATH；或安装 Visual Studio Build Tools 使用 MSVC。'
      : platform === 'darwin'
        ? 'macOS：xcode-select --install'
        : 'Linux：sudo apt install gcc';

  const finish = (adapter, cmd, version, extraReason = '') => ({
    available: true,
    reason: extraReason,
    installHint: '',
    compiler: { kind: adapter.kind, path: cmd, version },
  });

  const tryAdapters = async (cmd) => {
    for (const adapter of guessAdapterOrder(cmd, adapters)) {
      const r = await adapter.probe(cmd);
      if (r.found) return { adapter, result: r };
    }
    return null;
  };

  if (customPath !== undefined && customPath !== null && String(customPath).trim() !== '') {
    const p = String(customPath).trim();
    const hit = await tryAdapters(p);
    if (hit === null) {
      return {
        available: false,
        reason: `指定的路径不是受支持的 C 编译器（gcc/clang/cl）：${p}`,
        installHint: '检查路径是否指向编译器可执行文件本体（如 …/bin/gcc.exe）。',
        compiler: null,
      };
    }
    // MSVC：存在但开发环境未初始化 → 不可用 + 明确提示（不误判为正常可用）
    if (hit.adapter.kind === 'cl' && !hit.adapter.getEnvironmentInfo().hasInclude) {
      return { available: false, reason: MSVC_ENV_HINT, installHint: MSVC_ENV_HINT, compiler: null };
    }
    return finish(hit.adapter, p, hit.result.version);
  }

  const candidates = [
    { adapter: adapters.gcc, cmd: 'gcc', winFallbacks: ['C:\\MinGW\\bin\\gcc.exe', 'C:\\msys64\\mingw64\\bin\\gcc.exe', 'C:\\msys64\\ucrt64\\bin\\gcc.exe', 'C:\\TDM-GCC-64\\bin\\gcc.exe'] },
    { adapter: adapters.clang, cmd: 'clang', winFallbacks: ['C:\\Program Files\\LLVM\\bin\\clang.exe'] },
    { adapter: adapters.cl, cmd: 'cl', winFallbacks: [] },
  ];
  for (const c of candidates) {
    const cmds = [c.cmd, ...(platform === 'win32' ? c.winFallbacks : [])];
    for (const cmd of cmds) {
      const r = await c.adapter.probe(cmd);
      if (r.found) {
        if (c.adapter.kind === 'cl' && !c.adapter.getEnvironmentInfo().hasInclude) {
          return { available: false, reason: MSVC_ENV_HINT, installHint: MSVC_ENV_HINT, compiler: null };
        }
        return finish(c.adapter, cmd, r.version);
      }
    }
  }
  return {
    available: false,
    reason: '未探测到受支持的 C 编译器（gcc / clang / MSVC cl）。',
    installHint: `INSTALL_HINT:${INSTALL_HINT}`,
    compiler: null,
  };
}

/**
 * 平台无关失败分类（COMPILER_ADAPTER_SPEC §5）。
 * outcome: { exitCode, signal, timedOut, spawnError, durationMs }
 */
function classifyExit(outcome) {
  if (outcome.spawnError !== null && outcome.spawnError !== undefined) return 'spawn_error';
  if (outcome.timedOut) return 'timeout';
  if (outcome.signal !== null && outcome.signal !== undefined) return 'signal';
  if (outcome.exitCode !== 0) return 'nonzero_exit';
  return 'ok';
}

module.exports = { createCompilerAdapters, makeSpawnProbe, guessAdapterOrder, detectCompilerAdapter, classifyExit, MSVC_ENV_HINT };

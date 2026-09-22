/**
 * P15 Runner 可靠性测试（失败测试先行：R2 限幅超限 / R3 spawn error 漏判 / R4 进程树）。
 * 层次 1 的断言在旧 runner-core 上必须失败，修复后转绿。
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { judgeSubmission } from '../src/judge/judge';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const runnerCore = require(path.join(process.cwd(), 'electron', 'runner-core.cjs')) as {
  execSafe: (cmd: string, args: string[], opts: { cwd?: string; timeoutMs: number; stdin?: string }) => Promise<{
    exitCode: number | null;
    signal: string | null;
    timedOut: boolean;
    spawnError: string | null;
    durationMs: number;
    stdout: string;
    stderr: string;
  }>;
  MAX_OUTPUT: number;
  OUTPUT_TRUNCATION_NOTICE: string;
  compileAndRun: (
    compiler: { kind: string; path: string; version?: string },
    userCode: string,
    harness: string,
    cases: Array<{ stdin: string; expected: string }>,
    timeLimitMs?: number,
  ) => Promise<{
    compileExitCode: number;
    cases: Array<{ index: number; actual: string; exitCode: number | null; timedOut: boolean; signal?: string | null; spawnError?: string | null }>;
    cleaned: boolean;
  }>;
};

const NODE = process.execPath;

describe('R2：输出限幅严格性（最终输出 ≤ MAX_OUTPUT + 固定截断提示）', () => {
  it('单个巨大 chunk（一次写 8MB）不超过上限', { timeout: 60_000 }, async () => {
    const r = await runnerCore.execSafe(NODE, ['-e', 'process.stdout.write("x".repeat(8*1024*1024))'], { timeoutMs: 30_000 });
    const limit = runnerCore.MAX_OUTPUT + runnerCore.OUTPUT_TRUNCATION_NOTICE.length;
    expect(r.stdout.length).toBeLessThanOrEqual(limit);
    expect(r.stdout.startsWith('x')).toBe(true);
  });

  it('持续输出洪泛（stdout 与 stderr 同时）双方都不超上限', { timeout: 60_000 }, async () => {
    const r = await runnerCore.execSafe(
      NODE,
      ['-e', 'for(;;){process.stdout.write("a".repeat(65536)); process.stderr.write("b".repeat(65536));}'],
      { timeoutMs: 1500 },
    );
    const limit = runnerCore.MAX_OUTPUT + runnerCore.OUTPUT_TRUNCATION_NOTICE.length;
    expect(r.timedOut).toBe(true);
    expect(r.stdout.length).toBeLessThanOrEqual(limit);
    expect(r.stderr.length).toBeLessThanOrEqual(limit);
  });

  it('截断时输出末尾包含固定截断提示', { timeout: 60_000 }, async () => {
    const r = await runnerCore.execSafe(NODE, ['-e', 'process.stdout.write("x".repeat(8*1024*1024))'], { timeoutMs: 30_000 });
    expect(r.stdout).toContain(runnerCore.OUTPUT_TRUNCATION_NOTICE);
  });

  it('未超限时输出原样（无截断提示）', { timeout: 30_000 }, async () => {
    const r = await runnerCore.execSafe(NODE, ['-e', 'console.log("small output")'], { timeoutMs: 10_000 });
    expect(r.stdout).toBe('small output\n');
    expect(r.stdout).not.toContain(runnerCore.OUTPUT_TRUNCATION_NOTICE);
  });
});

describe('R3：spawn error 分类（绝不判 Accepted）', () => {
  it('execSafe：启动不存在的命令 → spawnError 非空且 exitCode 为 null', { timeout: 30_000 }, async () => {
    const r = await runnerCore.execSafe('cclab-definitely-not-a-command-xyz', [], { timeoutMs: 5000 });
    expect(r.spawnError).toBeTruthy();
    expect(r.exitCode).toBeNull();
  });

  it('judge：spawn error 的用例必须判 Runtime Error（旧实现会误判 Accepted——回归防线）', () => {
    const judged = judgeSubmission({
      compileExitCode: 0,
      compileStderr: '',
      timeLimitMs: 1000,
      cases: [
        { index: 0, stdin: '', expected: '', actual: '', exitCode: null, timedOut: false, durationMs: 3, signal: null, spawnError: 'spawn ENOENT' },
      ],
    });
    expect(judged.status).toBe('runtime_error');
  });

  it('judge：信号崩溃（SIGSEGV）判 Runtime Error', () => {
    const judged = judgeSubmission({
      compileExitCode: 0,
      compileStderr: '',
      timeLimitMs: 1000,
      cases: [
        { index: 0, stdin: '', expected: 'x', actual: '', exitCode: null, timedOut: false, durationMs: 3, signal: 'SIGSEGV', spawnError: null },
      ],
    });
    expect(judged.status).toBe('runtime_error');
  });
});

describe('ProcessOutcome：平台无关结果结构', () => {
  it('正常执行：exitCode=0、无 signal/spawnError、durationMs>0', { timeout: 30_000 }, async () => {
    const r = await runnerCore.execSafe(NODE, ['-e', 'process.exit(0)'], { timeoutMs: 10_000 });
    expect(r.exitCode).toBe(0);
    expect(r.signal).toBeNull();
    expect(r.spawnError).toBeNull();
    expect(r.durationMs).toBeGreaterThan(0);
  });

  it('非零退出码保留', { timeout: 30_000 }, async () => {
    const r = await runnerCore.execSafe(NODE, ['-e', 'process.exit(3)'], { timeoutMs: 10_000 });
    expect(r.exitCode).toBe(3);
  });
});

describe('R4：进程树终止', () => {
  it(
    '超时杀死孙进程（node → node 子进程 → 不残留）',
    { timeout: 60_000 },
    async () => {
      // 孙进程每 200ms 向临时文件写入心跳；父被杀后心跳应停止（进程树被整树终止）
      const { writeFile, readFile, rm } = await import('node:fs/promises');
      const os = await import('node:os');
      const heartbeat = path.join(os.tmpdir(), `cclab-hb-${process.pid}-${Date.now()}.txt`);
      const grandchild = `const fs = require('fs'); setInterval(() => fs.appendFileSync(${JSON.stringify(heartbeat)}, 'x'), 200); setTimeout(()=>{}, 60000);`;
      const parent = `const { spawn } = require('child_process'); const c = spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'ignore' }); setInterval(() => {}, 1000);`;
      await writeFile(heartbeat, '', 'utf8');
      const r = await runnerCore.execSafe(NODE, ['-e', parent], { timeoutMs: 1200 });
      expect(r.timedOut).toBe(true);
      // 等待足够时间：若孙进程仍存活，心跳持续增长
      const size1 = (await readFile(heartbeat, 'utf8')).length;
      await new Promise((res) => setTimeout(res, 1500));
      const size2 = (await readFile(heartbeat, 'utf8')).length;
      expect(size2, `孙进程未被终止：心跳 ${size1} → ${size2}（进程树泄漏）`).toBe(size1);
      await rm(heartbeat, { force: true }).catch(() => undefined);
    },
  );
});

describe('Runner cleanup：所有失败分支', () => {
  it('spawn error 后无临时目录残留（compileAndRun 编译器路径无效场景）', { timeout: 30_000 }, async () => {
    const os = await import('node:os');
    const { readdir } = await import('node:fs/promises');
    const before = new Set((await readdir(os.tmpdir())).filter((n) => n.startsWith('cclab-')));
    await runnerCore
      .compileAndRun({ kind: 'gcc', path: 'cclab-not-a-compiler', version: '' }, 'int main(void){return 0;}', '', [
        { stdin: '', expected: '' },
      ], 1000)
      .catch(() => undefined);
    const after = (await readdir(os.tmpdir())).filter((n) => n.startsWith('cclab-') && !before.has(n));
    expect(after).toEqual([]);
  });
});

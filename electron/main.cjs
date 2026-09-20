/**
 * Electron 主进程（ARCHITECTURE.md §1.2 桌面外壳）：
 *   - 窗口管理（开发连 Vite，生产加载 dist）
 *   - SQLite 文件持久化桥（userData/cuincstructlab.db）
 *   - 本地 C Runner 桥（复用 dist 编译产物之外的 Node 能力）
 * 安全：contextIsolation 开启，preload 仅暴露最小 API。
 */
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const DB_FILE = 'cuincstructlab.db';

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: 'CuinCStructLab',
    backgroundColor: '#14161c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // 本地教学应用：file:// 直加载 vite module 构建需要关闭同源限制（无外部内容）
      webSecurity: false,
    },
  });

  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    win.loadURL(devUrl).catch((err) => {
      console.error('加载开发服务器失败:', err);
    });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html')).catch((err) => {
      console.error('加载生产构建失败:', err);
    });
  }
  return win;
}

/* ============ 数据库文件桥 ============ */

ipcMain.handle('db:load', async () => {
  try {
    const file = path.join(app.getPath('userData'), DB_FILE);
    const buf = await fs.readFile(file);
    return new Uint8Array(buf);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw new Error(`读取数据库失败: ${err && err.message}`, { cause: err });
  }
});

ipcMain.handle('db:save', async (_event, data) => {
  const file = path.join(app.getPath('userData'), DB_FILE);
  const tmp = `${file}.tmp`;
  // 先写临时文件再原子替换，避免写一半损坏
  await fs.writeFile(tmp, Buffer.from(data));
  await fs.rename(tmp, file);
});

/* ============ Runner 桥（渲染层无法直接 spawn） ============ */

ipcMain.handle('runner:detect', async (_event, customPath) => {
  // 动态加载打包后的 runner 逻辑（直接在主进程内联实现探测，避免模块格式问题）
  const { spawn } = require('node:child_process');
  const tryExec = (cmd, args) =>
    new Promise((resolve) => {
      let out = '';
      let proc;
      try {
        proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
      } catch {
        resolve(null);
        return;
      }
      const timer = setTimeout(() => {
        try { proc.kill(); } catch { /* 忽略 */ }
        resolve(null);
      }, 5000);
      proc.stdout && proc.stdout.on('data', (d) => { out += d.toString(); });
      proc.on('error', () => { clearTimeout(timer); resolve(null); });
      proc.on('close', (code) => { clearTimeout(timer); resolve({ code: code === null ? -1 : code, out }); });
    });

  if (customPath && customPath.trim() !== '') {
    const r = await tryExec(customPath.trim(), ['--version']);
    if (r) return { available: true, compiler: { kind: 'gcc', path: customPath.trim(), version: r.out.split('\n')[0] || '' }, reason: '', installHint: '' };
    return { available: false, compiler: null, reason: `指定路径无法执行：${customPath}`, installHint: '' };
  }
  for (const cmd of ['gcc', 'clang', 'cl']) {
    const r = await tryExec(cmd, cmd === 'cl' ? [] : ['--version']);
    if (r) {
      const kind = cmd.includes('clang') ? 'clang' : cmd === 'cl' ? 'cl' : 'gcc';
      return { available: true, compiler: { kind, path: cmd, version: (r.out.split('\n')[0] || '').trim() }, reason: '', installHint: '' };
    }
  }
  return {
    available: false,
    compiler: null,
    reason: '未探测到 C 编译器（gcc / clang / MSVC cl）。',
    installHint: 'Windows：安装 MSYS2/MinGW-w64 并把 gcc.exe 加入 PATH；macOS：xcode-select --install；Linux：sudo apt install gcc',
  };
});

ipcMain.handle('runner:compileAndRun', async (_event, payload) => {
  // 复用渲染层同款安全逻辑（在主进程执行）：临时目录 + argv 数组 + 超时 + taskkill
  const { spawn } = require('node:child_process');
  const fsp = require('node:fs/promises');
  const os = require('node:os');
  const crypto = require('node:crypto');
  const compiler = payload.compiler;
  const MAX_OUTPUT = 1024 * 1024;

  const execSafe = (cmd, args, opts) =>
    new Promise((resolve) => {
      let proc;
      try {
        proc = spawn(cmd, args, { cwd: opts.cwd, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
      } catch (err) {
        resolve({ code: null, stdout: '', stderr: String(err), timedOut: false });
        return;
      }
      let stdout = '';
      let stderr = '';
      let killed = false;
      const timer = setTimeout(() => {
        killed = true;
        if (process.platform === 'win32' && proc.pid) {
          try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { try { proc.kill(); } catch { /* 忽略 */ } }
        } else {
          try { proc.kill('SIGKILL'); } catch { /* 忽略 */ }
        }
      }, opts.timeoutMs);
      proc.stdout && proc.stdout.on('data', (d) => { if (stdout.length < MAX_OUTPUT) stdout += d.toString(); });
      proc.stderr && proc.stderr.on('data', (d) => { if (stderr.length < MAX_OUTPUT) stderr += d.toString(); });
      proc.on('error', () => { clearTimeout(timer); resolve({ code: null, stdout, stderr, timedOut: killed }); });
      proc.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut: killed }); });
      if (opts.stdin !== undefined) { proc.stdin.write(opts.stdin); proc.stdin.end(); }
      else if (proc.stdin) { proc.stdin.end(); }
    });

  const dir = path.join(os.tmpdir(), `cclab-${crypto.randomUUID()}`);
  await fsp.mkdir(dir, { recursive: true });
  const sourcePath = path.join(dir, 'main.c');
  const binaryPath = path.join(dir, process.platform === 'win32' ? 'program.exe' : 'program');
  try {
    await fsp.writeFile(sourcePath, `${payload.userCode}\n\n${payload.harness}\n`, 'utf8');
    const compileArgs = compiler.kind === 'cl'
      ? ['/nologo', '/W4', '/EHsc', `/Fe:${binaryPath}`, sourcePath]
      : ['-std=c99', '-Wall', '-O0', '-o', binaryPath, sourcePath];
    const compile = await execSafe(compiler.path, compileArgs, { cwd: dir, timeoutMs: 15000 });
    if (compile.code !== 0) {
      await fsp.rm(dir, { recursive: true, force: true }).catch(() => undefined);
      return { compileExitCode: compile.code === null ? -1 : compile.code, compileStdout: compile.stdout, compileStderr: compile.stderr, cases: [], cleaned: true };
    }
    const cases = [];
    for (const [i, c] of payload.cases.entries()) {
      const r = await execSafe(binaryPath, [], { cwd: dir, timeoutMs: payload.timeLimitMs || 5000, stdin: c.stdin });
      cases.push({ index: i, stdin: c.stdin, expected: c.expected, actual: r.stdout, exitCode: r.code, timedOut: r.timedOut, durationMs: 0 });
    }
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    return { compileExitCode: 0, compileStdout: compile.stdout, compileStderr: compile.stderr, cases, cleaned: true };
  } catch (err) {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    throw err;
  }
});

ipcMain.handle('app:chooseCompilerPath', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: '编译器', extensions: ['exe', ''] }] });
  return r.canceled ? null : r.filePaths[0] || null;
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

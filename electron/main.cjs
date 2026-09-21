/**
 * Electron 主进程（ARCHITECTURE.md §1.2 桌面外壳）：
 *   - 窗口管理（开发连 Vite，生产经 app:// 标准协议加载 dist）
 *   - SQLite 文件持久化桥（userData/cuincstructlab.db）
 *   - 本地 C Runner 桥（转发到 runner-core，本文件不含 Runner 逻辑）
 * 安全：contextIsolation + sandbox 开启、webSecurity 开启、CSP、导航/新窗口限制、
 *       IPC 参数验证（渲染层不可信）。详见 SECURITY.md。
 */
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const runnerCore = require('./runner-core.cjs');
const { registerAppProtocolScheme, attachAppProtocolHandler, APP_ORIGIN, APP_ENTRY } = require('./protocol.cjs');

const DB_FILE = 'cuincstructlab.db';
/** db:save 载荷上限（学习库远小于此，防滥用） */
const MAX_DB_BYTES = 64 * 1024 * 1024;
/** 开发服务器仅允许本机回环地址 */
const DEV_URL_ALLOW = /^http:\/\/(localhost|127\.0\.0\.1):\d+/;

function isDevUrl(url) {
  return DEV_URL_ALLOW.test(url);
}

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
      sandbox: true,
      webSecurity: true,
    },
  });

  // 禁止渲染层任意打开新窗口；http(s) 交给系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // 仅允许应用自身与开发服务器导航
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = url.startsWith(APP_ORIGIN + '/') || isDevUrl(url);
    if (!allowed) {
      event.preventDefault();
      if (/^https:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl && isDevUrl(devUrl)) {
    win.loadURL(devUrl).catch((err) => {
      console.error('加载开发服务器失败:', err);
    });
  } else {
    if (devUrl) console.error('ELECTRON_START_URL 非本机地址，已忽略并使用生产构建。');
    win.loadURL(APP_ENTRY).catch((err) => {
      console.error('加载生产构建失败:', err);
    });
  }
  return win;
}

/* ============ 数据库文件桥（参数验证：渲染层不可信） ============ */

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
  if (!(data instanceof Uint8Array)) throw new Error('db:save 需要二进制数据（Uint8Array）');
  if (data.byteLength > MAX_DB_BYTES) throw new Error(`db:save 数据超过上限（${MAX_DB_BYTES} 字节）`);
  const file = path.join(app.getPath('userData'), DB_FILE);
  const tmp = `${file}.tmp`;
  // 先写临时文件再原子替换，避免写一半损坏
  await fs.writeFile(tmp, Buffer.from(data));
  await fs.rename(tmp, file);
});

/** 删除数据库文件（清空数据；渲染层已先关闭自身连接） */
ipcMain.handle('db:reset', async () => {
  const file = path.join(app.getPath('userData'), DB_FILE);
  await fs.rm(file, { force: true });
  await fs.rm(`${file}.tmp`, { force: true }).catch(() => undefined);
});

/* ============ Runner 桥（只做验证与转发，逻辑全部在 runner-core） ============ */

ipcMain.handle('runner:detect', async (_event, customPath) => {
  if (customPath !== undefined && customPath !== null && (typeof customPath !== 'string' || customPath.length > runnerCore.LIMITS.MAX_PATH_CHARS)) {
    throw new Error('runner:detect 参数非法');
  }
  return runnerCore.detectCompiler(customPath ?? undefined);
});

ipcMain.handle('runner:compileAndRun', async (_event, payload) => {
  // 渲染层不可信：先全字段验证，再进入 Runner Core
  const check = runnerCore.validateRunnerPayload(payload);
  if (!check.ok) {
    throw new Error(`runner payload 非法：${check.errors.join('；')}`);
  }
  const v = check.value;
  return runnerCore.compileAndRun(v.compiler, v.userCode, v.harness, v.cases, v.timeLimitMs);
});

ipcMain.handle('app:chooseCompilerPath', async () => {
  const filters =
    process.platform === 'win32'
      ? [{ name: '编译器', extensions: ['exe'] }, { name: '所有文件', extensions: ['*'] }]
      : [{ name: '所有文件', extensions: ['*'] }];
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters });
  return r.canceled ? null : r.filePaths[0] || null;
});

registerAppProtocolScheme();

app.whenReady().then(() => {
  attachAppProtocolHandler();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

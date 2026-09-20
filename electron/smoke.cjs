/**
 * Electron 冒烟测试：启动 → 加载生产构建 → 确认页面标题渲染 → 退出 0。
 * 用法：npm run build && npm run electron:smoke
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, sandbox: false, webSecurity: false },
  });
  let exitCode = 1;
  try {
    await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    // 等待 React 渲染出品牌名
    await new Promise((r) => setTimeout(r, 500));
    const ok = await win.webContents.executeJavaScript(
      `new Promise((resolve) => {
        const t0 = Date.now();
        const timer = setInterval(() => {
          if (document.body && document.body.innerText.includes('CuinCStructLab')) {
            clearInterval(timer); resolve(true);
          } else if (Date.now() - t0 > 15000) {
            clearInterval(timer); resolve(false);
          }
        }, 200);
      })`,
    );
    exitCode = ok ? 0 : 2;
    console.log(ok ? 'SMOKE-OK: 页面渲染成功' : 'SMOKE-FAIL: 未检测到页面内容');
  } catch (err) {
    console.error('SMOKE-ERROR:', err && err.message);
    exitCode = 3;
  } finally {
    app.exit(exitCode);
  }
});

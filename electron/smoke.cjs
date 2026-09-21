/**
 * Electron 冒烟测试：启动 → 经 app:// 协议加载生产构建 → 确认页面标题渲染 → 退出 0。
 * 用法：npm run build && npm run electron:smoke
 * 与生产窗口同安全配置（webSecurity/sandbox 开启），同时验证自定义协议加载链路。
 */
const { app, BrowserWindow } = require('electron');
const { registerAppProtocolScheme, attachAppProtocolHandler, APP_ENTRY } = require('./protocol.cjs');

registerAppProtocolScheme();

app.whenReady().then(async () => {
  attachAppProtocolHandler();
  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, webSecurity: true },
  });
  let exitCode = 1;
  try {
    await win.loadURL(APP_ENTRY);
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

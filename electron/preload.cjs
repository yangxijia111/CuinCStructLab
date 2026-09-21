/**
 * preload（sandbox 兼容：仅使用 contextBridge/ipcRenderer）：暴露最小数据库与 Runner 桥。
 * 所有参数在主进程二次验证（渲染层不可信，见 electron/main.cjs 与 SECURITY.md）。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cclabBridge', {
  isDesktop: true,
  dbLoad: () => ipcRenderer.invoke('db:load'),
  dbSave: (data) => ipcRenderer.invoke('db:save', data),
  dbReset: () => ipcRenderer.invoke('db:reset'),
  runnerDetect: (customPath) => ipcRenderer.invoke('runner:detect', customPath),
  runnerCompileAndRun: (payload) => ipcRenderer.invoke('runner:compileAndRun', payload),
  chooseCompilerPath: () => ipcRenderer.invoke('app:chooseCompilerPath'),
});

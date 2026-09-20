/**
 * preload：contextBridge 暴露最小 API（数据库字节读写 + Runner）。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cclabBridge', {
  isDesktop: true,
  dbLoad: () => ipcRenderer.invoke('db:load'),
  dbSave: (data) => ipcRenderer.invoke('db:save', data),
  runnerDetect: (customPath) => ipcRenderer.invoke('runner:detect', customPath),
  runnerCompileAndRun: (payload) => ipcRenderer.invoke('runner:compileAndRun', payload),
  chooseCompilerPath: () => ipcRenderer.invoke('app:chooseCompilerPath'),
});

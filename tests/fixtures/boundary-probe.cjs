// Test-owned adversarial preload; never included in Forge entry points or application packages.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('boundaryProbe', {
  invoke: (...args) => ipcRenderer.invoke('application:get-info', ...args),
});

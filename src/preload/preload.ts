import { contextBridge, ipcRenderer } from 'electron';
import { requestApplicationInfo } from '../shared/application-info';
import type { ApplicationBridge } from '../shared/application-info';

if (window.top === window) {
  const bridge: ApplicationBridge = {
    getApplicationInfo: () =>
      requestApplicationInfo((channel, request) => ipcRenderer.invoke(channel, request)),
  };
  contextBridge.exposeInMainWorld('rpgBuddy', bridge);
}

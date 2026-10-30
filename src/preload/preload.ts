import { contextBridge, ipcRenderer } from 'electron';
import { requestApplicationInfo } from '../shared/application-info';
import type { ApplicationBridge } from '../shared/application-info';
import { requestLog } from '../shared/logging-contract';

if (window.top === window) {
  const bridge: ApplicationBridge = {
    recordLog: (input) =>
      requestLog((channel, request) => ipcRenderer.invoke(channel, request), input),
    getApplicationInfo: () =>
      requestApplicationInfo((channel, request) => ipcRenderer.invoke(channel, request)),
  };
  contextBridge.exposeInMainWorld('rpgBuddy', bridge);
}

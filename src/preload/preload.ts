import { contextBridge, ipcRenderer } from 'electron';
import { requestApplicationInfo } from '../shared/application-info';
import type { ApplicationBridge } from '../shared/application-info';
import { requestLog } from '../shared/logging-contract';
import { requestLibrary } from '../shared/library-selection';

if (window.top === window) {
  const bridge: ApplicationBridge = {
    librarySelection: (request) =>
      requestLibrary((channel, payload) => ipcRenderer.invoke(channel, payload), request),
    recordLog: (input) =>
      requestLog((channel, request) => ipcRenderer.invoke(channel, request), input),
    getApplicationInfo: () =>
      requestApplicationInfo((channel, request) => ipcRenderer.invoke(channel, request)),
  };
  contextBridge.exposeInMainWorld('rpgBuddy', bridge);
}

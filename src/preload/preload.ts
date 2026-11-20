import { contextBridge, ipcRenderer } from 'electron';
import { requestApplicationInfo } from '../shared/application-info';
import type { ApplicationBridge } from '../shared/application-info';
import { requestLog } from '../shared/logging-contract';
import { requestLibrary } from '../shared/library-selection';
import {
  CREATE_CHARACTER_SHEET_CHANNEL,
  SHEET_CREATION_OPTIONS_CHANNEL,
} from '../shared/sheet-creation-contract';

// Signal a transport failure without forwarding raw IPC error details.
function signalTransportFailure(): never {
  throw new Error('The application bridge could not obtain a valid reply.');
}

if (window.top === window) {
  const bridge: ApplicationBridge = {
    getSheetCreationOptions: () => ipcRenderer.invoke(SHEET_CREATION_OPTIONS_CHANNEL),
    createCharacterSheet: (request) => ipcRenderer.invoke(CREATE_CHARACTER_SHEET_CHANNEL, request),
    librarySelection: (request, options) =>
      requestLibrary(
        (channel, payload) => ipcRenderer.invoke(channel, payload),
        request,
        options?.reportTransportFailure === true ? signalTransportFailure : undefined,
      ),
    recordLog: (input) =>
      requestLog((channel, request) => ipcRenderer.invoke(channel, request), input),
    getApplicationInfo: (options) =>
      requestApplicationInfo(
        (channel, request) => ipcRenderer.invoke(channel, request),
        options?.reportTransportFailure === true ? signalTransportFailure : undefined,
      ),
  };
  contextBridge.exposeInMainWorld('rpgBuddy', bridge);
}

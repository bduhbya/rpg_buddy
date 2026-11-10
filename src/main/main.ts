import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { APPLICATION_INFO_CHANNEL } from '../shared/application-info';
import { createApplicationInfoHandler } from './application-info';
import path from 'node:path';
import { LOG_CHANNEL } from '../shared/logging-contract';
import type { LogReason } from '../shared/logging-contract';
import { LogService } from './logging';
import { createLogHandler, operationId } from './logging-ipc';
import { installDiagnosticsMenu } from './menu';
import { LIBRARY_SELECTION_CHANNEL } from '../shared/library-selection';
import { createLibraryHandler } from './library-ipc';
import { LibrarySelection } from './library-selection';
import { createMainWorkflowLog } from './workflow-log';

const logging = new LogService({
  directory: path.join(app.getPath('userData'), 'logs'),
  metadata: {
    buildId: RPG_BUDDY_BUILD_ID,
    appVersion: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  debug: process.env.RPG_BUDDY_LOG_LEVEL === 'debug',
  development: !app.isPackaged,
});
let terminating = false;
let fatalInProgress = false;
// Record the fatal outcome and drain diagnostics before exiting nonzero.
function fatal(error: unknown, reason: LogReason, startupOperationId?: string): void {
  if (fatalInProgress) return;
  fatalInProgress = true;
  terminating = true;
  createMainWorkflowLog(logging, 'application.lifecycle', {
    operationId: startupOperationId,
  }).record({ step: 'process.exit', outcome: 'failed', reason, level: 'fatal' }, error);
  const deadline = setTimeout(() => app.exit(1), 2500);
  void logging.close().finally(() => {
    clearTimeout(deadline);
    app.exit(1);
  });
}
process.on('uncaughtException', (error) => fatal(error, 'UNCAUGHT_EXCEPTION'));
process.on('unhandledRejection', (error) => fatal(error, 'UNHANDLED_REJECTION'));

let mainWindow: BrowserWindow | undefined;
// Forge's packaged file URL contains platform separators and unescaped spaces.
// Compare the same canonical URL Chromium uses, never a prefix or origin alone.
const trustedDocument = new URL(MAIN_WINDOW_WEBPACK_ENTRY).href;
const librarySelection = new LibrarySelection(app.getPath('userData'), logging);
ipcMain.handle(
  LIBRARY_SELECTION_CHANNEL,
  createLibraryHandler(
    () => mainWindow?.webContents,
    trustedDocument,
    librarySelection,
    async (owner) => {
      const window = BrowserWindow.fromWebContents(owner);
      if (!window || window.isDestroyed()) return undefined;
      const result = await dialog.showOpenDialog(window, {
        title: 'Choose library folder',
        properties: ['openDirectory'],
      });
      return result.canceled ? undefined : result.filePaths[0];
    },
    logging,
  ),
);
ipcMain.handle(
  LOG_CHANNEL,
  createLogHandler(() => mainWindow?.webContents, trustedDocument, logging),
);
logging.record({
  event: 'application.lifecycle',
  step: 'process.start',
  outcome: 'started',
  level: 'info',
  operationId: operationId(),
});
logging.record({
  event: 'diagnostic.debug',
  step: 'trace.emit',
  outcome: 'succeeded',
  level: 'debug',
  operationId: operationId(),
});

ipcMain.handle(
  APPLICATION_INFO_CHANNEL,
  createApplicationInfoHandler(
    () => mainWindow?.webContents,
    trustedDocument,
    () => ({
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    }),
    logging,
  ),
);

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    title: 'RPG Buddy',
    width: 960,
    height: 640,
    minWidth: 360,
    minHeight: 320,
    backgroundColor: '#f5f3ef',
    show: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  mainWindow = window;
  window.webContents.on('render-process-gone', () => {
    logging.record({
      event: 'renderer.lifecycle',
      step: 'process.exit',
      outcome: 'terminated',
      reason: 'RENDERER_PROCESS_TERMINATED',
      level: 'error',
      operationId: operationId(),
    });
  });
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined;
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== trustedDocument) event.preventDefault();
  });
  window.webContents.on('will-frame-navigate', (event) => {
    if (!event.isMainFrame || event.url !== trustedDocument) event.preventDefault();
  });
  window.webContents.on('will-redirect', (event, url) => {
    if (url !== trustedDocument) event.preventDefault();
  });

  window.once('ready-to-show', () => window.show());
  await window.loadURL(trustedDocument);
}

// Correlate the failed startup checkpoint with the fatal termination it triggers.
function reportStartupFailure(error: unknown): void {
  const log = createMainWorkflowLog(logging, 'application.lifecycle');
  log.record(
    { step: 'window.load', outcome: 'failed', reason: 'WINDOW_STARTUP_FAILED', level: 'error' },
    error,
  );
  dialog.showErrorBox(
    'RPG Buddy could not start',
    'The application could not start. Local diagnostic logs may contain more information.',
  );
  fatal(error, 'WINDOW_STARTUP_FAILED', log.operationId);
}

void app
  .whenReady()
  .then(() => {
    installDiagnosticsMenu(logging);
    return createWindow();
  })
  .catch(reportStartupFailure);
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow().catch(reportStartupFailure);
  }
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', (event) => {
  if (terminating) return;
  event.preventDefault();
  terminating = true;
  logging.record({
    event: 'application.lifecycle',
    step: 'process.exit',
    outcome: 'succeeded',
    level: 'info',
    operationId: operationId(),
  });
  void logging.close().finally(() => app.quit());
});

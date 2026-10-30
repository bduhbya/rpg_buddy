import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { APPLICATION_INFO_CHANNEL } from '../shared/application-info';
import { createApplicationInfoHandler } from './application-info';
import path from 'node:path';
import { LOG_CHANNEL, sanitizeError } from '../shared/logging-contract';
import type { LogReason } from '../shared/logging-contract';
import { LogService } from './logging';
import { createLogHandler, operationId } from './logging-ipc';
import { installDiagnosticsMenu } from './menu';

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
function fatal(error: unknown, reason: LogReason): void {
  if (fatalInProgress) return;
  fatalInProgress = true;
  terminating = true;
  logging.record({
    event: 'application.fatal',
    reason,
    level: 'fatal',
    operationId: operationId(),
    error: sanitizeError(error),
  });
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
ipcMain.handle(
  LOG_CHANNEL,
  createLogHandler(() => mainWindow?.webContents, trustedDocument, logging),
);
logging.record({ event: 'application.started', level: 'info', operationId: operationId() });
logging.record({ event: 'application.debug', level: 'debug', operationId: operationId() });

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
    logging.record({ event: 'renderer.terminated', level: 'error', operationId: operationId() });
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

function reportStartupFailure(error: unknown): void {
  logging.record({
    event: 'application.startup.failed',
    reason: 'WINDOW_STARTUP_FAILED',
    level: 'error',
    operationId: operationId(),
    error: sanitizeError(error),
  });
  dialog.showErrorBox(
    'RPG Buddy could not start',
    'The application could not start. Local diagnostic logs may contain more information.',
  );
  fatal(error, 'WINDOW_STARTUP_FAILED');
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
  logging.record({ event: 'application.stopped', level: 'info', operationId: operationId() });
  void logging.close().finally(() => app.quit());
});

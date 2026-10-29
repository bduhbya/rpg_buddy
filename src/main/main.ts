import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { APPLICATION_INFO_CHANNEL } from '../shared/application-info';
import { createApplicationInfoHandler } from './application-info';

let mainWindow: BrowserWindow | undefined;
// Forge's packaged file URL contains platform separators and unescaped spaces.
// Compare the same canonical URL Chromium uses, never a prefix or origin alone.
const trustedDocument = new URL(MAIN_WINDOW_WEBPACK_ENTRY).href;

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
  console.error('RPG Buddy startup failed:', error);
  dialog.showErrorBox(
    'RPG Buddy could not start',
    error instanceof Error ? error.message : String(error),
  );
  app.exit(1);
}

void app.whenReady().then(createWindow).catch(reportStartupFailure);
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow().catch(reportStartupFailure);
  }
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

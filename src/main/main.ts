import { app, BrowserWindow, dialog } from 'electron';

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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => window.show());
  await window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
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

import { Menu, MenuItem } from 'electron';
import type { LogService } from './logging';

export function installDiagnosticsMenu(
  logging: Pick<LogService, 'debugEnabled' | 'setDebugEnabled'>,
): void {
  const menu =
    Menu.getApplicationMenu() ??
    Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
      { role: 'fileMenu' },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ]);
  if (menu.getMenuItemById('debug-tracing')) return;
  menu.append(
    new MenuItem({
      label: '&Diagnostics',
      submenu: [
        {
          id: 'debug-tracing',
          label: 'Enable &debug tracing',
          type: 'checkbox',
          checked: logging.debugEnabled,
          click: (item) => {
            logging.setDebugEnabled(item.checked);
            item.checked = logging.debugEnabled;
          },
        },
      ],
    }),
  );
  Menu.setApplicationMenu(menu);
}

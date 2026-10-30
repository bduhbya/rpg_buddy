import { expect, _electron as electron } from '@playwright/test';
import { test } from './fixtures/test-profile';
import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';

test('native debug checkbox controls logging and resets to the next launch default', async ({
  profiles,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'packaged', 'Requires packaged native-menu automation');
  // Reuse only this test's disposable profile to genuinely test a restart
  // without losing persistent state that could incorrectly retain the toggle.
  const profile = profiles.create();
  for (const startupDebug of [false, false, true, true]) {
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    );
    delete env.ELECTRON_RUN_AS_NODE;
    if (startupDebug) env.RPG_BUDDY_LOG_LEVEL = 'debug';
    else delete env.RPG_BUDDY_LOG_LEVEL;
    const application = await electron.launch({
      executablePath: path.resolve(
        'out',
        `RPG Buddy-${process.platform}-${process.arch}`,
        process.platform === 'win32' ? 'RPG Buddy.exe' : 'RPG Buddy',
      ),
      env,
      args: profile.args,
    });
    const child = application.process();
    profile.track(child);
    try {
      const page = await application.firstWindow();
      await expect(page.getByRole('heading', { name: 'RPG Buddy', exact: true })).toBeVisible();
      await profile.verifyStartup(application);
      const initial = await application.evaluate(({ Menu, app }) => {
        const menu = Menu.getApplicationMenu()!;
        const item = menu.getMenuItemById('debug-tracing')!;
        return {
          checked: item.checked,
          label: item.label,
          type: item.type,
          menus: menu.items.map((entry) => entry.label),
          directory: app.getPath('userData') + '/logs',
          pid: process.pid,
        };
      });
      expect(initial.checked).toBe(startupDebug);
      expect(initial.type).toBe('checkbox');
      expect(initial.label.replaceAll('&', '')).toBe('Enable debug tracing');
      expect(initial.menus.map((label) => label.replaceAll('&', ''))).toContain('Diagnostics');
      expect(initial.menus.length).toBeGreaterThan(1);
      for (const expected of [!startupDebug, startupDebug]) {
        const checked = await application.evaluate(({ Menu, BrowserWindow }) => {
          const window = BrowserWindow.getAllWindows()[0]!;
          const item = Menu.getApplicationMenu()!.getMenuItemById('debug-tracing')!;
          // Invoke Electron's native MenuItem.click wrapper, which flips the
          // checkbox before invoking our application callback.
          item.click({}, window, window.webContents);
          return item.checked;
        });
        expect(checked).toBe(expected);
      }
      const rows = (
        await Promise.all(
          (await readdir(initial.directory))
            .filter((file) => file.endsWith('.jsonl'))
            .map((file) => readFile(path.join(initial.directory, file), 'utf8')),
        )
      )
        .join('')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const session = rows.findLast(
        (row) => row.pid === initial.pid && row.event === 'application.started',
      ).sessionId;
      const current = rows.filter((row) => row.sessionId === session);
      expect(current.filter((row) => row.event === 'diagnostic.debug.enabled')).toHaveLength(1);
      expect(current.filter((row) => row.event === 'diagnostic.debug.disabled')).toHaveLength(1);
      const enabled = current.find((row) => row.event === 'diagnostic.debug.enabled');
      expect(
        current.some(
          (row) =>
            row.event === 'application.debug' &&
            row.level === 'debug' &&
            row.operationId === enabled.operationId,
        ),
      ).toBe(true);
      expect(current.filter((row) => row.event === 'application.debug')).toHaveLength(
        startupDebug ? 2 : 1,
      );
      // Leave the launch with the opposite setting, so the next launch proves
      // the menu choice was not persisted over its environment default.
      expect(
        await application.evaluate(({ Menu, BrowserWindow }) => {
          const window = BrowserWindow.getAllWindows()[0]!;
          const item = Menu.getApplicationMenu()!.getMenuItemById('debug-tracing')!;
          item.click({}, window, window.webContents);
          return item.checked;
        }),
      ).toBe(!startupDebug);
    } finally {
      if (child.exitCode === null) {
        const exited = new Promise<number | null>((resolve) => child.once('exit', resolve));
        await application.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0]!.close(),
        );
        expect(await exited).toBe(0);
      }
    }
  }
});

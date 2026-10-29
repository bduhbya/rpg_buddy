import { expect } from '@playwright/test';
import path from 'node:path';
import { test } from './fixtures/desktop-shell';

test('startup displays application information and reloads', async ({
  shell: { page, application },
}) => {
  // Check first startup, then reload with listeners active before any renderer scripts run.
  await expect(page.getByRole('heading', { name: 'RPG Buddy', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.reload();
  await expect(page).toHaveTitle('RPG Buddy');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('RPG Buddy');
  await expect(page.getByText('RPG Buddy is ready.', { exact: true })).toBeVisible();
  expect(await page.locator('html').getAttribute('lang')).toBe('en');
  const information = page.getByRole('region', { name: 'Application information' });
  await expect(information.getByText('0.1.0', { exact: true })).toBeVisible();
  const info = await page.evaluate(() => window.rpgBuddy.getApplicationInfo());
  expect(info.ok).toBe(true);
  if (!info.ok) throw new Error('Application info request failed');
  expect(info.info.name).toBe('RPG Buddy');
  for (const version of [info.info.electron, info.info.chrome, info.info.node]) {
    expect(version).toMatch(/^\d+\.\d+/);
    await expect(information.getByText(version, { exact: true })).toBeVisible();
  }
  if (application) {
    expect(info.info).toEqual(
      await application.evaluate(({ app }) => ({
        name: app.getName(),
        version: app.getVersion(),
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
      })),
    );
  }
});

test('bridge isolates child frames and blocks navigation and popups', async ({
  shell: { page },
}) => {
  expect(
    await page.evaluate(() => ({
      require: typeof (globalThis as unknown as Record<string, unknown>).require,
      process: typeof (globalThis as unknown as Record<string, unknown>).process,
    })),
  ).toEqual({ require: 'undefined', process: 'undefined' });

  expect(await page.evaluate(() => Object.keys(window.rpgBuddy))).toEqual(['getApplicationInfo']);
  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.id = 'boundary-frame';
    document.body.append(iframe);
  });
  const child = page.frames().find((frame) => frame !== page.mainFrame());
  expect(child).toBeDefined();
  expect(await child!.evaluate(() => typeof window.rpgBuddy)).toBe('undefined');
  await page.locator('#boundary-frame').evaluate((element) => element.remove());
  expect(await page.evaluate(() => window.open('about:blank'))).toBeNull();
  const trustedURL = page.url();
  const navigationSession = await page.context().newCDPSession(page);
  let unexpectedRequest = false;
  page.on('request', (request) => {
    if (request.url().startsWith('https://example.invalid/')) unexpectedRequest = true;
  });
  await page.evaluate(() => {
    location.href = 'https://example.invalid/unexpected';
  });
  // Electron cancels this navigation before a network request. Chromium can leave
  // Playwright's navigation barrier pending; clear that barrier after checking
  // the live document through CDP, which does not wait for a navigation commit.
  const documentURL = await navigationSession.send('Runtime.evaluate', {
    expression: 'location.href',
    returnByValue: true,
  });
  expect(documentURL.result.value).toBe(trustedURL);
  expect(unexpectedRequest).toBe(false);
  await navigationSession.send('Page.stopLoading');
  await navigationSession.detach();
  await page.reload();
  await expect(
    page
      .getByRole('region', { name: 'Application information' })
      .getByText('0.1.0', { exact: true }),
  ).toBeVisible();
});

test('shell remains readable at narrow width and doubled text', async ({
  shell: { page },
}, testInfo) => {
  await expect(
    page
      .getByRole('region', { name: 'Application information' })
      .getByText('0.1.0', { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 360, height: 320 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByText('RPG Buddy is ready.', { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText('RPG Buddy is ready.', { exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('shell.png'), fullPage: true });
});

test.describe('packaged IPC', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'packaged', 'Requires packaged main-process automation');
  });

  test('rejects foreign senders and malformed requests without disrupting information', async ({
    shell: { page, application },
  }) => {
    if (!application) throw new Error('Packaged application is required.');
    const information = page.getByRole('region', { name: 'Application information' });
    const rejected = await application.evaluate(async ({ BrowserWindow }, preload) => {
      const probe = new BrowserWindow({
        show: false,
        webPreferences: {
          preload,
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
        },
      });
      try {
        await probe.loadURL('about:blank');
        return await probe.webContents.executeJavaScript(
          'window.boundaryProbe.invoke({ apiVersion: 1 })',
        );
      } finally {
        probe.destroy();
      }
    }, path.resolve('tests/fixtures/boundary-probe.cjs'));
    expect(rejected).toEqual({ ok: false, code: 'FORBIDDEN' });
    // Install an adversarial test-only preload through the automation-owned
    // main process. The shipped bridge never accepts arbitrary IPC payloads.
    const probeId = await application.evaluate(
      ({ BrowserWindow }, filePath) =>
        BrowserWindow.getAllWindows()[0]!.webContents.session.registerPreloadScript({
          type: 'frame',
          filePath,
        }),
      path.resolve('tests/fixtures/boundary-probe.cjs'),
    );
    try {
      await page.reload();
      const replies = await page.evaluate(async () => {
        const probe = (
          window as unknown as { boundaryProbe: { invoke(...args: unknown[]): Promise<unknown> } }
        ).boundaryProbe;
        const results = [];
        for (const args of [
          [],
          [null],
          [{ apiVersion: 2 }],
          [{ apiVersion: 1, extra: true }],
          [{ apiVersion: 1 }, 'extra'],
        ]) {
          results.push(await probe.invoke(...args));
        }
        return results;
      });
      expect(replies).toEqual(
        Array.from({ length: 5 }, () => ({ ok: false, code: 'INVALID_REQUEST' })),
      );
      await expect(information.getByText('0.1.0', { exact: true })).toBeVisible();
    } finally {
      await application.evaluate(
        ({ BrowserWindow }, id) =>
          BrowserWindow.getAllWindows()[0]!.webContents.session.unregisterPreloadScript(id),
        probeId,
      );
    }
  });

  test('shows accessible failure feedback when the handler is unavailable', async ({
    shell: { page, application },
  }) => {
    if (!application) throw new Error('Packaged application is required.');
    await page.setViewportSize({ width: 360, height: 320 });
    await application.evaluate(({ ipcMain }) => ipcMain.removeHandler('application:get-info'));
    await page.reload();
    await expect(page.getByRole('alert')).toHaveText(
      'Application information is unavailable. Reload to try again.',
    );
    expect(
      await page
        .getByRole('alert')
        .evaluate((element) => element.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
  });
});

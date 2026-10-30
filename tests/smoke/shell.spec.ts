import { expect } from '@playwright/test';
import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { test } from './fixtures/desktop-shell';

test('development and packaged diagnostics write to the disposable startup profile', async ({
  shell: { page, profile, application },
}) => {
  await profile.verifyStartup(application);
  await page.getByRole('button', { name: 'Simulate diagnostic failure' }).click();
  const status = page.getByRole('status').filter({ hasText: 'Diagnostic queued.' });
  await expect(status).toBeVisible();
  const operation = (await status.innerText()).split('Operation ID: ')[1]!;
  const lines = (await readFile(path.join(profile.userData, 'logs', 'application.jsonl'), 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  expect(lines.some((row) => row.event === 'application.started')).toBe(true);
  expect(
    lines
      .filter((row) => row.operationId === operation)
      .map((row) => row.event)
      .sort(),
  ).toEqual(['diagnostic.main.failure', 'diagnostic.renderer.failure']);
});

test('keyboard diagnostic failure reports correlated sanitized records', async ({
  shell: { page, application },
}) => {
  const button = page.getByRole('button', { name: 'Simulate diagnostic failure' });
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
  const status = page.getByRole('status').filter({ hasText: 'Diagnostic queued.' });
  await expect(status).toContainText('Operation ID:');
  const operation = (await status.innerText()).split('Operation ID: ')[1]!;
  expect(operation).toMatch(/^[a-f0-9-]{36}$/);
  await page.evaluate(() => {
    window.dispatchEvent(
      new ErrorEvent('error', { error: new TypeError('private renderer contents') }),
    );
    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.resolve(),
        reason: new RangeError('private rejected contents'),
      }),
    );
  });
  await page.setViewportSize({ width: 360, height: 320 });
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (application) {
    const directory = await application.evaluate(({ app }) => app.getPath('userData') + '/logs');
    const lines = (
      await Promise.all(
        (await readdir(directory))
          .filter((file) => file.endsWith('.jsonl'))
          .map((file) => readFile(path.join(directory, file), 'utf8')),
      )
    )
      .join('')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const pair = lines.filter((row) => row.operationId === operation);
    expect(pair.map((row) => row.event).sort()).toEqual([
      'diagnostic.main.failure',
      'diagnostic.renderer.failure',
    ]);
    expect(new Set(pair.map((row) => row.sessionId)).size).toBe(1);
    expect(new Set(pair.map((row) => row.source))).toEqual(new Set(['main', 'renderer']));
    const captured = lines.filter(
      (row) =>
        row.sessionId === pair[0].sessionId &&
        ['renderer.error', 'renderer.rejection'].includes(row.event),
    );
    expect(captured.map((row) => row.event).sort()).toEqual([
      'renderer.error',
      'renderer.rejection',
    ]);
    expect(JSON.stringify(captured)).not.toContain('private');
    for (const row of pair) {
      expect(row.timestamp).toMatch(/Z$/);
      expect(row.error.name).toBe('Error');
      expect(row.error.stack).toContain('at [source]:');
      expect(JSON.stringify(row)).not.toMatch(/Simulated diagnostic failure|Users|\.tsx|\.cjs/);
      expect(row.appVersion).toBe('0.1.0');
      expect(row.buildId).toMatch(
        /^(?:[a-f0-9]{12}|nogit)-[a-f0-9]{20}-production-[a-z0-9]+-[a-z0-9]+$/,
      );
      expect(row.reason).toBe('SIMULATED_FAILURE');
      expect(row.stackFormat).toBe('compiled-js');
      expect(row.pid).toBeGreaterThan(0);
    }
    expect(new Set(pair.map((row) => row.buildId)).size).toBe(1);
  }
});

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

  expect(await page.evaluate(() => Object.keys(window.rpgBuddy).sort())).toEqual([
    'getApplicationInfo',
    'recordLog',
  ]);
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

  test('logging transport failure leaves application information available', async ({
    shell: { page, application },
  }) => {
    if (!application) throw Error('Packaged application is required');
    await application.evaluate(({ ipcMain }) => ipcMain.removeHandler('diagnostics:record'));
    await page.getByRole('button', { name: 'Simulate diagnostic failure' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'Diagnostic logging is unavailable. The application can still be used.',
    );
    expect((await page.evaluate(() => window.rpgBuddy.getApplicationInfo())).ok).toBe(true);
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
          'Promise.all([window.boundaryProbe.invoke({ apiVersion: 1 }), window.boundaryProbe.logInvoke({ apiVersion: 1 })])',
        );
      } finally {
        probe.destroy();
      }
    }, path.resolve('tests/fixtures/boundary-probe.cjs'));
    expect(rejected).toEqual([
      { ok: false, code: 'FORBIDDEN' },
      { ok: false, code: 'FORBIDDEN' },
    ]);
    const logLocation = await application.evaluate(({ app }) => ({
      directory: app.getPath('userData') + '/logs',
      pid: process.pid,
    }));
    const diagnosticRows = (
      await Promise.all(
        (await readdir(logLocation.directory))
          .filter((file) => file.endsWith('.jsonl'))
          .map((file) => readFile(path.join(logLocation.directory, file), 'utf8')),
      )
    )
      .join('')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    for (const event of ['application.info.failed', 'diagnostic.request.rejected']) {
      expect(
        diagnosticRows.some(
          (row) =>
            row.pid === logLocation.pid &&
            row.event === event &&
            row.reason === 'FORBIDDEN' &&
            /-production-/.test(row.buildId),
        ),
      ).toBe(true);
    }
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
          window as unknown as {
            boundaryProbe: {
              invoke(...args: unknown[]): Promise<unknown>;
              logInvoke(...args: unknown[]): Promise<unknown>;
            };
          }
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
          results.push(await probe.logInvoke(...args));
        }
        return results;
      });
      expect(replies).toEqual(
        Array.from({ length: 10 }, () => ({ ok: false, code: 'INVALID_REQUEST' })),
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

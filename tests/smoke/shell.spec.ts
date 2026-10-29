import { test, expect, chromium, _electron as electron } from '@playwright/test';
import type { Browser, ElectronApplication, Page } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No debugging port available.');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

function stopProcessTree(child: ChildProcess): void {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
  } else {
    // The development child owns its process group on Unix.
    process.kill(-child.pid, 'SIGTERM');
  }
}

test('desktop shell starts, renders and remains readable', async ({}, testInfo) => {
  let development: ChildProcess | undefined;
  let browser: Browser | undefined;
  let application: ElectronApplication | undefined;
  let page: Page | undefined;
  let output = '';
  const rendererErrors: string[] = [];
  const assetErrors: string[] = [];
  const env: Record<string, string> = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;

  try {
    if (testInfo.project.name === 'development') {
      const port = await unusedPort();
      development = spawn(
        process.execPath,
        [
          'node_modules/@electron-forge/cli/dist/electron-forge-start.js',
          '--',
          `--remote-debugging-port=${port}`,
          '--remote-debugging-address=127.0.0.1',
        ],
        {
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          detached: process.platform !== 'win32',
        },
      );
      development.on('error', (error) => {
        output += error.stack;
      });
      development.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });
      development.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });
      const endpoint = `http://127.0.0.1:${port}`;
      await expect
        .poll(
          async () => {
            if (development?.exitCode !== null) throw new Error(`Forge exited early: ${output}`);
            try {
              return (await fetch(`${endpoint}/json/version`)).ok;
            } catch {
              return false;
            }
          },
          { timeout: 60_000, message: 'Forge must launch a debuggable development window' },
        )
        .toBe(true);
      browser = await chromium.connectOverCDP(endpoint);
      page = browser.contexts()[0]?.pages()[0];
      if (!page) throw new Error('Forge did not create a renderer window.');
      expect(page.url()).toMatch(/^http:\/\/(?:127\.0\.0\.1|localhost):5173/);
    } else {
      const executablePath = path.resolve(
        'out',
        `RPG Buddy-${process.platform}-${process.arch}`,
        process.platform === 'win32' ? 'RPG Buddy.exe' : 'RPG Buddy',
      );
      application = await electron.launch({ executablePath, env });
      application.process().stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });
      application.process().stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });
      page = await application.firstWindow();
      expect(page.url()).toMatch(/^file:/);
      expect(await application.evaluate(({ app }) => app.isPackaged)).toBe(true);
    }

    page.on('pageerror', (error) => rendererErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') rendererErrors.push(message.text());
    });
    page.on('requestfailed', (request) =>
      assetErrors.push(`${request.url()}: ${request.failure()?.errorText}`),
    );
    page.on('response', (response) => {
      if (response.status() >= 400) assetErrors.push(`${response.status()} ${response.url()}`);
    });
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
    expect(
      await page.evaluate(() => ({
        require: typeof (globalThis as unknown as Record<string, unknown>).require,
        process: typeof (globalThis as unknown as Record<string, unknown>).process,
      })),
    ).toEqual({ require: 'undefined', process: 'undefined' });

    await page.setViewportSize({ width: 360, height: 320 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByText('RPG Buddy is ready.', { exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByText('RPG Buddy is ready.', { exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('shell.png'), fullPage: true });
    expect(rendererErrors).toEqual([]);
    expect(assetErrors).toEqual([]);
    expect(output).not.toMatch(
      /RPG Buddy startup failed|Uncaught|Error launching app|Unable to find Electron app/i,
    );

    if (development && process.platform !== 'darwin') {
      await page.close();
      await expect.poll(() => development?.exitCode, { timeout: 10_000 }).toBe(0);
    }
    if (application && process.platform !== 'darwin') {
      const exited = new Promise<number | null>((resolve) =>
        application!.process().once('exit', resolve),
      );
      await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
      expect(await exited).toBe(0);
      application = undefined;
    }
  } finally {
    if (application) await application.close();
    if (browser) await browser.close();
    if (development) stopProcessTree(development);
    await writeFile(
      testInfo.outputPath('diagnostics.json'),
      JSON.stringify({ output, rendererErrors, assetErrors }, null, 2),
    );
    await testInfo.attach('process-output', { body: output, contentType: 'text/plain' });
    await testInfo.attach('renderer-errors', {
      body: JSON.stringify({ rendererErrors, assetErrors }),
      contentType: 'application/json',
    });
  }
});

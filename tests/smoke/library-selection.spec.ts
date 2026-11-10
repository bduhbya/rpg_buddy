import { expect, _electron as electron } from '@playwright/test';
import { cp, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from './fixtures/desktop-shell';

test('keyboard controls choose a library, preserve cancellation, and recover from a bad system', async ({
  shell,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'packaged', 'Requires main-process dialog automation');
  const { page, application, profile } = shell;
  if (!application) throw new Error('Expected a packaged Electron application.');

  const library = path.join(profile.root, 'game-library');
  await cp(path.resolve('runtime-library'), library, { recursive: true });
  const malformed = path.join(library, 'RPG_systems', 'malformed');
  await mkdir(malformed);
  await writeFile(path.join(malformed, 'system.json'), '{invalid');

  // Replace only the native dialog result. All IPC, selection and filesystem code stays live.
  await application.evaluate(({ dialog }, folder) => {
    let attempts = 0;
    dialog.showOpenDialog = async () => {
      const canceled = attempts++ > 0;
      return { canceled, filePaths: canceled ? [] : [folder] };
    };
  }, library);

  const panel = page.getByRole('region', { name: 'Game library' });
  const picker = panel.getByRole('button', { name: 'Choose library folder' });
  const system = panel.getByRole('combobox', { name: 'Game system' });
  const load = panel.getByRole('button', { name: 'Load system' });
  await picker.focus();
  await page.keyboard.press('Enter');
  await expect(panel.getByRole('status')).toHaveText(/Library folder selected.*game-library/);
  await expect(picker).toBeFocused();
  await expect(system).toHaveValue('');
  await expect(system.getByRole('option')).toHaveText([
    'Choose a system',
    'malformed',
    'rogue-trader',
  ]);

  await page.keyboard.press('Tab');
  await expect(system).toBeFocused();
  await page.keyboard.press('End');
  await expect(system).toHaveValue('rogue-trader');
  await page.keyboard.press('Tab');
  await expect(load).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(panel.getByRole('status')).toHaveText(/Loaded Rogue Trader/);
  await expect(panel.getByText(/^Active system: Rogue Trader/)).toBeVisible();

  await picker.focus();
  await page.keyboard.press('Enter');
  await expect(panel.getByRole('status')).toHaveText('Folder selection cancelled.');
  await expect(picker).toBeFocused();
  await expect(panel.getByText(/^Active system: Rogue Trader/)).toBeVisible();

  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowUp');
  await expect(system).toHaveValue('malformed');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(panel.getByRole('alert')).toHaveText(
    /Could not load malformed.*malformed\/system\.json/,
  );
  await expect(panel.getByText(/^Active system:/)).toHaveCount(0);

  await page.keyboard.press('Shift+Tab');
  await expect(system).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(panel.getByText(/^Active system: Rogue Trader/)).toBeVisible();

  const preference = await readFile(path.join(profile.userData, 'library-preference.json'), 'utf8');
  expect(JSON.parse(preference)).toEqual({ folder: await realpath(library) });
  const logs = await readFile(path.join(profile.userData, 'logs', 'application.jsonl'), 'utf8');
  expect(logs).toContain('library.definitions.active.completed');
  expect(logs).toContain('library.definitions.active.failed');
});

test('relaunch restores the library folder and starts without a selected system', async ({
  profiles,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'packaged', 'Requires two packaged Electron launches');
  const profile = profiles.create();
  const library = path.join(profile.root, 'remembered-library');
  await cp(path.resolve('runtime-library'), library, { recursive: true });
  await writeFile(
    path.join(profile.userData, 'library-preference.json'),
    JSON.stringify({ folder: library }),
  );
  const executablePath = path.resolve(
    'out',
    `RPG Buddy-${process.platform}-${process.arch}`,
    process.platform === 'win32' ? 'RPG Buddy.exe' : 'RPG Buddy',
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;

  for (const launch of ['initial', 'restart']) {
    const application = await electron.launch({ executablePath, args: profile.args, env });
    profile.track(application.process());
    try {
      const page = await application.firstWindow();
      const panel = page.getByRole('region', { name: 'Game library' });
      const system = panel.getByRole('combobox', { name: 'Game system' });
      await expect(panel.getByText('Library folder: remembered-library')).toBeVisible();
      await expect(system).toHaveValue('');
      await expect(panel.getByText(/^Active system:/)).toHaveCount(0);
      if (launch === 'initial') {
        await system.selectOption('rogue-trader');
        await panel.getByRole('button', { name: 'Load system' }).click();
        await expect(panel.getByText(/^Active system: Rogue Trader/)).toBeVisible();
      }
    } finally {
      await application.close();
    }
  }
});

for (const pickerOutcome of ['none', 'cancelled', 'rejected'] as const) {
  test(`reloading during a load restores the completed system with picker outcome ${pickerOutcome}`, async ({
    shell,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'packaged', 'Requires main-process file-read automation');
    const { page, application, profile } = shell;
    if (!application) throw new Error('Expected a packaged Electron application.');
    const library = path.join(profile.root, 'reload-library');
    await cp(path.resolve('runtime-library'), library, { recursive: true });
    await application.evaluate(
      ({ dialog }, { folder, outcome, invalidFolder }) => {
        let attempts = 0;
        dialog.showOpenDialog = async () => {
          if (attempts++ === 0) return { canceled: false, filePaths: [folder] };
          if (outcome === 'cancelled') return { canceled: true, filePaths: [] };
          return { canceled: false, filePaths: [invalidFolder] };
        };
      },
      { folder: library, outcome: pickerOutcome, invalidFolder: profile.root },
    );

    const panel = page.getByRole('region', { name: 'Game library' });
    await panel.getByRole('button', { name: 'Choose library folder' }).click();
    const system = panel.getByRole('combobox', { name: 'Game system' });
    await system.selectOption('rogue-trader');

    const manifest = path.join(
      await realpath(library),
      'RPG_systems',
      'rogue-trader',
      'system.json',
    );
    // Pause just the selected manifest read. Restore the original function as soon as it is hit.
    await application.evaluate((_electron, filename) => {
      const fs = process.getBuiltinModule('node:fs/promises')!;
      const original = fs.readFile;
      const gate = { reached: false, release: () => {} };
      const waiting = new Promise<void>((resolve) => {
        gate.release = resolve;
      });
      Reflect.set(globalThis, 'libraryReloadReadGate', gate);
      fs.readFile = (async (...args: Parameters<typeof original>) => {
        if (args[0] === filename) {
          fs.readFile = original;
          gate.reached = true;
          await waiting;
        }
        return Reflect.apply(original, fs, args);
      }) as typeof original;
    }, manifest);

    try {
      await panel.getByRole('button', { name: 'Load system' }).click();
      await expect
        .poll(() =>
          application.evaluate(() => Reflect.get(globalThis, 'libraryReloadReadGate').reached),
        )
        .toBe(true);
      await page.reload();
      // Wait until the new shell has handled its application-info IPC call.
      await expect(
        page
          .getByRole('region', { name: 'Application information' })
          .getByText('Electron', { exact: true }),
      ).toBeVisible();
      if (pickerOutcome !== 'none') {
        const picker = panel.getByRole('button', { name: 'Choose library folder' });
        await picker.click();
        if (pickerOutcome === 'cancelled') {
          await expect(panel.getByRole('status')).toHaveText('Folder selection cancelled.');
        } else {
          await expect(panel.getByRole('alert')).toHaveText(/Choose a readable library folder/);
        }
        await expect(picker).toBeFocused();
      }
    } finally {
      await application.evaluate(() => Reflect.get(globalThis, 'libraryReloadReadGate').release());
    }

    await expect(panel.getByText(/^Active system: Rogue Trader/)).toBeVisible();
    await expect(system).toHaveValue('rogue-trader');
    await expect(panel.getByRole('status')).toHaveText(/Loaded Rogue Trader/);
  });
}

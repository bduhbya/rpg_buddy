import { expect } from '@playwright/test';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Instance } from '../../src/domain/definitions/document-models';
import {
  readAuthoredDefinitions,
  seedAuthoredDefinitions,
} from '../fixtures/rogue-trader-definitions';
import { test } from './fixtures/desktop-shell';

test('opens saved character and monster sheets and explains read-only and invalid files', async ({
  shell,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'packaged', 'Requires main-process dialog automation');
  const { page, application, profile } = shell;
  if (!application) throw new Error('Expected a packaged Electron application.');

  // Seed both roles and an invalid file in an isolated library.
  const library = path.join(profile.root, 'game-library');
  const authored = readAuthoredDefinitions();
  const { system, manifest } = await seedAuthoredDefinitions(library, authored);
  await writeFile(
    path.join(library, system, 'system.json'),
    await readFile(new URL('system.json', authored.root)),
  );
  const files = await Promise.all(
    [
      ['explorator', 'characters'],
      ['ork-freebooter', 'monsters'],
    ].map(async ([name, directory]) => {
      const bytes = await readFile(new URL(name + '.instance.json', authored.root));
      const sheet = JSON.parse(bytes.toString('utf8')) as Instance;
      const folder = path.join(library, system, directory);
      await mkdir(folder);
      const file = path.join(folder, sheet.id + '.json');
      await writeFile(file, bytes);
      return { sheet, file, bytes };
    }),
  );
  const [character, monster] = files;
  const invalid = path.join(library, system, 'characters', 'invalid.json');
  await writeFile(invalid, '{');

  // Replace the native folder dialog and load the system through the real UI.
  await application.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
  }, library);
  const picker = page.getByRole('button', { name: 'Choose library folder' });
  const systemPicker = page.getByRole('combobox', { name: 'Game system' });
  const load = page.getByRole('button', { name: 'Load system' });
  await picker.press('Enter');
  await systemPicker.press('End');
  await load.press('Enter');

  const panel = page.getByRole('region', { name: 'Load a saved sheet' });
  const role = panel.getByRole('combobox', { name: 'Role' });
  const sheets = panel.getByRole('combobox', { name: 'Saved sheet' });
  const open = panel.getByRole('button', { name: 'Load sheet', exact: true });
  // Names make the picker readable, while IDs disambiguate sheets with the same name.
  await expect(
    sheets.getByRole('option', {
      name: `${character.sheet.displayName} (${character.sheet.id})`,
      exact: true,
    }),
  ).toBeAttached();
  await expect(sheets.getByRole('option', { name: 'invalid', exact: true })).toBeAttached();
  await role.focus();
  await page.keyboard.press('Tab');
  await expect(sheets).toBeFocused();
  await sheets.press('End');
  await expect(sheets).toHaveValue('invalid');

  // Observe the pending DOM before the real IPC round trip settles.
  const observeBusyControls = (message: string) =>
    page.evaluate(
      (message) =>
        new Promise<boolean>((resolve) => {
          const panel = document.querySelector('section[aria-labelledby="sheet-loading-heading"]');
          const status = panel?.querySelector('[role="status"]');
          if (!status || !panel) throw new Error('Opening status missing');
          const observer = new MutationObserver(() => {
            if (!status.textContent?.startsWith(message)) return;
            observer.disconnect();
            const system = document.querySelector<HTMLSelectElement>('#library-system');
            const libraryButtons = Array.from(
              system?.closest('section')?.querySelectorAll('button') ?? [],
            );
            resolve(
              system?.disabled === true &&
                libraryButtons.length === 2 &&
                libraryButtons.every((button) => button.getAttribute('aria-disabled') === 'true') &&
                panel.querySelector('fieldset')?.disabled === true &&
                document.querySelector('#sheet-creation-heading ~ form fieldset:disabled') !== null,
            );
          });
          observer.observe(status, { childList: true, characterData: true, subtree: true });
        }),
      message,
    );
  // A rejected open restores the controls and returns focus to the picker.
  const pendingState = observeBusyControls('Opening sheet');
  await open.press('Enter');
  await expect(panel.getByRole('alert')).toContainText('invalid.json');
  expect(await pendingState).toBe(true);
  await expect(picker).toBeEnabled();
  await expect(systemPicker).toBeEnabled();
  await expect(load).toBeEnabled();
  await expect(sheets).toBeFocused();

  const view = panel
    .getByRole('group', { name: 'Saved sheet' })
    .getByRole('button', { name: 'View sheet' });
  const back = page.getByRole('button', { name: 'Back to main page' });

  // View the recorded values and return focus to the main page for each successful open.
  async function viewRecordedSheet(sheet: Instance, readOnly: boolean, capture = false) {
    await expect(view).toBeFocused();
    await expect(panel.getByRole('status')).toContainText(
      readOnly ? 'in read-only mode' : `Opened ${sheet.displayName}.`,
    );
    await view.press('Enter');
    await expect(panel).toBeHidden();
    const article = page.getByRole('article', { name: sheet.displayName });
    await expect(article.getByRole('heading', { name: sheet.displayName })).toBeFocused();
    await expect(article.getByText('Strength', { exact: true }).locator('..')).toHaveText(
      'Strength' + sheet.values.strength,
    );
    await expect(
      article.getByTitle('Toughness Bonus', { exact: true }).locator('xpath=../..'),
    ).toHaveText('TB' + sheet.derived.toughnessBonus);
    await expect(article.getByRole('heading', { name: 'Movement' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Read-only sheet' })).toHaveCount(
      readOnly ? 1 : 0,
    );

    if (capture) {
      await page.screenshot({ path: testInfo.outputPath('sheet-regular.png'), fullPage: true });
      const viewport = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
      }));
      await page.setViewportSize({ width: 360, height: 720 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('sheet-narrow.png'), fullPage: true });
      await page.setViewportSize(viewport);
      await article.getByRole('heading', { name: sheet.displayName }).focus();
    }

    await page.keyboard.press('Shift+Tab');
    await expect(back).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(view).toBeFocused();
    await expect(sheets).toHaveValue(sheet.id);
  }

  // Recover by keyboard, then open both roles while their definitions are available.
  await sheets.press('ArrowUp');
  await expect(sheets).toHaveValue(character.sheet.id);
  await open.press('Enter');
  await viewRecordedSheet(character.sheet, false);
  await expect(panel.getByRole('alert')).toBeEmpty();

  const listingState = observeBusyControls('Finding saved sheets');
  await role.press('End');
  await expect(
    sheets.getByRole('option', {
      name: `${monster.sheet.displayName} (${monster.sheet.id})`,
      exact: true,
    }),
  ).toBeAttached();
  expect(await listingState).toBe(true);
  await expect(role).toBeFocused();
  await expect(systemPicker).toBeEnabled();
  await sheets.press('End');
  await open.press('Enter');
  await viewRecordedSheet(monster.sheet, false);

  // Remove the archived definition and verify the same display for both roles.
  await unlink(path.join(library, manifest));
  await open.press('Enter');
  await viewRecordedSheet(monster.sheet, true, true);
  await role.press('Home');
  await sheets.selectOption(character.sheet.id);
  await open.press('Enter');
  await viewRecordedSheet(character.sheet, true);
  // Opening either role must preserve its original file bytes.
  for (const { file, bytes } of files) expect(await readFile(file)).toEqual(bytes);
  expect(await readFile(invalid, 'utf8')).toBe('{');

  // Match persisted rejection, success, and degradation to their open requests.
  const logFile = path.join(profile.userData, 'logs', 'application.jsonl');
  await expect
    .poll(async () => {
      const log = await readFile(logFile, 'utf8');
      const rows = log
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
        .filter((record) => record.event === 'instance.load');
      const outcomes = rows.filter(
        (row) =>
          row.step === 'sheet.read' ||
          row.step === 'definitions.resolve' ||
          (row.step === 'sheet.open' && row.outcome === 'succeeded'),
      );
      return outcomes.map(({ operationId, step, outcome, reason }) => ({
        step,
        outcome,
        reason,
        correlated: rows.some(
          (row) =>
            row.operationId === operationId &&
            row.step === 'sheet.open' &&
            row.outcome === 'started',
        ),
      }));
    })
    .toEqual([
      { step: 'sheet.read', outcome: 'rejected', reason: 'INVALID_JSON', correlated: true },
      { step: 'sheet.open', outcome: 'succeeded', reason: undefined, correlated: true },
      { step: 'sheet.open', outcome: 'succeeded', reason: undefined, correlated: true },
      ...Array.from({ length: 2 }, () => ({
        step: 'definitions.resolve',
        outcome: 'degraded',
        reason: 'DEFINITION_NOT_FOUND',
        correlated: true,
      })),
    ]);

  // Navigation records contain a distinct correlation ID per visit and no sheet data.
  await expect
    .poll(async () => {
      const log = await readFile(logFile, 'utf8');
      const rows = log
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
        .filter((row) => row.event === 'sheet.view');
      const operations = new Map<string, string[]>();
      for (const row of rows) {
        const steps = operations.get(row.operationId) ?? [];
        steps.push(row.step + ':' + row.outcome);
        operations.set(row.operationId, steps);
        const record = JSON.stringify(row);
        for (const { sheet } of files) {
          expect(record).not.toContain(sheet.displayName);
          expect(record).not.toContain(sheet.id);
        }
      }
      return [...operations.values()];
    })
    .toEqual(Array.from({ length: 4 }, () => ['view.enter:succeeded', 'view.return:succeeded']));
});

test('preserves the selected sheet and view action when the library picker is cancelled or rejected', async ({
  shell,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'packaged', 'Requires main-process dialog automation');
  const { page, application, profile } = shell;
  if (!application) throw new Error('Expected a packaged Electron application.');

  const library = path.join(profile.root, 'game-library');
  const authored = readAuthoredDefinitions();
  const { system, manifest } = await seedAuthoredDefinitions(library, authored);
  await writeFile(
    path.join(library, system, 'system.json'),
    await readFile(path.join(library, manifest)),
  );
  const bytes = await readFile(new URL('explorator.instance.json', authored.root));
  const sheet = JSON.parse(bytes.toString('utf8')) as Instance;
  const characters = path.join(library, system, 'characters');
  await mkdir(characters);
  await writeFile(path.join(characters, sheet.id + '.json'), bytes);

  // Only the first folder contains a valid library. The second reply cancels the picker.
  await application.evaluate(
    ({ dialog }, { library, invalidFolder }) => {
      let attempt = 0;
      dialog.showOpenDialog = async () => {
        switch (attempt++) {
          case 0:
            return { canceled: false, filePaths: [library] };
          case 1:
            return { canceled: true, filePaths: [] };
          default:
            return { canceled: false, filePaths: [invalidFolder] };
        }
      };
    },
    { library, invalidFolder: profile.root },
  );

  const libraryPanel = page.getByRole('region', { name: 'Game library' });
  const picker = libraryPanel.getByRole('button', { name: 'Choose library folder' });
  const load = libraryPanel.getByRole('button', { name: 'Load system' });
  await picker.click();
  await libraryPanel
    .getByRole('combobox', { name: 'Game system' })
    .selectOption(authored.system.id);
  await load.click();

  const loading = page.getByRole('region', { name: 'Load a saved sheet' });
  const sheets = loading.getByRole('combobox', { name: 'Saved sheet' });
  const view = loading.getByRole('button', { name: 'View sheet' });
  await sheets.selectOption(sheet.id);
  await loading.getByRole('button', { name: 'Load sheet', exact: true }).click();
  await expect(view).toBeVisible();

  await picker.click();
  await expect(libraryPanel.getByRole('status')).toHaveText('Folder selection cancelled.');
  await expect(sheets).toHaveValue(sheet.id);
  await expect(view).toBeVisible();

  await picker.click();
  await expect(libraryPanel.getByRole('alert')).toContainText('RPG_systems');
  await expect(sheets).toHaveValue(sheet.id);
  await expect(view).toBeVisible();

  // Reloading the system advances its revision and clears the previous open.
  await load.click();
  await expect(libraryPanel.getByRole('status')).toHaveText(/Loaded Rogue Trader/);
  await expect(sheets).toHaveValue('');
  await expect(view).toHaveCount(0);
});

test('returns focus to Choose library folder after cancellation following a failed sheet open', async ({
  shell,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'packaged', 'Requires main-process dialog automation');
  const { page, application, profile } = shell;
  if (!application) throw new Error('Expected a packaged Electron application.');

  const library = path.join(profile.root, 'game-library');
  const authored = readAuthoredDefinitions();
  const { system, manifest } = await seedAuthoredDefinitions(library, authored);
  await writeFile(
    path.join(library, system, 'system.json'),
    await readFile(path.join(library, manifest)),
  );
  const characters = path.join(library, system, 'characters');
  await mkdir(characters);
  await writeFile(path.join(characters, 'invalid.json'), '{');

  // Keep the real IPC and filesystem operations while simulating a cancelled second dialog.
  await application.evaluate(({ dialog }, folder) => {
    let first = true;
    dialog.showOpenDialog = async () => {
      const cancelled = !first;
      first = false;
      return { canceled: cancelled, filePaths: cancelled ? [] : [folder] };
    };
  }, library);

  const libraryPanel = page.getByRole('region', { name: 'Game library' });
  const picker = libraryPanel.getByRole('button', { name: 'Choose library folder' });
  await picker.press('Enter');
  await libraryPanel
    .getByRole('combobox', { name: 'Game system' })
    .selectOption(authored.system.id);
  await libraryPanel.getByRole('button', { name: 'Load system' }).press('Enter');

  const loading = page.getByRole('region', { name: 'Load a saved sheet' });
  const sheets = loading.getByRole('combobox', { name: 'Saved sheet' });
  await sheets.selectOption('invalid');
  await loading.getByRole('button', { name: 'Load sheet', exact: true }).press('Enter');
  await expect(loading.getByRole('alert')).toContainText('invalid.json');
  await expect(sheets).toBeFocused();

  await picker.press('Enter');
  await expect(libraryPanel.getByRole('status')).toHaveText('Folder selection cancelled.');
  await expect(loading.getByRole('alert')).toContainText('invalid.json');
  await expect(picker).toBeFocused();
});

import { expect, _electron as electron } from '@playwright/test';
import { cp, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Instance } from '../../src/domain/definitions/document-models';
import {
  gameLibrary,
  loadLibrarySystem,
  openLibrarySystem,
  savedSheetNavigation,
} from './fixtures/navigation';
import { test } from './fixtures/test-profile';

test('reopens both Rogue Trader roles with recorded results after a full restart', async ({
  profiles,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'packaged', 'Requires two packaged Electron launches');
  const profile = profiles.create();
  const library = path.join(profile.root, 'milestone-library');
  await cp(path.resolve('runtime-library'), library, { recursive: true });
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

  const sheets = [
    { role: 'character', label: 'Character', directory: 'characters', strength: 45, bonus: 8 },
    { role: 'monster', label: 'Monster', directory: 'monsters', strength: 55, bonus: 10 },
  ] as const;
  const saved = new Map<string, string>();

  await test.step('Create, calculate, and save both roles through the desktop', async () => {
    const application = await electron.launch({ executablePath, args: profile.args, env });
    const child = application.process();
    profile.track(child);
    try {
      const page = await application.firstWindow();
      await profile.verifyStartup(application);
      await openLibrarySystem(page, application, library, 'rogue-trader');
      const creation = page.getByRole('region', { name: 'Create a sheet' });
      for (const { role, label, directory, strength, bonus } of sheets) {
        const name = 'Milestone ' + label;
        const id = 'milestone-' + role;
        await creation.getByRole('combobox', { name: 'Role' }).selectOption(role);
        const displayName = creation.getByRole('textbox', { name: 'Display name' });
        await displayName.fill(name);
        await expect(creation.getByRole('textbox', { name: 'Sheet ID' })).toHaveValue(id);
        await displayName.press('Enter');
        const view = creation.getByRole('button', { name: 'View sheet' });
        await expect(view).toBeFocused();
        await view.press('Enter');
        await expect(page.getByRole('heading', { name, exact: true })).toBeFocused();

        await page.getByRole('textbox', { name: 'Strength', exact: true }).fill(String(strength));
        const entry = page.getByRole('combobox', { name: 'Rulebook entry' });
        await entry.fill('strength');
        await entry.press('Enter');
        await page.getByRole('button', { name: 'Stage entry' }).press('Enter');
        await page.getByRole('button', { name: 'Apply edits' }).press('Enter');
        const strengthBonus = page
          .getByTitle('Strength Bonus', { exact: true })
          .locator('xpath=../../dd');
        await expect(strengthBonus).toHaveText(String(bonus));

        await page.getByRole('button', { name: 'Save', exact: true }).press('Enter');
        await expect(page.getByRole('status').filter({ hasText: 'Sheet saved.' })).toBeVisible();
        const file = path.join(library, 'RPG_systems', 'rogue-trader', directory, id + '.json');
        const bytes = await readFile(file, 'utf8');
        expect(JSON.parse(bytes)).toMatchObject({
          id,
          displayName: name,
          role,
          values: { strength },
          derived: { strengthBonus: bonus },
          entries: [
            {
              label: 'Unnatural Strength (x2)',
              effects: [{ op: 'multiply', target: 'strengthBonus', factor: 2 }],
            },
          ],
        });
        saved.set(file, bytes);
        await page.getByRole('button', { name: 'Done', exact: true }).press('Enter');
        await page.getByRole('button', { name: 'Back to main page' }).press('Enter');
      }
    } finally {
      await application.close();
    }
    expect(child.exitCode).toBe(0);
  });

  // A valid recorded value distinct from the formula result detects recalculation on open.
  const monsterFile = path.join(
    library,
    'RPG_systems',
    'rogue-trader',
    'monsters',
    'milestone-monster.json',
  );
  const monster = JSON.parse(await readFile(monsterFile, 'utf8')) as Instance;
  monster.derived.strengthBonus = 11;
  const recorded = JSON.stringify(monster);
  await writeFile(monsterFile, recorded);
  saved.set(monsterFile, recorded);

  await test.step('Relaunch and open both snapshots without rewriting them', async () => {
    const application = await electron.launch({ executablePath, args: profile.args, env });
    profile.track(application.process());
    try {
      const page = await application.firstWindow();
      const { region: libraryRegion } = gameLibrary(page);
      await expect(
        libraryRegion.getByText(`Library folder: ${await realpath(library)}`, { exact: true }),
      ).toBeVisible();
      await loadLibrarySystem(page, 'rogue-trader');
      const picker = savedSheetNavigation(page);
      for (const { role, label, strength, bonus } of sheets) {
        const name = 'Milestone ' + label;
        const id = 'milestone-' + role;
        if ((await picker.role.inputValue()) !== role) await picker.role.selectOption(role);
        await picker.sheets.selectOption(id);
        await picker.loadSheet.press('Enter');
        await expect(picker.region.getByRole('status')).toHaveText('Opened ' + name + '.');
        await expect(picker.viewSheet).toBeFocused();
        await picker.viewSheet.press('Enter');
        await expect(page.getByRole('heading', { name, exact: true })).toBeFocused();
        await expect(page.getByText(id, { exact: true })).toBeVisible();
        await expect(page.getByRole('article').getByText(label, { exact: true })).toBeVisible();
        await expect(page.getByText('Strength', { exact: true }).locator('..')).toHaveText(
          'Strength' + strength,
        );
        const strengthBonus = page
          .getByTitle('Strength Bonus', { exact: true })
          .locator('xpath=../../dd');
        await expect(strengthBonus).toHaveText(String(role === 'monster' ? 11 : bonus));
        await expect(page.getByRole('heading', { name: 'Unnatural Strength (x2)' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeEnabled();
        await page.getByRole('button', { name: 'Back to main page' }).press('Enter');
      }
      for (const [file, bytes] of saved) {
        expect(await readFile(file, 'utf8')).toBe(bytes);
      }
    } finally {
      await application.close();
    }
  });
});

import { expect } from '@playwright/test';
import { cp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Instance } from '../../src/domain/definitions/document-models';
import { archivedSystemManifestPath } from '../../src/main/library-paths';
import { test } from './fixtures/desktop-shell';
import { openLibrarySystem, savedSheetNavigation } from './fixtures/navigation';

test('saves, retries, and reopens both roles through their library destinations', async ({
  shell,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'packaged', 'Requires main-process dialog automation');
  const { page, application, profile } = shell;
  if (!application) throw new Error('Expected a packaged Electron application.');

  const library = path.join(profile.root, 'game-library');
  await cp(path.resolve('runtime-library'), library, { recursive: true });
  await openLibrarySystem(page, application, library, 'rogue-trader');

  const creation = page.getByRole('region', { name: 'Create a sheet' });
  const {
    region: loading,
    role: savedRole,
    sheets: savedPicker,
    loadSheet,
    viewSheet: viewSaved,
  } = savedSheetNavigation(page);
  const location = page.getByRole('combobox', { name: 'Save location' });
  const save = page.getByRole('button', { name: 'Save', exact: true });
  const back = page.getByRole('button', { name: 'Back to main page' });
  const feedback = page.locator('.sheet-page__edit-feedback');
  const alert = feedback.getByRole('alert');
  const status = feedback.getByRole('status');
  let persisted: Instance | undefined;

  for (const [role, directory, label] of [
    ['character', 'characters', 'Characters'],
    ['monster', 'monsters', 'Monsters'],
  ] as const) {
    const displayName = 'Saved ' + role;
    const id = 'saved-' + role;
    const file = path.join(library, 'RPG_systems', 'rogue-trader', directory, id + '.json');
    await savedRole.selectOption(role);
    await creation.getByRole('combobox', { name: 'Role' }).selectOption(role);
    const name = creation.getByRole('textbox', { name: 'Display name' });
    await name.fill(displayName);
    await expect(creation.getByRole('textbox', { name: 'Sheet ID' })).toHaveValue(id);
    await name.press('Enter');
    await expect(creation.getByRole('status')).toHaveText('Created ' + displayName + '.');
    const viewCreated = creation.getByRole('button', { name: 'View sheet' });
    await expect(viewCreated).toBeFocused();
    await viewCreated.press('Enter');

    await expect(location.getByRole('option')).toHaveText(new RegExp('Rogue Trader.*' + label));
    await expect(location).toHaveValue(directory);
    await expect(
      page
        .getByRole('group', { name: 'Sheet editing actions' })
        .getByRole('button', { name: 'Save', exact: true }),
    ).toBeVisible();
    await location.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(save).toBeFocused();
    await expect(save).toBeEnabled();
    await page.keyboard.press('Enter');
    await expect(status).toHaveText('Sheet saved.');
    await expect(save).toBeDisabled();
    const first = await readFile(file, 'utf8');
    expect(JSON.parse(first)).toMatchObject({ id, displayName, role, values: { strength: 0 } });

    const strength = page.getByRole('textbox', { name: 'Strength', exact: true });
    await strength.fill('-1');
    const picker = page.getByRole('combobox', { name: 'Rulebook entry' });
    await picker.fill('strength');
    await picker.press('Enter');
    await page.getByRole('button', { name: 'Stage entry' }).press('Enter');
    await expect(save).toBeEnabled();
    await save.press('Enter');
    await expect(alert).toContainText('Strength');
    await expect(strength).toBeFocused();
    await expect(page.getByRole('list', { name: 'Pending rulebook entries' })).toContainText(
      'Unnatural Strength (x2)',
    );
    expect(await readFile(file, 'utf8')).toBe(first);

    await writeFile(file + '.lock', '');
    await strength.fill('45');
    await expect(save).toBeEnabled();
    await save.press('Enter');
    await expect(alert).toContainText('previous save needs recovery');
    await expect(strength).toHaveValue('45');
    await expect(page.getByRole('heading', { name: 'Unnatural Strength (x2)' })).toBeVisible();
    expect(await readFile(file, 'utf8')).toBe(first);

    await rm(file + '.lock');
    await save.press('Enter');
    await expect(status).toHaveText('Sheet saved.');
    await expect(alert).toBeEmpty();
    await expect(save).toBeFocused();
    await expect(save).toBeDisabled();
    persisted = JSON.parse(await readFile(file, 'utf8')) as Instance;
    expect(persisted).toMatchObject({
      role,
      id,
      displayName,
      values: { strength: 45 },
      derived: { strengthBonus: 8 },
      entries: [
        {
          label: 'Unnatural Strength (x2)',
          effects: [{ op: 'multiply', target: 'strengthBonus', factor: 2 }],
        },
      ],
    });
    expect(await readFile(file + '.bak', 'utf8')).toBe(first);

    const savedBytes = await readFile(file, 'utf8');
    const done = page.getByRole('button', { name: 'Done', exact: true });
    const edit = page.getByRole('button', { name: 'Edit', exact: true });
    const apply = page.getByRole('button', { name: 'Apply edits' });
    const confirmation = page.getByRole('dialog', { name: 'Save changes?' });

    await strength.fill('  0045  ');
    await expect(strength).toHaveValue('45');
    await expect(apply).toBeDisabled();
    await expect(save).toBeDisabled();
    await done.press('Enter');
    await expect(confirmation).toBeHidden();
    await expect(edit).toBeFocused();

    await edit.press('Enter');
    await strength.fill('  0044  ');
    await expect(strength).toHaveValue('44');
    await apply.press('Enter');
    await expect(status).toHaveText('Changes applied.');
    await expect(save).toBeEnabled();
    await strength.fill('45');
    await expect(save).toBeDisabled();
    await expect(apply).toBeEnabled();
    await apply.press('Enter');
    await expect(apply).toBeDisabled();
    await expect(save).toBeDisabled();
    await done.press('Enter');
    await expect(confirmation).toBeHidden();
    await expect(edit).toBeFocused();

    await edit.press('Enter');
    await strength.fill('44');
    await apply.press('Enter');
    await expect(status).toHaveText('Changes applied.');
    await strength.fill('45');
    await expect(save).toBeDisabled();
    await done.press('Enter');
    await expect(confirmation).toBeHidden();
    await expect(edit).toBeFocused();
    expect(await readFile(file, 'utf8')).toBe(savedBytes);
    expect(await readFile(file + '.bak', 'utf8')).toBe(first);
    await expect(location).toHaveCount(0);
    await expect(save).toHaveCount(0);
    await back.press('Enter');
    await expect(
      savedPicker.getByRole('option', { name: displayName + ' (' + id + ')' }),
    ).toBeAttached();
    await savedPicker.selectOption(id);
    await loadSheet.press('Enter');
    await expect(loading.getByRole('status')).toHaveText('Opened ' + displayName + '.');
    await expect(viewSaved).toBeFocused();
    await viewSaved.press('Enter');
    await expect(page.getByRole('heading', { name: displayName, exact: true })).toBeFocused();
    await expect(page.getByText(id, { exact: true })).toBeVisible();
    await expect(page.getByText('Strength', { exact: true }).locator('..')).toHaveText(
      'Strength45',
    );
    await expect(
      page.getByTitle('Strength Bonus', { exact: true }).locator('xpath=../../dd'),
    ).toHaveText('8');
    await expect(page.getByRole('heading', { name: 'Unnatural Strength (x2)' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit', exact: true }).press('Enter');
    await expect(location).toHaveValue(directory);
    await expect(save).toBeDisabled();
    await page.getByRole('button', { name: 'Done', exact: true }).press('Enter');
    await back.press('Enter');
  }

  if (!persisted) throw new Error('Expected a saved sheet.');
  // A recorded result can differ from recalculation even though the source values match.
  const monsterFile = path.join(
    library,
    'RPG_systems',
    'rogue-trader',
    'monsters',
    persisted.id + '.json',
  );
  persisted.derived.strengthBonus = 9;
  const recorded = JSON.stringify(persisted);
  await writeFile(monsterFile, recorded);
  await loadSheet.press('Enter');
  await expect(viewSaved).toBeFocused();
  await viewSaved.press('Enter');
  const bonus = page.getByTitle('Strength Bonus', { exact: true }).locator('xpath=../../dd');
  await expect(bonus).toHaveText('9');
  await page.getByRole('button', { name: 'Edit', exact: true }).press('Enter');
  const strength = page.getByRole('textbox', { name: 'Strength', exact: true });
  await strength.fill('55');
  await page.getByRole('button', { name: 'Apply edits' }).press('Enter');
  await expect(bonus).toHaveText('10');
  await strength.fill('45');
  await expect(save).toBeEnabled();
  await page.getByRole('button', { name: 'Done', exact: true }).press('Enter');
  const confirmation = page.getByRole('dialog', { name: 'Save changes?' });
  await expect(confirmation).toBeVisible();
  await expect(bonus).toHaveText('10');
  expect(await readFile(monsterFile, 'utf8')).toBe(recorded);
  await confirmation.getByRole('button', { name: 'Save and finish' }).press('Enter');
  await expect(bonus).toHaveText('8');
  await expect(back).toBeVisible();
  const recalculated = JSON.parse(await readFile(monsterFile, 'utf8')) as Instance;
  expect(recalculated.values.strength).toBe(45);
  expect(recalculated.derived.strengthBonus).toBe(8);
  expect(await readFile(monsterFile + '.bak', 'utf8')).toBe(recorded);
  await back.press('Enter');
  await savedPicker.selectOption(persisted.id);

  const archive = path.join(library, archivedSystemManifestPath(persisted.system));
  await rename(archive, archive + '.away');
  await loadSheet.press('Enter');
  await expect(loading.getByRole('status')).toContainText('in read-only mode');
  await expect(viewSaved).toBeFocused();
  await viewSaved.press('Enter');
  await expect(page.getByRole('complementary', { name: 'Read-only sheet' })).toBeVisible();
  await expect(
    page.getByTitle('Strength Bonus', { exact: true }).locator('xpath=../../dd'),
  ).toHaveText('8');
  await expect(save).toHaveCount(0);
  await expect(location).toHaveCount(0);
});

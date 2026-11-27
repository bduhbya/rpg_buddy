import { readRuntimeDefinitions } from '../fixtures/rogue-trader-definitions';
import { expect } from '@playwright/test';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from './fixtures/desktop-shell';
import { gameLibrary, openLibrarySystem } from './fixtures/navigation';

test('creates both roles by keyboard and keeps selection steady during submission', async ({
  shell,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'packaged', 'Requires main-process dialog automation');
  const { page, application, profile } = shell;
  if (!application) throw new Error('Expected a packaged Electron application.');

  const library = path.join(profile.root, 'game-library');
  await cp(path.resolve('runtime-library'), library, { recursive: true });
  const characters = path.join(library, 'RPG_systems', 'rogue-trader', 'characters');
  await mkdir(characters, { recursive: true });
  await writeFile(path.join(characters, 'elodie.json'), '{}');

  await openLibrarySystem(page, application, library, 'rogue-trader');
  const { chooseFolder: picker, system, loadSystem: load } = gameLibrary(page);

  const panel = page.getByRole('region', { name: 'Create a sheet' });
  const template = panel.getByRole('combobox', { name: 'Template' });
  const role = panel.getByRole('combobox', { name: 'Role' });
  const name = panel.getByRole('textbox', { name: 'Display name' });
  const id = panel.getByRole('textbox', { name: 'Sheet ID' });
  await expect(template).toBeVisible();
  const { template: templateReference } = readRuntimeDefinitions();
  await expect(template.getByRole('option')).toHaveText(
    `Creature - core statistics (${templateReference.id}, ${templateReference.version})`,
  );
  await template.focus();
  await page.keyboard.press('Tab');
  await expect(role).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(name).toBeFocused();
  await name.fill('Élodie');
  await expect(id).toHaveValue('elodie');

  // Observe an in-flight render without requiring the disk read to take a fixed amount of time.
  const pendingState = page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const status = document.querySelector(
          'section[aria-labelledby="sheet-creation-heading"] [role="status"]',
        );
        if (!status) throw new Error('Creation status missing');
        const observer = new MutationObserver(() => {
          if (!status.textContent?.startsWith('Creating')) return;
          observer.disconnect();
          const select = document.querySelector<HTMLSelectElement>('#library-system');
          const buttons = Array.from(select?.closest('section')?.querySelectorAll('button') ?? []);
          resolve(
            select?.disabled === true &&
              buttons.length === 2 &&
              buttons.every((button) => button.getAttribute('aria-disabled') === 'true'),
          );
        });
        observer.observe(status, { childList: true, characterData: true, subtree: true });
      }),
  );
  await name.press('Enter');
  await expect(panel.getByRole('alert')).toHaveText(/ID is already in use/);
  expect(await pendingState).toBe(true);
  await expect(picker).toBeEnabled();
  await expect(system).toBeEnabled();
  await expect(load).toBeEnabled();
  await expect(id).toBeFocused();

  await page.keyboard.press('Control+a');
  await page.keyboard.type('captain-elodie');
  await page.keyboard.press('Enter');
  const view = panel
    .getByRole('group', { name: 'Sheet details' })
    .getByRole('button', { name: 'View sheet' });
  const back = page.getByRole('button', { name: 'Back to main page' });
  const character = page.getByRole('article', { name: 'Élodie' });
  await expect(character).toHaveCount(0);
  await expect(view).toBeFocused();
  await view.press('Enter');
  await expect(panel).toBeHidden();
  await expect(character.getByRole('heading', { name: 'Élodie' })).toBeFocused();
  const done = page.getByRole('button', { name: 'Done', exact: true });
  await expect(done).toBeVisible();
  await done.press('Enter');
  await expect(character.getByText('captain-elodie')).toBeVisible();
  await expect(character.getByText('Character', { exact: true })).toBeVisible();
  await expect(character.getByText('Strength', { exact: true }).locator('..')).toHaveText(
    'Strength0',
  );
  await expect(
    character.getByTitle('Strength Bonus', { exact: true }).locator('xpath=../..'),
  ).toHaveText('SB0');

  const save = page.getByRole('button', { name: 'Save', exact: true });
  const saveLocation = page.getByRole('combobox', { name: 'Save location' });
  await expect(saveLocation).toHaveCount(0);
  await expect(save).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(back).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(view).toBeFocused();
  await expect(name).toHaveValue('Élodie');
  await expect(panel.getByRole('status')).toHaveText('Created Élodie.');
  await name.fill('Another captain');
  await expect(view).toBeDisabled();
  await expect(panel.getByRole('status')).toBeEmpty();
  await name.fill('Élodie');
  await expect(view).toBeDisabled();
  await name.fill('Another captain');
  await id.press('Enter');
  await expect(panel.getByRole('alert')).toHaveText(/ID is already in use/);
  await expect(panel.getByRole('status')).toBeEmpty();
  await expect(view).toBeDisabled();

  await role.press('End');
  await name.fill('Void Beast');
  await expect(id).toHaveValue('captain-elodie');
  await id.fill('void-beast');
  await id.press('Enter');
  await expect(panel.getByRole('status')).toHaveText('Created Void Beast.');
  await expect(view).toBeFocused();
  await view.press('Enter');
  const monster = page.getByRole('article', { name: 'Void Beast' });
  await expect(monster.getByText('void-beast')).toBeVisible();
  await expect(monster.getByText('Monster', { exact: true })).toBeVisible();
  await expect(monster.getByRole('heading', { name: 'Movement' })).toBeVisible();
  await done.press('Enter');
  await back.press('Enter');
  await expect(view).toBeFocused();
  await expect(role).toHaveValue('monster');
  await expect(id).toHaveValue('void-beast');

  // Verify that Apply and Done submit shared drafts from the sheet's edit bar.
  await view.press('Enter');
  const edit = page.getByRole('button', { name: 'Edit', exact: true });
  const actions = page.getByRole('group', { name: 'Sheet editing actions' });
  const apply = actions.getByRole('button', { name: 'Apply edits' });
  const discard = actions.getByRole('button', { name: 'Discard edits' });
  const movement = monster.getByText('Half Move', { exact: true }).locator('..');
  const labels = await monster.locator('dt').allTextContents();
  await edit.press('Enter');
  await expect(done).toBeFocused();
  await expect(monster.locator('dt')).toHaveText(labels);
  const agility = monster.getByRole('textbox', { name: 'Agility', exact: true });
  const strength = monster.getByRole('textbox', { name: 'Strength', exact: true });
  await agility.fill('42');
  await monster.getByRole('textbox', { name: 'Career path' }).fill('Voidfarer');
  await expect(movement).toHaveText(/Half Move0/);
  await expect(monster.getByRole('button', { name: /^Apply/ })).toHaveCount(0);
  await apply.press('Enter');
  await expect(movement).toHaveText(/Half Move4/);
  await expect(apply).toBeFocused();
  await expect(apply).toHaveAttribute('aria-disabled', 'true');

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  await page.setViewportSize({ width: 360, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await monster.getByRole('group', { name: 'Add rulebook entries' }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  for (const button of [done, apply, discard, saveLocation, save]) {
    await expect(button).toBeInViewport({ ratio: 1 });
  }
  await page.setViewportSize(viewport);

  const toughness = monster.getByRole('textbox', { name: 'Toughness', exact: true });
  await toughness.fill('26');
  await strength.fill('-1');
  await agility.fill('55');
  const addEntry = monster.getByRole('group', { name: 'Add rulebook entries' });
  const category = addEntry.getByRole('combobox', { name: 'Category' });
  const choices = addEntry.getByRole('combobox', { name: 'Rulebook entry' });
  const options = addEntry.getByRole('listbox', { name: 'Rulebook matches' }).getByRole('option');
  const stage = addEntry.getByRole('button', { name: 'Stage entry' });
  await expect(category.getByRole('option')).toHaveText(['Traits', 'Talents']);
  await category.selectOption('talent');
  await choices.press('ArrowDown');
  await expect(addEntry.getByRole('status')).toHaveText('No matching entries');
  await choices.press('Escape');
  await expect(choices).toHaveAttribute('aria-expanded', 'false');
  await category.selectOption('trait');
  await choices.press('ArrowDown');
  await expect(options).toHaveText([
    'Unnatural Strength (x2) Doubles Strength Bonus',
    'Unnatural Toughness (x2) Doubles Toughness Bonus',
  ]);
  await choices.press('ArrowDown');
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  await choices.press('ArrowUp');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await choices.fill('  tOuGhNeSs ');
  await expect(options).toHaveText(['Unnatural Toughness (x2) Doubles Toughness Bonus']);
  await choices.fill('strength');
  await expect(options).toHaveText(['Unnatural Strength (x2) Doubles Strength Bonus']);
  await choices.press('Enter');
  await expect(choices).toHaveValue('Unnatural Strength (x2)');
  await expect(addEntry.getByRole('list', { name: 'Pending rulebook entries' })).toHaveCount(0);
  await stage.press('Enter');
  const pendingTrait = addEntry.getByRole('list', { name: 'Pending rulebook entries' });
  await expect(pendingTrait).toContainText(
    'Strength 45 gives a base bonus of 4 and a modified bonus of 8',
  );
  await expect(pendingTrait).toContainText('printed p. 368');
  await expect(choices).toBeFocused();
  const unsaved = page.getByRole('dialog', { name: 'Save changes?' });
  const saveAndFinish = unsaved.getByRole('button', { name: 'Save and finish' });
  await done.press('Enter');
  await expect(unsaved.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(unsaved).toBeHidden();
  await expect(done).toBeFocused();
  await done.press('Enter');
  await expect(saveAndFinish).toBeEnabled();
  await saveAndFinish.press('Enter');
  await expect(page.locator('#sheet-edit-error')).toContainText('Strength');
  await expect(strength).toBeFocused();
  await expect(
    monster.getByTitle('Toughness Bonus', { exact: true }).locator('xpath=../../dd'),
  ).toHaveText('2');
  await expect(toughness).toHaveValue('26');
  await expect(agility).toHaveValue('55');
  await expect(addEntry.getByRole('list', { name: 'Pending rulebook entries' })).toContainText(
    'Unnatural Strength (x2)',
  );
  await expect(movement).toHaveText(/Half Move4/);
  await strength.fill('45');
  await done.press('Enter');
  await saveAndFinish.press('Enter');
  await expect(edit).toBeFocused();
  await expect(movement).toHaveText(/Half Move5/);
  await expect(
    monster.getByTitle('Strength Bonus', { exact: true }).locator('xpath=../..'),
  ).toHaveText('SB8');
  await expect(monster.getByRole('heading', { name: 'Unnatural Strength (x2)' })).toBeVisible();

  await edit.press('Enter');
  await choices.click();
  await expect(options).toHaveText(['Unnatural Toughness (x2) Doubles Toughness Bonus']);
  await choices.press('Escape');
  const trait = monster.getByRole('heading', { name: 'Unnatural Strength (x2)' });
  const removeTrait = monster.getByRole('button', { name: 'Remove Unnatural Strength (x2)' });
  await removeTrait.click();
  await expect(
    monster.getByRole('button', { name: 'Undo removal of Unnatural Strength (x2)' }),
  ).toBeVisible();
  await expect(
    monster.getByTitle('Strength Bonus', { exact: true }).locator('xpath=../../dd'),
  ).toHaveText('8');
  await discard.click();
  await expect(removeTrait).toBeVisible();
  await removeTrait.click();
  await apply.click();
  await expect(trait).toHaveCount(0);
  await expect(apply).toBeFocused();
  await choices.click();
  await expect(options).toHaveText([
    'Unnatural Strength (x2) Doubles Strength Bonus',
    'Unnatural Toughness (x2) Doubles Toughness Bonus',
  ]);
  await choices.press('Escape');
  await expect(
    monster.getByTitle('Strength Bonus', { exact: true }).locator('xpath=../../dd'),
  ).toHaveText('4');
  await expect(choices).toBeFocused();
  await monster.getByRole('textbox', { name: 'Agility', exact: true }).fill('65');
  await discard.click();
  await expect(agility).toHaveValue('55');
  await expect(done).toBeVisible();
  await done.click();
  await saveAndFinish.press('Enter');
  await expect(movement).toHaveText(/Half Move5/);
  await expect(monster.getByText('Voidfarer', { exact: true })).toBeVisible();
  await back.press('Enter');
  await view.press('Enter');
  await expect(movement).toHaveText(/Half Move5/);
  await back.press('Enter');

  // Reloading the same system invalidates the prior creation result and its edit handle.
  await load.press('Enter');
  await expect(view).toBeDisabled();
  await expect(template).toBeEnabled();

  const invalid = await page.evaluate(() => window.rpgBuddy.createCharacterSheet({} as never));
  expect(invalid).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });

  // Exercise the live preload and main bridge before the edit controls are added.
  const bridgeEdit = await page.evaluate(async (template) => {
    const options = await window.rpgBuddy.getSheetCreationOptions();
    if (!options.ok || !options.options) throw new Error('Expected creation options');
    const created = await window.rpgBuddy.createCharacterSheet({
      template,
      selectionRevision: options.options.selectionRevision,
      role: 'character',
      id: 'bridge-edit-check',
      displayName: 'Bridge Edit Check',
    });
    if (!created.ok) throw new Error(created.message);
    return window.rpgBuddy.editSheet({
      ...created.editHandle,
      operation: ['set-value', 'agility', 42],
    });
  }, templateReference);
  expect(bridgeEdit).toMatchObject({
    ok: true,
    sheet: { values: { agility: 42 }, derived: { halfMove: 4, runMove: 24 } },
    editHandle: { revision: 1 },
  });
});

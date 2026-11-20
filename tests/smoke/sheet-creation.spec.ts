import { readRuntimeDefinitions } from '../fixtures/rogue-trader-definitions';
import { expect } from '@playwright/test';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from './fixtures/desktop-shell';

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

  // Replace the native picker only, leaving the creation bridge and filesystem inspection live.
  await application.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
  }, library);

  const picker = page.getByRole('button', { name: 'Choose library folder' });
  const system = page.getByRole('combobox', { name: 'Game system' });
  const load = page.getByRole('button', { name: 'Load system' });
  await picker.press('Enter');
  await system.press('End');
  await load.press('Enter');

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
  const character = panel.getByRole('region', { name: 'Élodie' });
  await expect(character.getByText('captain-elodie')).toBeVisible();
  await expect(character.getByText('character', { exact: true })).toBeVisible();
  await expect(character.getByText('Strength', { exact: true }).locator('..')).toHaveText(
    'Strength0',
  );
  await expect(character.getByText('Strength Bonus', { exact: true }).locator('..')).toHaveText(
    'Strength Bonus0',
  );

  await expect(panel.getByRole('status')).toHaveText('Created Élodie.');
  await name.fill('Another captain');
  await id.press('Enter');
  await expect(panel.getByRole('alert')).toHaveText(/ID is already in use/);
  await expect(panel.getByRole('status')).toBeEmpty();
  await expect(character.getByText('captain-elodie')).toBeVisible();

  await role.press('End');
  await name.fill('Void Beast');
  await expect(id).toHaveValue('captain-elodie');
  await id.fill('void-beast');
  await id.press('Enter');
  const monster = panel.getByRole('region', { name: 'Void Beast' });
  await expect(monster.getByText('void-beast')).toBeVisible();
  await expect(monster.getByText('monster', { exact: true })).toBeVisible();
  await expect(monster.getByRole('heading', { name: 'Final statistics' })).toBeVisible();
  await expect(panel.getByRole('status')).toHaveText('Created Void Beast.');

  const invalid = await page.evaluate(() => window.rpgBuddy.createCharacterSheet({} as never));
  expect(invalid).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
});

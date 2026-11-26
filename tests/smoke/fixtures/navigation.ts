import { expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';

/**
 * Locate the library navigation controls for setup and navigation assertions.
 * @param page The desktop renderer.
 * @returns The library region and its folder and system controls.
 */
export function gameLibrary(page: Page) {
  const region = page.getByRole('region', { name: 'Game library' });
  return {
    region,
    chooseFolder: region.getByRole('button', { name: 'Choose library folder' }),
    system: region.getByRole('combobox', { name: 'Game system' }),
    loadSystem: region.getByRole('button', { name: 'Load system' }),
  };
}

/**
 * Select and load a known system from an already chosen library.
 * @param page The desktop renderer.
 * @param systemId The option value to load.
 */
export async function loadLibrarySystem(page: Page, systemId: string): Promise<void> {
  const { region, system, loadSystem } = gameLibrary(page);
  await system.selectOption(systemId);
  await loadSystem.press('Enter');
  await expect(region.getByRole('status')).toHaveText(/^Loaded /);
}

/**
 * Set up a disposable library through the real UI, replacing only the native dialog.
 * @param page The packaged desktop renderer.
 * @param application The Electron application that owns the dialog.
 * @param folder Absolute path to the test library.
 * @param systemId The system in that library to load.
 */
export async function openLibrarySystem(
  page: Page,
  application: ElectronApplication,
  folder: string,
  systemId: string,
): Promise<void> {
  await application.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
  }, folder);
  await gameLibrary(page).chooseFolder.press('Enter');
  await loadLibrarySystem(page, systemId);
}

/**
 * Locate the controls for finding, loading, and viewing saved sheets.
 * @param page The desktop renderer.
 * @returns The saved-sheet region and its navigation controls.
 */
export function savedSheetNavigation(page: Page) {
  const region = page.getByRole('region', { name: 'Load a saved sheet' });
  return {
    region,
    role: region.getByRole('combobox', { name: 'Role' }),
    sheets: region.getByRole('combobox', { name: 'Saved sheet' }),
    loadSheet: region.getByRole('button', { name: 'Load sheet', exact: true }),
    viewSheet: region.getByRole('button', { name: 'View sheet' }),
  };
}

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isRecord } from '../shared/logging-contract';

export const LIBRARY_PREFERENCE_FILE = 'library-preference.json';

/**
 * Read the library folder preference from the local application profile.
 * @param profilePath Electron user-data folder.
 * @returns The remembered absolute folder, or undefined when the preference is absent.
 * @throws If the preference is unreadable or malformed.
 */
export async function readLibraryPreference(profilePath: string): Promise<string | undefined> {
  let contents: string;
  try {
    contents = await readFile(path.join(profilePath, LIBRARY_PREFERENCE_FILE), 'utf8');
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return undefined;
    throw error;
  }
  const value: unknown = JSON.parse(contents);
  if (
    !isRecord(value) ||
    typeof value.folder !== 'string' ||
    !path.isAbsolute(value.folder) ||
    Object.keys(value).length !== 1
  ) {
    throw new Error('Invalid library folder preference.');
  }
  return value.folder;
}

/**
 * Replace the folder preference using a temporary file in the same profile.
 * @param profilePath Electron user-data folder.
 * @param folder Validated absolute library folder.
 */
export async function writeLibraryPreference(profilePath: string, folder: string): Promise<void> {
  const target = path.join(profilePath, LIBRARY_PREFERENCE_FILE);
  const temporary = target + '.' + randomUUID() + '.tmp';
  await mkdir(profilePath, { recursive: true });
  try {
    await writeFile(temporary, JSON.stringify({ folder }) + '\n', { flag: 'wx' });
    await rename(temporary, target);
  } finally {
    // Cleanup is best-effort. Preserve the original result of the preference write.
    await rm(temporary, { force: true }).catch(() => {});
  }
}

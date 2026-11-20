import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Check whether a validated slug can be used as a path component on Windows.
 * @param slug Validated system or sheet slug.
 * @returns Whether the slug avoids reserved Windows device names.
 */
export function isPortableSlug(slug: string): boolean {
  return !WINDOWS_DEVICE_NAME.test(slug);
}

/**
 * Inspect a canonical library path without accepting symbolic links or aliases.
 * @param root Resolved library root.
 * @param relative Canonical slash-separated path below the root.
 * @param kind Required entry type.
 * @returns Whether the entry is missing, present with the expected type and spelling, or unsafe.
 */
export async function inspectLibraryEntry(
  root: string,
  relative: string,
  kind: 'directory' | 'file',
): Promise<'missing' | 'present' | 'unsafe'> {
  const file = path.join(root, relative);
  const info = await lstat(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (!info) return 'missing';
  const expectedType = kind === 'directory' ? info.isDirectory() : info.isFile();
  if (!expectedType) return 'unsafe';
  const exactPath =
    path
      .relative(root, await realpath(file))
      .split(path.sep)
      .join('/') === relative;
  return exactPath ? 'present' : 'unsafe';
}

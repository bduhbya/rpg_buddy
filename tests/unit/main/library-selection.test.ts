import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createLibraryHandler } from '../../../src/main/library-ipc';
import { LibrarySelection } from '../../../src/main/library-selection';
import {
  readLibraryPreference,
  writeLibraryPreference,
} from '../../../src/main/library-preference';
import { loadActiveSystem } from '../../../src/main/definition-loader';
import { noopLogger } from '../../../src/shared/logging-contract';

vi.mock('node:fs/promises', { spy: true });

let temp: string;
let profile: string;
let library: string;

// Give each case a disposable profile and a seed library with a malformed second system.
beforeEach(async () => {
  temp = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), 'rpg-buddy-selection-')));
  profile = path.join(temp, 'profile');
  library = path.join(temp, 'seed-library');
  await fs.cp(path.resolve('runtime-library'), library, { recursive: true });
  const malformed = path.join(library, 'RPG_systems', 'malformed');
  await fs.mkdir(malformed);
  await fs.writeFile(path.join(malformed, 'system.json'), '{invalid');
  vi.clearAllMocks();
});

// Remove the disposable profile and libraries after each case.
afterEach(async () => {
  await fs.rm(temp, { recursive: true, force: true });
});

// Control when an in-flight definition load completes.
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('main-process library selection', () => {
  it('discovers system IDs without reading definitions and restores only the folder on restart', async () => {
    const selection = new LibrarySelection(profile, noopLogger);
    expect(await selection.getView()).toMatchObject({ view: { folderName: null, systemIds: [] } });
    vi.clearAllMocks();

    expect(await selection.chooseFolder(async () => library)).toEqual({
      ok: true,
      outcome: 'accepted',
      view: {
        folderName: 'seed-library',
        systemIds: ['malformed', 'rogue-trader'],
        activeSystem: null,
        issue: null,
      },
    });
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(await selection.selectSystem('rogue-trader')).toMatchObject({
      outcome: 'accepted',
      view: { activeSystem: { id: 'rogue-trader' } },
    });
    expect(selection.getActiveCatalog()).toBeDefined();
    expect(vi.mocked(fs.readFile).mock.calls.map(([file]) => String(file))).toEqual([
      path.join(library, 'RPG_systems', 'rogue-trader', 'system.json'),
      path.join(library, 'RPG_systems', 'rogue-trader', 'manifests', '1.0.1', 'system.json'),
      path.join(
        library,
        'RPG_systems',
        'rogue-trader',
        'templates',
        'creature-core',
        '1.0.1',
        'template.json',
      ),
    ]);
    expect(await readLibraryPreference(profile)).toBe(library);
    vi.clearAllMocks();

    const restarted = new LibrarySelection(profile, noopLogger);
    expect(await restarted.getView()).toMatchObject({
      view: {
        folderName: 'seed-library',
        systemIds: ['malformed', 'rogue-trader'],
        activeSystem: null,
      },
    });
    expect(restarted.getActiveCatalog()).toBeUndefined();
    expect(fs.readFile).toHaveBeenCalledTimes(1);
  });

  it('preserves the active catalog on picker cancellation or invalid folders and releases it on a successful switch', async () => {
    const selection = new LibrarySelection(profile, noopLogger);
    await selection.chooseFolder(async () => library);
    await selection.selectSystem('rogue-trader');
    const active = selection.getActiveCatalog();

    expect(await selection.chooseFolder(async () => undefined)).toMatchObject({
      outcome: 'cancelled',
      view: { activeSystem: { id: 'rogue-trader' } },
    });
    expect(await selection.chooseFolder(async () => temp)).toMatchObject({
      outcome: 'failed',
      view: { activeSystem: { id: 'rogue-trader' }, issue: expect.stringContaining('RPG_systems') },
    });
    expect(selection.getActiveCatalog()).toBe(active);
    expect(await readLibraryPreference(profile)).toBe(library);

    const replacement = path.join(temp, 'replacement-library');
    await fs.mkdir(path.join(replacement, 'RPG_systems', 'new-system'), { recursive: true });
    expect(await selection.chooseFolder(async () => replacement)).toMatchObject({
      outcome: 'accepted',
      view: { folderName: 'replacement-library', systemIds: ['new-system'], activeSystem: null },
    });
    expect(selection.getActiveCatalog()).toBeUndefined();
    expect(await readLibraryPreference(profile)).toBe(replacement);
  });

  it('rejects a differently cased systems directory without replacing the active library', async () => {
    const selection = new LibrarySelection(profile, noopLogger);
    await selection.chooseFolder(async () => library);
    await selection.selectSystem('rogue-trader');
    const active = selection.getActiveCatalog();
    const replacement = path.join(temp, 'wrong-case-library');
    await fs.cp(path.join(library, 'RPG_systems'), path.join(replacement, 'rpg_systems'), {
      recursive: true,
    });

    expect(await selection.chooseFolder(async () => replacement)).toMatchObject({
      outcome: 'failed',
      view: {
        folderName: 'seed-library',
        activeSystem: { id: 'rogue-trader' },
      },
    });
    expect(selection.getActiveCatalog()).toBe(active);
    expect(await readLibraryPreference(profile)).toBe(library);
  });

  it('preserves the folder and catalog if persisting a replacement fails', async () => {
    const selection = new LibrarySelection(profile, noopLogger);
    await selection.chooseFolder(async () => library);
    await selection.selectSystem('rogue-trader');
    const active = selection.getActiveCatalog();
    const replacement = path.join(temp, 'replacement');
    await fs.mkdir(path.join(replacement, 'RPG_systems'), { recursive: true });
    vi.mocked(fs.rename).mockRejectedValueOnce(new Error('Profile write failed'));

    expect(await selection.chooseFolder(async () => replacement)).toMatchObject({
      outcome: 'failed',
      view: {
        folderName: 'seed-library',
        issue: expect.stringContaining('could not be remembered'),
      },
    });
    expect(selection.getActiveCatalog()).toBe(active);
    expect(await readLibraryPreference(profile)).toBe(library);
    expect(await fs.readdir(profile)).toEqual(['library-preference.json']);
  });

  it('recovers from a missing remembered folder and a malformed preference', async () => {
    await writeLibraryPreference(profile, path.join(temp, 'missing'));
    const missing = new LibrarySelection(profile, noopLogger);
    expect(await missing.getView()).toMatchObject({
      view: {
        folderName: null,
        issue: expect.stringContaining('remembered library folder is unavailable'),
      },
    });
    expect(await missing.chooseFolder(async () => library)).toMatchObject({ outcome: 'accepted' });

    await fs.writeFile(path.join(profile, 'library-preference.json'), '{"folder":"relative"}');
    const malformed = new LibrarySelection(profile, noopLogger);
    expect(await malformed.getView()).toMatchObject({
      view: { folderName: null, issue: expect.any(String) },
    });
    expect(await malformed.chooseFolder(async () => library)).toMatchObject({
      outcome: 'accepted',
    });
  });

  it('ignores symbolic links and non-system names during discovery', async () => {
    const systems = path.join(library, 'RPG_systems');
    await fs.mkdir(path.join(systems, 'INVALID'));
    await fs.writeFile(path.join(systems, 'plain-file'), '');
    await fs.symlink(path.join(systems, 'rogue-trader'), path.join(systems, 'linked'), 'junction');
    const selection = new LibrarySelection(profile, noopLogger);

    expect(await selection.chooseFolder(async () => library)).toMatchObject({
      view: { systemIds: ['malformed', 'rogue-trader'] },
    });
  });

  it('releases the previous catalog and preserves a newer rejection when an older load completes', async () => {
    const waiting = deferred<Awaited<ReturnType<typeof loadActiveSystem>>>();
    const entered = deferred<void>();
    const load = vi
      .fn(loadActiveSystem)
      .mockImplementationOnce(loadActiveSystem)
      .mockImplementationOnce(() => {
        entered.resolve(undefined);
        return waiting.promise;
      });
    const selection = new LibrarySelection(profile, noopLogger, load);
    await selection.chooseFolder(async () => library);
    await selection.selectSystem('rogue-trader');
    const pending = selection.selectSystem('rogue-trader');
    await entered.promise;
    expect(selection.getActiveCatalog()).toBeUndefined();

    expect(await selection.selectSystem('malformed')).toMatchObject({
      outcome: 'failed',
      view: { activeSystem: null, issue: expect.stringContaining('malformed/system.json') },
    });
    waiting.resolve(await loadActiveSystem(library, 'rogue-trader'));
    expect(await pending).toMatchObject({ outcome: 'superseded' });
    expect(selection.getActiveCatalog()).toBeUndefined();
    expect(await selection.getView()).toMatchObject({
      view: { activeSystem: null, issue: expect.stringContaining('malformed/system.json') },
    });
  });

  it('discards a pending catalog when a new library is accepted', async () => {
    const waiting = deferred<Awaited<ReturnType<typeof loadActiveSystem>>>();
    const entered = deferred<void>();
    const selection = new LibrarySelection(profile, noopLogger, () => {
      entered.resolve(undefined);
      return waiting.promise;
    });
    await selection.chooseFolder(async () => library);
    const pending = selection.selectSystem('rogue-trader');
    await entered.promise;
    const pendingView = selection.getView();
    const replacement = path.join(temp, 'replacement');
    await fs.mkdir(path.join(replacement, 'RPG_systems'), { recursive: true });
    await selection.chooseFolder(async () => replacement);
    expect(await pendingView).toMatchObject({
      view: { folderName: 'replacement', activeSystem: null },
    });
    waiting.resolve(await loadActiveSystem(library, 'rogue-trader'));

    expect(await pending).toMatchObject({
      outcome: 'superseded',
      view: { folderName: 'replacement', activeSystem: null },
    });
    expect(selection.getActiveCatalog()).toBeUndefined();
  });

  it('rejects foreign frames, path-bearing payloads and malformed versioned requests', async () => {
    const url = 'file:///trusted/index.html';
    const frame = { url };
    const owner = {
      mainFrame: frame,
      getURL: () => url,
      isDestroyed: () => false,
    } as unknown as WebContents;
    const trusted = { sender: owner, senderFrame: frame } as unknown as IpcMainInvokeEvent;
    const foreign = { sender: owner, senderFrame: { url } } as unknown as IpcMainInvokeEvent;
    const pick = vi.fn(async () => library);
    const selection = new LibrarySelection(profile, noopLogger);
    const handle = createLibraryHandler(() => owner, url, selection, pick);

    expect(await handle(foreign, { apiVersion: 1, action: 'choose' })).toEqual({
      ok: false,
      code: 'FORBIDDEN',
    });
    for (const request of [
      { apiVersion: 2, action: 'choose' },
      { apiVersion: 1, action: 'choose', folder: library },
      { apiVersion: 1, action: 'load', systemId: '../rogue-trader' },
      { apiVersion: 1, action: 'load', systemId: 'rogue-trader', extra: true },
    ]) {
      expect(await handle(trusted, request)).toEqual({ ok: false, code: 'INVALID_REQUEST' });
    }
    expect(await handle(trusted, { apiVersion: 1, action: 'get' }, 'extra')).toEqual({
      ok: false,
      code: 'INVALID_REQUEST',
    });
    expect(pick).not.toHaveBeenCalled();
    expect(await handle(trusted, { apiVersion: 1, action: 'choose' })).toMatchObject({
      outcome: 'accepted',
    });
    expect(pick).toHaveBeenCalledWith(owner);
  });
});

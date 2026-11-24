import type { IpcMainInvokeEvent, WebContents } from 'electron';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { INSTANCE_ROLES } from '../../../src/domain/definitions/document-models';
import type { Instance } from '../../../src/domain/definitions/document-models';
import { LibrarySelection } from '../../../src/main/library-selection';
import { createSheetLoadingHandler } from '../../../src/main/sheet-loading-ipc';
import { createSheetLoadingWorkflow } from '../../../src/main/sheet-loading-workflow';
import { createSheetEditing } from '../../../src/main/sheet-editing';
import { noopLogger } from '../../../src/shared/logging-contract';
import type { LogInput } from '../../../src/shared/logging-contract';
import {
  readAuthoredDefinitions,
  seedAuthoredDefinitions,
} from '../../fixtures/rogue-trader-definitions';

const fixtures = readAuthoredDefinitions();
const systemId = fixtures.system.id;
let temp: string;
let system: string;
let selection: LibrarySelection;
let requestSheet: ReturnType<typeof createSheetLoadingWorkflow>;
let records: LogInput[];
let editing: ReturnType<typeof createSheetEditing>;

// Write a file at a test-controlled path relative to the selected system.
async function put(relative: string, contents: string | Uint8Array): Promise<string> {
  const file = path.join(system, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, contents);
  return file;
}

// Open an isolated library containing active and exact archived definitions.
beforeEach(async () => {
  temp = await realpath(await mkdtemp(path.join(tmpdir(), 'rpg-buddy-sheet-loading-')));
  const library = path.join(temp, 'library');
  const seeded = await seedAuthoredDefinitions(library, fixtures);
  system = path.join(library, seeded.system);
  await put('system.json', await readFile(new URL('system.json', fixtures.root)));
  selection = new LibrarySelection(path.join(temp, 'profile'), noopLogger);
  await selection.chooseFolder(async () => library);
  await selection.selectSystem(systemId);
  records = [];
  const logger = { record: (entry: LogInput) => records.push(entry) };
  editing = createSheetEditing(selection, logger);
  requestSheet = createSheetLoadingWorkflow(selection, logger, editing);
});

// Remove the disposable profile and library.
afterEach(async () => {
  await rm(temp, { recursive: true, force: true });
});

test.each([
  ['character', 'characters', 'explorator'],
  ['monster', 'monsters', 'ork-freebooter'],
] as const)('lists and opens a saved %s with stored values', async (role, directory, fixture) => {
  const bytes = await readFile(new URL(fixture + '.instance.json', fixtures.root));
  const sheet = JSON.parse(bytes.toString('utf8')) as Instance;
  const file = await put(directory + '/' + sheet.id + '.json', bytes);
  await put(directory + '/' + sheet.id + '.json.bak', bytes);
  await put(directory + '/UPPERCASE.json', bytes);
  await put('other/ignored.json', bytes);
  await mkdir(path.join(system, directory, 'folder.json'));

  const list = await requestSheet({ action: 'list', role });
  if (!list.ok || list.action !== 'list') throw new Error('Expected sheet choices');
  expect(list.sheets).toEqual([{ id: sheet.id, displayName: sheet.displayName }]);
  for (const otherRole of INSTANCE_ROLES.filter((candidate) => candidate !== role)) {
    expect(await requestSheet({ action: 'list', role: otherRole })).toMatchObject({
      ok: true,
      sheets: [],
    });
  }

  const open = {
    action: 'open',
    role,
    id: sheet.id,
    selectionRevision: list.selectionRevision,
  } as const;
  const opened = await requestSheet(open);
  if (!opened.ok || opened.action !== 'open' || opened.mode !== 'editable') {
    throw new Error('Expected an editable sheet');
  }
  expect(opened).toEqual({
    ok: true,
    action: 'open',
    mode: 'editable',
    sheet,
    editHandle: { token: expect.any(String), revision: 0 },
    modifierTargets: ['strengthBonus', 'toughnessBonus'],
  });
  const edited = editing.apply({
    ...opened.editHandle,
    operation: ['set-display-name', 'Edited sheet'],
  });
  expect(edited).toMatchObject({
    ok: true,
    sheet: { displayName: 'Edited sheet', derived: sheet.derived },
    editHandle: { revision: 1 },
  });
  await rename(path.join(system, fixtures.archivePath), path.join(system, 'archive-away.json'));
  const readOnly = await requestSheet(open);
  expect(readOnly).toMatchObject({
    ok: true,
    action: 'open',
    mode: 'read-only',
    sheet,
    diagnostics: [{ code: 'DEFINITION_NOT_FOUND' }],
  });
  expect(readOnly).not.toHaveProperty('editHandle');
  if (!edited.ok) throw new Error('Expected the edit to succeed');
  expect(editing.apply({ ...edited.editHandle, operation: ['set-career', null] })).toEqual({
    ok: false,
    code: 'STALE_SHEET',
  });
  expect(await readFile(file)).toEqual(bytes);
  expect(records).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        event: 'instance.load',
        step: 'sheets.list',
        outcome: 'succeeded',
      }),
      expect.objectContaining({ event: 'instance.load', step: 'sheet.open', outcome: 'succeeded' }),
      expect.objectContaining({
        event: 'instance.load',
        step: 'definitions.resolve',
        outcome: 'degraded',
        reason: 'DEFINITION_NOT_FOUND',
      }),
    ]),
  );
  expect(JSON.stringify(records)).not.toContain(sheet.id);
});

test('locks selection during open, releases it on failure, and rejects an old revision', async () => {
  const file = await put('characters/invalid.json', '{');
  const list = await requestSheet({ action: 'list', role: 'character' });
  if (!list.ok || list.action !== 'list') throw new Error('Expected sheet choices');
  expect(list.sheets).toEqual([{ id: 'invalid' }]);
  const open = {
    action: 'open',
    role: 'character',
    id: 'invalid',
    selectionRevision: list.selectionRevision,
  } as const;
  const pending = requestSheet(open);
  const picker = vi.fn(async () => undefined);
  const [folder, systemChange, competingOpen] = await Promise.all([
    selection.chooseFolder(picker),
    selection.selectSystem(systemId),
    requestSheet(open),
  ]);
  for (const result of [folder, systemChange]) {
    expect(result).toMatchObject({
      ok: true,
      outcome: 'failed',
      view: {
        activeSystem: { id: systemId },
        issue: expect.stringContaining('A sheet is opening'),
      },
    });
  }
  expect(picker).not.toHaveBeenCalled();
  expect(competingOpen).toEqual({ ok: false, code: 'BUSY' });
  expect(await pending).toMatchObject({ ok: false, code: 'INVALID_JSON' });
  expect(await readFile(file, 'utf8')).toBe('{');
  expect(await selection.selectSystem(systemId)).toMatchObject({ ok: true, outcome: 'accepted' });
  expect(await requestSheet(open)).toEqual({ ok: false, code: 'STALE_SELECTION' });
  expect(records).toContainEqual(
    expect.objectContaining({
      event: 'instance.load',
      step: 'selection.check',
      outcome: 'rejected',
      reason: 'STALE_SELECTION',
    }),
  );
});

test('does not open a sheet while a folder picker is pending', async () => {
  const list = await requestSheet({ action: 'list', role: 'character' });
  if (!list.ok || list.action !== 'list') throw new Error('Expected sheet choices');
  const open = {
    action: 'open',
    role: 'character',
    id: 'example',
    selectionRevision: list.selectionRevision,
  } as const;
  let cancelPicker!: () => void;
  const picked = new Promise<undefined>((resolve) => {
    cancelPicker = () => resolve(undefined);
  });
  let notifyPickerStarted!: () => void;
  const pickerStarted = new Promise<void>((resolve) => {
    notifyPickerStarted = resolve;
  });
  const change = selection.chooseFolder(() => {
    notifyPickerStarted();
    return picked;
  });
  await pickerStarted;
  try {
    expect(await requestSheet(open)).toEqual({ ok: false, code: 'BUSY' });
  } finally {
    cancelPicker();
    await change;
  }
  expect(await requestSheet(open)).toMatchObject({ ok: false, code: 'INVALID_VALUE' });
});

test('rejects a linked role directory', async () => {
  await mkdir(path.join(temp, 'outside'));
  await symlink(path.join(temp, 'outside'), path.join(system, 'characters'), 'junction');
  expect(await requestSheet({ action: 'list', role: 'character' })).toEqual({
    ok: false,
    code: 'LIBRARY_UNAVAILABLE',
  });
});

test('dispatches only trusted and closed IPC requests', async () => {
  const url = 'file:///app/index.html';
  const frame = { url };
  const owner = {
    mainFrame: frame,
    getURL: () => url,
    isDestroyed: () => false,
  } as unknown as WebContents;
  const trusted = { sender: owner, senderFrame: frame } as unknown as IpcMainInvokeEvent;
  const foreign = { ...trusted, senderFrame: { url } } as unknown as IpcMainInvokeEvent;
  const dispatch = vi.fn(requestSheet);
  const handler = createSheetLoadingHandler(() => owner, url, dispatch, noopLogger);
  const list = { action: 'list', role: 'character' };
  expect(handler(foreign, list)).toEqual({ ok: false, code: 'FORBIDDEN' });
  for (const payload of [
    null,
    { ...list, systemId },
    { ...list, role: 'other' },
    { ...list, action: 'open', id: '../invalid', selectionRevision: 1 },
    { ...list, action: 'open', id: 'valid', selectionRevision: -1 },
  ]) {
    expect(handler(trusted, payload)).toEqual({ ok: false, code: 'INVALID_REQUEST' });
  }
  expect(handler(trusted, list, list)).toEqual({ ok: false, code: 'INVALID_REQUEST' });
  expect(dispatch).not.toHaveBeenCalled();
  expect(await handler(trusted, list)).toMatchObject({ ok: true, action: 'list' });
  expect(dispatch).toHaveBeenCalledExactlyOnceWith(list);
});

import { readRuntimeDefinitions } from '../../fixtures/rogue-trader-definitions';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { afterEach, beforeEach, expect, it } from 'vitest';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LibrarySelection } from '../../../src/main/library-selection';
import { createSheetCreationHandlers } from '../../../src/main/sheet-creation-ipc';
import { archivedSystemManifestPath } from '../../../src/main/library-paths';
import { createSheetLoadingWorkflow } from '../../../src/main/sheet-loading-workflow';
import { saveInstance } from '../../../src/main/instance-saver';
import { createSheetSavingHandler } from '../../../src/main/sheet-saving';
import { createSheetWorkflow } from '../../../src/main/sheet-creation-workflow';
import {
  createSheetEditing,
  createSheetEditingHandler,
  createSheetEditPreviewHandler,
} from '../../../src/main/sheet-editing';
import { validateInstanceSnapshot } from '../../../src/domain/instances/validate-instance-snapshot';
import { noopLogger } from '../../../src/shared/logging-contract';
import type { LogInput } from '../../../src/shared/logging-contract';
import type { SheetCreationRequest } from '../../../src/shared/sheet-creation-contract';

const { system: systemReference, template } = readRuntimeDefinitions();
let temp: string;
let library: string;
let system: string;
let selection: LibrarySelection;
let workflow: ReturnType<typeof createSheetWorkflow>;
let request: SheetCreationRequest;
let records: LogInput[];
let editing: ReturnType<typeof createSheetEditing>;

// Exercise the real library loader with a fresh profile and a disposable library.
beforeEach(async () => {
  temp = await realpath(await mkdtemp(path.join(tmpdir(), 'rpg-buddy-create-')));
  library = path.join(temp, 'library');
  system = path.join(library, 'RPG_systems', 'rogue-trader');
  await cp(path.resolve('runtime-library'), library, { recursive: true });
  selection = new LibrarySelection(path.join(temp, 'profile'), noopLogger);
  records = [];
  const logger = { record: (entry: LogInput) => records.push(entry) };
  editing = createSheetEditing(selection, logger);
  workflow = createSheetWorkflow(selection, logger, editing);
  expect(workflow.getSheetCreationOptions()).toBeNull();
  await selection.chooseFolder(async () => library);
  expect(workflow.getSheetCreationOptions()).toBeNull();
  await selection.selectSystem('rogue-trader');
  const options = workflow.getSheetCreationOptions();
  if (!options) throw new Error('Fixture system failed to load');
  request = {
    selectionRevision: options.selectionRevision,
    template,
    role: 'character',
    id: 'captain-private',
    displayName: '  Captain Private  ',
  };
});

it('authorizes one revisioned edit at a time and preserves state when an edit fails', async () => {
  const created = await workflow.createCharacterSheet(request);
  if (!created.ok) throw new Error(created.message);
  const url = 'file:///application/index.html';
  const frame = { url };
  const owner = {
    isDestroyed: () => false,
    getURL: () => url,
    mainFrame: frame,
  } as unknown as WebContents;
  const event = { sender: owner, senderFrame: frame } as IpcMainInvokeEvent;
  const handle = createSheetEditingHandler(() => owner, url, editing.apply, {
    record: (entry) => records.push(entry),
  });
  const apply = { ...created.editHandle, operation: ['set-value', 'strength', 43] };
  const preview = createSheetEditPreviewHandler(() => owner, url, editing.preview, {
    record: (entry) => records.push(entry),
  });
  const previewRequest = { ...created.editHandle, operations: [apply.operation] };
  expect(preview({ ...event, senderFrame: { url } } as IpcMainInvokeEvent, previewRequest)).toEqual(
    {
      ok: false,
      code: 'FORBIDDEN',
    },
  );
  expect(preview(event, { ...previewRequest, operations: [['discard-changes']] })).toEqual({
    ok: false,
    code: 'INVALID_REQUEST',
  });
  expect(preview(event, previewRequest)).toEqual({ ok: true, hasChanges: true });
  expect(handle({ ...event, senderFrame: { url } } as IpcMainInvokeEvent, apply)).toEqual({
    ok: false,
    code: 'FORBIDDEN',
  });
  expect(handle(event, { ...apply, sheet: created.sheet })).toEqual({
    ok: false,
    code: 'INVALID_REQUEST',
  });
  expect(handle(event, { ...apply, operation: ['set-value', 'strength', '43'] })).toEqual({
    ok: false,
    code: 'INVALID_REQUEST',
  });
  for (const operation of [
    ['add-entry', '{}'],
    ['replace-entry', '{}'],
    ['add-rulebook-entry', 'custom-strength'],
    ['add-rulebook-entry', 'unnatural-strength', 99],
  ]) {
    expect(handle(event, { ...apply, operation })).toEqual({ ok: false, code: 'INVALID_REQUEST' });
  }
  expect(handle(event, { ...apply, operation: ['set-value', 'strength', -1] })).toMatchObject({
    ok: false,
    diagnostics: [{ pointer: expect.stringContaining('strength') }],
  });
  const edited = handle(event, apply);
  expect(edited).toMatchObject({
    ok: true,
    sheet: { values: { strength: 43 }, derived: { strengthBonus: 4 } },
    editHandle: { token: created.editHandle.token, revision: 1 },
  });
  expect(created.sheet).toMatchObject({ values: { strength: 0 }, derived: { strengthBonus: 0 } });
  expect(handle(event, apply)).toEqual({ ok: false, code: 'STALE_SHEET' });
  expect(preview(event, previewRequest)).toEqual({ ok: false, code: 'STALE_SHEET' });
  const next = await workflow.createCharacterSheet({ ...request, id: 'replacement' });
  if (!next.ok) throw new Error(next.message);
  expect(handle(event, { ...apply, revision: 1 })).toEqual({ ok: false, code: 'STALE_SHEET' });
  await selection.selectSystem('rogue-trader');
  expect(handle(event, { ...apply, ...next.editHandle })).toEqual({
    ok: false,
    code: 'STALE_SHEET',
  });
  expect(records).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        event: 'instance.edit',
        step: 'sheet.update',
        outcome: 'succeeded',
        level: 'info',
      }),
      expect.objectContaining({
        event: 'instance.edit',
        level: 'warn',
        reason: expect.any(String),
      }),
      expect.objectContaining({
        event: 'instance.edit',
        step: 'sheet.check',
        outcome: 'rejected',
        reason: 'STALE_SHEET',
      }),
    ]),
  );
  const logged = JSON.stringify(records);
  expect(logged).not.toContain(created.editHandle.token);
  expect(logged).not.toContain(created.sheet.displayName);
  expect(logged).not.toContain(created.sheet.id);
});

// Remove the isolated test data.
afterEach(async () => {
  await rm(temp, { recursive: true, force: true });
});

it('offers exact active templates and builds both roles without writing a sheet', async () => {
  expect(workflow.getSheetCreationOptions()?.templates).toEqual([
    { reference: template, label: 'Creature - core statistics' },
  ]);
  const before = await readdir(system);
  for (const role of ['character', 'monster'] as const) {
    const result = await workflow.createCharacterSheet({ ...request, role });
    if (!result.ok) throw new Error(result.message);
    expect(result.sheet).toMatchObject({
      id: request.id,
      displayName: 'Captain Private',
      role,
      template,
      system: systemReference,
      values: { strength: 0 },
      derived: { strengthBonus: 0 },
      entries: [],
      modifiedAt: result.sheet.createdAt,
    });
    expect(validateInstanceSnapshot(result.sheet, 'created sheet').success).toBe(true);
  }
  expect(await readdir(system)).toEqual(before);
});

it.each(['../escape', 'Uppercase', 'two--parts', 'con', 'a'.repeat(65)])(
  'rejects invalid or nonportable ID %s',
  async (id) => {
    expect(await workflow.createCharacterSheet({ ...request, id })).toMatchObject({
      ok: false,
      code: 'INVALID_VALUE',
      field: 'id',
    });
  },
);

it('rejects a blank name and a template revision that was not offered', async () => {
  expect(await workflow.createCharacterSheet({ ...request, displayName: '   ' })).toMatchObject({
    ok: false,
    field: 'displayName',
  });
  expect(
    await workflow.createCharacterSheet({
      ...request,
      template: { ...template, version: '1.0.0' },
    }),
  ).toMatchObject({ ok: false, code: 'DEFINITION_NOT_FOUND', field: 'template' });
});

it.each(['CAPTAIN-PRIVATE.JSON', 'captain-private.json.bak', 'captain-private.json.lock'])(
  'treats %s as an occupied destination',
  async (filename) => {
    const directory = path.join(system, 'characters');
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), 'existing artifact');
    expect(await workflow.createCharacterSheet(request)).toMatchObject({
      ok: false,
      code: 'ID_OCCUPIED',
    });
    expect(await readdir(directory)).toContain(filename);
    expect((await workflow.createCharacterSheet({ ...request, id: 'another-captain' })).ok).toBe(
      true,
    );
  },
);

it('rejects competing in-memory creations for the same destination', async () => {
  const results = await Promise.all([
    workflow.createCharacterSheet(request),
    workflow.createCharacterSheet(request),
  ]);
  expect(results.filter(({ ok }) => ok)).toHaveLength(1);
  expect(results).toContainEqual(expect.objectContaining({ ok: false, code: 'ID_OCCUPIED' }));
});

it('rejects a superseded selection during inspection and on retry', async () => {
  const inFlight = workflow.createCharacterSheet(request);
  await selection.selectSystem('rogue-trader');
  expect(await inFlight).toMatchObject({ ok: false, code: 'STALE_SELECTION' });
  expect(await workflow.createCharacterSheet(request)).toMatchObject({
    ok: false,
    code: 'STALE_SELECTION',
  });
  expect(
    (
      await workflow.createCharacterSheet({
        ...request,
        selectionRevision: workflow.getSheetCreationOptions()!.selectionRevision,
      })
    ).ok,
  ).toBe(true);
});

it('rejects an unsafe role directory', async () => {
  await writeFile(path.join(system, 'characters'), 'not a directory');
  expect(await workflow.createCharacterSheet(request)).toMatchObject({
    ok: false,
    code: 'LIBRARY_UNAVAILABLE',
  });
});

it('logs safe correlated outcomes and preserves results when the logger throws', async () => {
  expect((await workflow.createCharacterSheet(request)).ok).toBe(true);
  expect((await workflow.createCharacterSheet(request)).ok).toBe(false);
  const [started, success, retry, collision] = records;
  expect(records).toHaveLength(4);
  expect(started).toMatchObject({ event: 'instance.create', outcome: 'started', level: 'info' });
  expect(success).toMatchObject({
    step: 'sheet.build',
    outcome: 'succeeded',
    operationId: started.operationId,
  });
  expect(collision).toMatchObject({
    step: 'destination.inspect',
    outcome: 'rejected',
    level: 'warn',
    reason: 'ID_OCCUPIED',
    operationId: retry.operationId,
  });
  expect(retry.operationId).not.toBe(started.operationId);
  const serialized = JSON.stringify(records);
  for (const privateValue of [
    request.id,
    request.displayName.trim(),
    'rogue-trader',
    'creature-core',
    'strength',
    'library',
  ]) {
    expect(serialized).not.toContain(privateValue);
  }

  // A failing sink must preserve both a successful creation and its collision result.
  const noisy = createSheetWorkflow(
    selection,
    {
      record() {
        throw new Error('logging failure');
      },
    },
    editing,
  );
  expect((await noisy.createCharacterSheet(request)).ok).toBe(true);
  expect(await noisy.createCharacterSheet(request)).toMatchObject({
    ok: false,
    code: 'ID_OCCUPIED',
  });
});

it('authorizes creation IPC and rejects malformed requests without dispatching', async () => {
  const url = 'file:///app/index.html';
  const frame = { url };
  const owner = {
    mainFrame: frame,
    getURL: () => url,
    isDestroyed: () => false,
  } as unknown as WebContents;
  const trusted = { sender: owner, senderFrame: frame } as unknown as IpcMainInvokeEvent;
  const foreign = { sender: owner, senderFrame: { url } } as unknown as IpcMainInvokeEvent;
  const handlers = createSheetCreationHandlers(() => owner, url, workflow, noopLogger);

  expect(handlers.handleGetSheetCreationOptions(foreign)).toEqual({ ok: false, code: 'FORBIDDEN' });
  expect(handlers.handleGetSheetCreationOptions(trusted, {})).toEqual({
    ok: false,
    code: 'INVALID_REQUEST',
  });
  expect(handlers.handleGetSheetCreationOptions(trusted)).toMatchObject({
    ok: true,
    options: { templates: [{ reference: template }] },
  });
  expect(await handlers.handleCreateCharacterSheet(foreign, request)).toMatchObject({
    ok: false,
    code: 'FORBIDDEN',
  });
  expect(
    await handlers.handleCreateCharacterSheet(trusted, { ...request, root: library }),
  ).toMatchObject({
    ok: false,
    code: 'INVALID_REQUEST',
  });
  expect(
    await handlers.handleCreateCharacterSheet(trusted, {
      ...request,
      template: { ...template, version: 'latest' },
    }),
  ).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
  expect(records).toHaveLength(0);
  expect(await handlers.handleCreateCharacterSheet(trusted, request)).toMatchObject({ ok: true });
});

it.each([
  ['character', 'characters'],
  ['monster', 'monsters'],
] as const)(
  'saves only the authorized %s revision to its library destination',
  async (role, directory) => {
    const created = await workflow.createCharacterSheet({ ...request, role });
    if (!created.ok) throw new Error(created.message);
    const { editHandle, sheet } = created;
    const url = 'file:///application/index.html';
    const frame = { url };
    const owner = {
      isDestroyed: () => false,
      getURL: () => url,
      mainFrame: frame,
    } as unknown as WebContents;
    const event = { sender: owner, senderFrame: frame } as IpcMainInvokeEvent;
    const handle = createSheetSavingHandler(() => owner, url, editing, {
      record: (entry) => records.push(entry),
    });
    const list = { ...editHandle, action: 'list' };
    const save = { ...editHandle, action: 'save', destinationId: directory };
    const target = path.join(system, directory, sheet.id + '.json');

    await expect(
      handle({ ...event, senderFrame: { url } } as IpcMainInvokeEvent, list),
    ).resolves.toEqual({
      ok: false,
      code: 'FORBIDDEN',
    });
    for (const badRequest of [
      { ...save, sheet },
      { ...save, destinationId: '../escape' },
      { ...list, revision: -1 },
    ]) {
      await expect(handle(event, badRequest)).resolves.toEqual({
        ok: false,
        code: 'INVALID_REQUEST',
      });
    }
    const otherDirectory = role === 'character' ? 'monsters' : 'characters';
    await expect(handle(event, { ...save, destinationId: otherDirectory })).resolves.toEqual({
      ok: false,
      code: 'INVALID_DESTINATION',
    });
    await expect(handle(event, list)).resolves.toEqual({
      ok: true,
      action: 'list',
      hasSaved: false,
      destinations: [
        {
          id: directory,
          label: expect.stringContaining(role === 'character' ? 'Characters' : 'Monsters'),
        },
      ],
    });

    const firstSave = handle(event, save);
    await expect(handle(event, save)).resolves.toEqual({ ok: false, code: 'BUSY' });
    await expect(firstSave).resolves.toEqual({ ok: true, action: 'save' });
    await expect(handle(event, list)).resolves.toMatchObject({ ok: true, hasSaved: true });
    const original = await readFile(target, 'utf8');
    expect(JSON.parse(original)).toEqual(sheet);

    const context = selection.getCreationContext();
    if (!context) throw new Error('Fixture system failed to load');
    const load = createSheetLoadingWorkflow(selection, noopLogger, editing);
    const open = {
      action: 'open',
      id: sheet.id,
      role,
      selectionRevision: context.revision,
    } as const;
    const opened = await load(open);
    if (!opened.ok || opened.action !== 'open' || opened.mode !== 'editable') {
      throw new Error('Expected an editable sheet');
    }
    const edited = editing.apply({ ...editHandle, operation: ['set-value', 'strength', 43] });
    if (!edited.ok) throw new Error(edited.code);
    await expect(handle(event, save)).resolves.toEqual({ ok: false, code: 'STALE_SHEET' });

    const overwrite = { ...save, ...edited.editHandle };
    await writeFile(target + '.lock', '');
    await expect(handle(event, overwrite)).resolves.toMatchObject({
      ok: false,
      diagnostics: [{ message: expect.stringContaining('recovery') }],
    });
    expect(await readFile(target, 'utf8')).toBe(original);
    await rm(target + '.lock');
    await expect(handle(event, overwrite)).resolves.toEqual({ ok: true, action: 'save' });
    expect(JSON.parse(await readFile(target, 'utf8'))).toEqual(edited.sheet);
    expect(await readFile(target + '.bak', 'utf8')).toBe(original);

    const updated = await readFile(target, 'utf8');
    const retimestamped = { ...edited.sheet, modifiedAt: '2099-01-01T00:00:00.000Z' };
    await expect(saveInstance(library, retimestamped, noopLogger, edited.sheet)).resolves.toEqual({
      success: true,
      value: edited.sheet,
    });
    await expect(handle(event, overwrite)).resolves.toEqual({ ok: true, action: 'save' });
    expect(await readFile(target, 'utf8')).toBe(updated);
    expect(await readFile(target + '.bak', 'utf8')).toBe(original);

    await expect(handle(event, { ...save, ...opened.editHandle })).resolves.toMatchObject({
      ok: false,
      code: 'SAVE_CONFLICT',
      diagnostics: [{ message: expect.stringContaining('Reopen') }],
    });
    expect(JSON.parse(await readFile(target, 'utf8'))).toEqual(edited.sheet);
    expect(await readFile(target + '.bak', 'utf8')).toBe(original);
    const reopened = await load(open);
    if (!reopened.ok || reopened.action !== 'open' || reopened.mode !== 'editable') {
      throw new Error('Expected an editable sheet');
    }
    expect(reopened.sheet).toEqual(edited.sheet);
    const renamed = editing.apply({
      ...reopened.editHandle,
      operation: ['set-display-name', 'Renamed sheet'],
    });
    if (!renamed.ok) throw new Error(renamed.code);
    await expect(handle(event, { ...save, ...renamed.editHandle })).resolves.toEqual({
      ok: true,
      action: 'save',
    });
    expect(JSON.parse(await readFile(target, 'utf8'))).toEqual(renamed.sheet);

    const archive = path.join(library, archivedSystemManifestPath(sheet.system));
    await rename(archive, archive + '.away');
    const readOnly = await load(open);
    expect(readOnly).toMatchObject({
      ok: true,
      action: 'open',
      mode: 'read-only',
      sheet: renamed.sheet,
    });
    expect(readOnly).not.toHaveProperty('editHandle');
    await expect(handle(event, { ...save, ...renamed.editHandle })).resolves.toEqual({
      ok: false,
      code: 'STALE_SHEET',
    });
    await rename(archive + '.away', archive);
    await expect(handle(event, { ...save, ...opened.editHandle })).resolves.toEqual({
      ok: false,
      code: 'STALE_SHEET',
    });
    await selection.selectSystem('rogue-trader');
    await expect(handle(event, overwrite)).resolves.toEqual({ ok: false, code: 'STALE_SHEET' });

    const saveRecords = records.filter(({ event }) => event === 'instance.save');
    expect(saveRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ step: 'destination.list', outcome: 'succeeded' }),
        expect.objectContaining({ step: 'sheet.save', outcome: 'succeeded' }),
        expect.objectContaining({ step: 'destination.check', reason: 'INVALID_DESTINATION' }),
        expect.objectContaining({ step: 'sheet.save', outcome: 'unchanged' }),
        expect.objectContaining({ reason: 'SAVE_LOCKED', outcome: 'rejected' }),
        expect.objectContaining({ reason: 'SAVE_CONFLICT', outcome: 'rejected' }),
      ]),
    );
    const logged = JSON.stringify(saveRecords);
    for (const privateValue of [sheet.id, sheet.displayName, editHandle.token, library]) {
      expect(logged).not.toContain(privateValue);
    }
  },
);

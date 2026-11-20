import { readRuntimeDefinitions } from '../../fixtures/rogue-trader-definitions';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { cp, mkdir, mkdtemp, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LibrarySelection } from '../../../src/main/library-selection';
import { createSheetCreationHandlers } from '../../../src/main/sheet-creation-ipc';
import { createSheetWorkflow } from '../../../src/main/sheet-creation-workflow';
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

// Exercise the real library loader with a fresh profile and a disposable library.
beforeEach(async () => {
  temp = await realpath(await mkdtemp(path.join(tmpdir(), 'rpg-buddy-create-')));
  library = path.join(temp, 'library');
  system = path.join(library, 'RPG_systems', 'rogue-trader');
  await cp(path.resolve('runtime-library'), library, { recursive: true });
  selection = new LibrarySelection(path.join(temp, 'profile'), noopLogger);
  records = [];
  workflow = createSheetWorkflow(selection, { record: (entry) => records.push(entry) });
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
  const noisy = createSheetWorkflow(selection, {
    record() {
      throw new Error('logging failure');
    },
  });
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

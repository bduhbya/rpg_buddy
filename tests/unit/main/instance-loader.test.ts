import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import type { Instance, Template } from '../../../src/domain/definitions/document-models';
import { noopLogger } from '../../../src/shared/logging-contract';
import { loadSavedInstance } from '../../../src/main/instance-loader';
import { LogService } from '../../../src/main/logging';

const systemId = 'rogue-trader';
const system = 'RPG_systems/rogue-trader';
const manifest = `${system}/manifests/1.0.1/system.json`;
const template = `${system}/templates/creature-core/1.0.1/template.json`;
const fixtures = new URL('../../../data_contracts/examples/v2/', import.meta.url);
let root: string;

// Write one fixture at its canonical path under the disposable library.
async function put(document: string, value: string | Uint8Array): Promise<void> {
  const file = path.join(root, document);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, value);
}

// Read an example and place it at its role-specific path.
async function saveExample(name: string) {
  const bytes = await readFile(new URL(`${name}.instance.json`, fixtures));
  const sheet = JSON.parse(bytes.toString('utf8')) as Instance;
  const address = { systemId, role: sheet.role, instanceId: sheet.id };
  const document = `${system}/${sheet.role === 'monster' ? 'monsters' : 'characters'}/${sheet.id}.json`;
  await put(document, bytes);
  return { address, bytes, document, sheet };
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'rpg-buddy-instance-'));
  await put(manifest, await readFile(new URL('system.json', fixtures)));
  await put(
    template,
    await readFile(new URL('templates/creature-core/1.0.1/template.json', fixtures)),
  );
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

test.each(['explorator', 'ork-freebooter'])(
  'opens %s from the exact archive and preserves its bytes',
  async (name) => {
    const { address, bytes, document, sheet } = await saveExample(name);
    const active = JSON.parse(await readFile(new URL('system.json', fixtures), 'utf8'));
    await put(`${system}/system.json`, JSON.stringify({ ...active, version: '9.0.0' }));

    // This exact template passes static checks but would fail if opening evaluated formulas.
    const definition: Template = JSON.parse(await readFile(path.join(root, template), 'utf8'));
    definition.derived[0].expression = {
      op: 'divide',
      left: { op: 'constant', value: 1 },
      right: { op: 'constant', value: 0 },
    };
    await put(template, JSON.stringify(definition));

    expect(await loadSavedInstance(root, address, noopLogger)).toMatchObject({
      success: true,
      value: { mode: 'editable', sheet, definitions: { system: { document: manifest } } },
    });
    expect(await readFile(path.join(root, document))).toEqual(bytes);

    await rename(path.join(root, manifest), path.join(root, manifest + '.away'));
    expect(await loadSavedInstance(root, address, noopLogger)).toEqual({
      success: true,
      value: {
        mode: 'read-only',
        sheet,
        diagnostics: [
          {
            document: manifest,
            code: 'DEFINITION_NOT_FOUND',
            pointer: '',
            message: 'Supply the definition at its library path.',
          },
        ],
      },
    });
    expect(await readFile(path.join(root, document))).toEqual(bytes);
  },
);

test.each([
  ['bad UTF-8', Buffer.from([0xff]), 'INVALID_JSON'],
  ['duplicate keys', Buffer.from('{"schemaVersion":2,"schemaVersion":2}'), 'INVALID_JSON'],
  ['v1', Buffer.from('{"schemaVersion":1}'), 'UNSUPPORTED_SCHEMA_VERSION'],
])('rejects %s without changing the file', async (_label, bytes, code) => {
  const { address, document } = await saveExample('explorator');
  await put(document, bytes);
  expect(await loadSavedInstance(root, address, noopLogger)).toMatchObject({
    success: false,
    diagnostics: [{ document, code }],
  });
  expect(await readFile(path.join(root, document))).toEqual(bytes);
});

test('reports malformed saved-sheet JSON without asking for a definition', async () => {
  const { address, document } = await saveExample('explorator');
  const bytes = Buffer.from('{bad');
  await put(document, bytes);
  expect(await loadSavedInstance(root, address, noopLogger)).toEqual({
    success: false,
    diagnostics: [
      {
        document,
        code: 'INVALID_JSON',
        pointer: '',
        message: 'Provide a file containing valid JSON.',
      },
    ],
  });
  expect(await readFile(path.join(root, document))).toEqual(bytes);
});

test('keeps the validated address when a caller reuses the request object', async () => {
  const { address, sheet } = await saveExample('explorator');
  const { address: nextAddress } = await saveExample('ork-freebooter');
  const pending = loadSavedInstance(root, address, noopLogger);
  Object.assign(address, nextAddress);
  expect(await pending).toMatchObject({ success: true, value: { mode: 'editable', sheet } });
});

test('validates address and sheet identity before looking up definitions', async () => {
  const { address, document, sheet } = await saveExample('explorator');
  await rm(path.join(root, manifest));
  expect(
    await loadSavedInstance(root, { ...address, instanceId: '../other' }, noopLogger),
  ).toMatchObject({
    success: false,
    diagnostics: [{ pointer: '/instanceId', code: 'INVALID_STRUCTURE' }],
  });
  await put(
    document,
    JSON.stringify({
      ...sheet,
      id: 'different',
      role: 'monster',
      system: { ...sheet.system, id: 'other' },
    }),
  );
  expect(await loadSavedInstance(root, address, noopLogger)).toMatchObject({
    success: false,
    diagnostics: [
      { document, pointer: '/id', code: 'IDENTITY_MISMATCH' },
      { document, pointer: '/role', code: 'IDENTITY_MISMATCH' },
      { document, pointer: '/system/id', code: 'IDENTITY_MISMATCH' },
    ],
  });
});

test('rejects a linked instance directory', async () => {
  const { address, document } = await saveExample('explorator');
  const directory = path.dirname(path.join(root, document));
  const destination = path.join(root, 'elsewhere');
  await rename(directory, destination);
  await symlink(destination, directory, 'junction');
  expect(await loadSavedInstance(root, address, noopLogger)).toMatchObject({
    success: false,
    diagnostics: [
      {
        document,
        code: 'INVALID_VALUE',
        message: 'Use ordinary files and directories inside the library.',
      },
    ],
  });
});

test('rejects the wrong on-disk filename casing', async () => {
  const { address, document } = await saveExample('explorator');
  const file = path.join(root, document);
  const temporary = file + '.away';
  await rename(file, temporary);
  await rename(temporary, path.join(path.dirname(file), path.basename(file).toUpperCase()));
  expect(await loadSavedInstance(root, address, noopLogger)).toMatchObject({
    success: false,
    diagnostics: [{ document, code: 'INVALID_VALUE' }],
  });
});

test('rejects incompatibilities in an independently valid snapshot', async () => {
  const { address, document, sheet } = await saveExample('ork-freebooter');
  sheet.entityType = 'ship';
  sheet.values.toughness = 100;
  sheet.presentation.sections.reverse();
  sheet.presentation.fields.toughness.label = 'Health';
  sheet.entries[0].effects[0].target = 'agilityBonus';
  const bytes = Buffer.from(JSON.stringify(sheet));
  await put(document, bytes);
  expect(await loadSavedInstance(root, address, noopLogger)).toMatchObject({
    success: false,
    diagnostics: [
      { pointer: '/entityType', code: 'IDENTITY_MISMATCH' },
      { pointer: '/values/toughness', code: 'INVALID_VALUE' },
      { pointer: '/presentation/sections', code: 'INVALID_SECTION' },
      { pointer: '/presentation/fields/toughness', code: 'INVALID_VALUE' },
      { pointer: '/entries/0/effects/0/target', code: 'INVALID_MODIFIER' },
    ],
  });
  expect(await readFile(path.join(root, document))).toEqual(bytes);
});

test('writes correlated checkpoints and outcomes at the default info threshold', async () => {
  const { address, document, sheet } = await saveExample('ork-freebooter');
  const directory = path.join(root, 'logs');
  const logger = new LogService({
    directory,
    metadata: {
      buildId: 'test',
      appVersion: 'test',
      electron: 'test',
      chrome: 'test',
      node: 'test',
    },
  });
  try {
    await loadSavedInstance(root, address, logger);
    await rm(path.join(root, manifest));
    await loadSavedInstance(root, address, logger);
    await put(document, '{"schemaVersion":1}');
    await loadSavedInstance(root, address, logger);
  } finally {
    await logger.close();
  }
  const log = await readFile(path.join(directory, 'application.jsonl'), 'utf8');
  const records = log
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(records.map(({ event, level, reason }) => [event, level, reason])).toEqual([
    ['instance.load.started', 'info', undefined],
    ['instance.snapshot.validated', 'info', undefined],
    ['instance.load.opened', 'info', undefined],
    ['instance.load.started', 'info', undefined],
    ['instance.snapshot.validated', 'info', undefined],
    ['instance.load.readonly', 'warn', 'DEFINITION_NOT_FOUND'],
    ['instance.load.started', 'info', undefined],
    ['instance.snapshot.invalid', 'warn', 'UNSUPPORTED_SCHEMA_VERSION'],
  ]);
  const ids = records.map(({ operationId }) => operationId);
  expect(ids).toEqual([ids[0], ids[0], ids[0], ids[3], ids[3], ids[3], ids[6], ids[6]]);
  expect(new Set(ids).size).toBe(3);
  for (const privateValue of [document, systemId, sheet.id, sheet.displayName])
    expect(log).not.toContain(privateValue);
});

test('a failing logger preserves successful and rejected load results', async () => {
  const { address, document } = await saveExample('explorator');
  const logger = {
    // Simulate an unavailable log sink.
    record() {
      throw new Error('sink unavailable');
    },
  };
  expect(await loadSavedInstance(root, address, logger)).toMatchObject({
    success: true,
    value: { mode: 'editable' },
  });
  await put(document, '{"schemaVersion":1}');
  expect(await loadSavedInstance(root, address, logger)).toMatchObject({
    success: false,
    diagnostics: [{ code: 'UNSUPPORTED_SCHEMA_VERSION' }],
  });
});

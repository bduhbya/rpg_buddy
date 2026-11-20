import {
  readAuthoredDefinitions,
  seedAuthoredDefinitions,
} from '../../fixtures/rogue-trader-definitions';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Instance, Template } from '../../../src/domain/definitions/document-models';
import { loadSavedInstance } from '../../../src/main/instance-loader';
import { saveInstance } from '../../../src/main/instance-saver';
import { noopLogger } from '../../../src/shared/logging-contract';
import type { LogInput } from '../../../src/shared/logging-contract';

vi.mock('node:fs/promises', { spy: true });

const definitions = readAuthoredDefinitions();
const fixtures = definitions.root;
let system: string;
let manifest: string;
let template: string;
let root: string;
let sheet: Instance;
let directory: string;
let target: string;
let backup: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), 'rpg-buddy-save-'));
  ({ system, manifest, template } = await seedAuthoredDefinitions(root, definitions));
  sheet = JSON.parse(await fs.readFile(new URL('explorator.instance.json', fixtures), 'utf8'));
  directory = path.join(root, system, 'characters');
  target = path.join(directory, sheet.id + '.json');
  backup = target + '.bak';
});

afterEach(async () => {
  vi.resetAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

test.each(['explorator', 'ork-freebooter'])(
  'round-trips the complete %s snapshot without calculating',
  async (name) => {
    const snapshot: Instance = JSON.parse(
      await fs.readFile(new URL(name + '.instance.json', fixtures), 'utf8'),
    );
    const definitionPath = path.join(root, template);
    const definition: Template = JSON.parse(await fs.readFile(definitionPath, 'utf8'));
    // This passes static validation but fails if either persistence operation evaluates it.
    definition.derived[0].expression = {
      op: 'divide',
      left: { op: 'constant', value: 1 },
      right: { op: 'constant', value: 0 },
    };
    await fs.writeFile(definitionPath, JSON.stringify(definition));

    if (snapshot.role === 'character') {
      // Add a test-only effect because the character fixture has no stored modifiers.
      snapshot.entries.push({
        id: 'test-strength',
        category: 'trait',
        label: 'Test strength modifier',
        description: '',
        effects: [{ op: 'multiply', target: 'strengthBonus', factor: 2 }],
      });
      snapshot.derived.strengthBonus *= 2;
    }
    expect(snapshot.entries.some(({ effects }) => effects.length > 0)).toBe(true);
    expect(await saveInstance(root, snapshot, noopLogger)).toEqual({
      success: true,
      value: snapshot,
    });
    const address = { systemId: snapshot.system.id, role: snapshot.role, instanceId: snapshot.id };
    const opened = await loadSavedInstance(root, address, noopLogger);
    expect(opened).toMatchObject({
      success: true,
      value: { mode: 'editable' },
    });
    expect(opened.success && opened.value.sheet).toEqual(snapshot);
  },
);

test('rehearses manual backup recovery after an interrupted save', async () => {
  expect(await saveInstance(root, sheet, noopLogger)).toMatchObject({ success: true });
  const original = await fs.readFile(target);
  const revised = { ...sheet, displayName: 'Newer revision' };
  expect(await saveInstance(root, revised, noopLogger)).toMatchObject({ success: true });

  // Simulate a damaged primary and artifacts left behind by an interrupted writer.
  const lock = target + '.lock';
  const leftover = target + '.00000000-0000-4000-8000-000000000000.tmp';
  await fs.writeFile(target, '{incomplete');
  await fs.writeFile(lock, '');
  await fs.writeFile(leftover, '{staged');
  expect(await saveInstance(root, revised, noopLogger)).toMatchObject({ success: false });
  const address = { systemId: sheet.system.id, role: sheet.role, instanceId: sheet.id };
  expect(await loadSavedInstance(root, address, noopLogger)).toMatchObject({ success: false });

  // Preserve the artifacts outside the library, then copy the backup into the canonical path.
  const evidence = await fs.mkdtemp(path.join(tmpdir(), 'rpg-buddy-recovery-'));
  try {
    for (const file of [target, backup, lock, leftover]) {
      await fs.copyFile(file, path.join(evidence, path.basename(file)));
    }
    await fs.rename(target, path.join(evidence, 'damaged-primary.json'));
    await fs.copyFile(backup, target);
    await fs.unlink(lock);
    await fs.unlink(leftover);

    const opened = await loadSavedInstance(root, address, noopLogger);
    expect(opened).toMatchObject({ success: true, value: { mode: 'editable' } });
    expect(opened.success && opened.value.sheet).toEqual(sheet);
    expect(await fs.readFile(target)).toEqual(original);
    expect(await fs.readFile(backup)).toEqual(original);
    expect(await saveInstance(root, revised, noopLogger)).toMatchObject({ success: true });
  } finally {
    await fs.rm(evidence, { recursive: true, force: true });
  }
});

test('creates the canonical role directory and preserves the prior bytes on overwrite', async () => {
  const pending = saveInstance(root, sheet, noopLogger);
  const edited = { ...sheet, displayName: 'Revised' };
  sheet.displayName = 'Changed after invocation';
  expect(await pending).toMatchObject({ success: true });
  expect(await fs.readdir(directory)).toEqual([path.basename(target)]);
  const first = JSON.parse(await fs.readFile(target, 'utf8'));
  expect(first.displayName).not.toBe(sheet.displayName);

  const prior = Buffer.from(JSON.stringify(first) + '\r\n\r\n');
  await fs.writeFile(target, prior);
  expect(await saveInstance(root, edited, noopLogger)).toEqual({ success: true, value: edited });
  expect(await fs.readFile(backup)).toEqual(prior);
  const second = await fs.readFile(target);
  expect(JSON.parse(second.toString())).toEqual(edited);

  expect(await saveInstance(root, first, noopLogger)).toMatchObject({ success: true });
  expect(await fs.readFile(backup)).toEqual(second);
  expect(new Set(await fs.readdir(directory))).toEqual(
    new Set([path.basename(target), path.basename(backup)]),
  );
});

test('rejects malformed snapshots and missing exact definitions before creating a target', async () => {
  expect(await saveInstance(root, { ...sheet, id: '../outside' }, noopLogger)).toMatchObject({
    success: false,
    diagnostics: [{ pointer: '/id' }],
  });
  await fs.unlink(path.join(root, manifest));
  expect(await saveInstance(root, sheet, noopLogger)).toMatchObject({
    success: false,
    diagnostics: [{ code: 'DEFINITION_NOT_FOUND' }],
  });
  await expect(fs.lstat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('rejects a template-incompatible snapshot before creating a target', async () => {
  const changed = { ...sheet, entityType: 'other' };
  expect(await saveInstance(root, changed, noopLogger)).toMatchObject({
    success: false,
    diagnostics: [{ code: 'IDENTITY_MISMATCH', pointer: '/entityType' }],
  });
  await expect(fs.lstat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('preserves a malformed primary, a colliding identity and a backup-only state', async () => {
  await fs.mkdir(directory);
  await fs.writeFile(target, '{bad');
  expect(await saveInstance(root, sheet, noopLogger)).toMatchObject({
    success: false,
    diagnostics: [{ code: 'INVALID_JSON' }],
  });
  expect(await fs.readFile(target, 'utf8')).toBe('{bad');
  const collision = JSON.stringify({ ...sheet, createdAt: '2000-01-01T00:00:00Z' });
  await fs.writeFile(target, collision);
  expect(await saveInstance(root, sheet, noopLogger)).toMatchObject({
    success: false,
    diagnostics: [{ code: 'IDENTITY_MISMATCH' }],
  });
  expect(await fs.readFile(target, 'utf8')).toBe(collision);
  await fs.rename(target, backup);
  expect(await saveInstance(root, sheet, noopLogger)).toMatchObject({ success: false });
  expect(await fs.readFile(backup, 'utf8')).toBe(collision);
  await expect(fs.lstat(target)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('rejects a linked role directory on filesystems that support junctions', async ({ skip }) => {
  const redirected = path.join(root, 'redirected');
  await fs.mkdir(redirected);
  try {
    await fs.symlink(redirected, directory, 'junction');
  } catch (error) {
    // Windows reports EISDIR when trying to create this junction on FAT32.
    if (process.platform === 'win32' && (error as NodeJS.ErrnoException).code === 'EISDIR') {
      skip(true, 'The test volume does not support the junction fixture.');
      return;
    }
    throw error;
  }
  expect(await saveInstance(root, sheet, noopLogger)).toMatchObject({ success: false });
  expect(await fs.readdir(redirected)).toEqual([]);
  await fs.unlink(directory);
});

test('rejects non-file primary or backup paths', async () => {
  await fs.mkdir(directory);
  await fs.mkdir(target);
  expect(await saveInstance(root, sheet, noopLogger)).toMatchObject({ success: false });
  await fs.rmdir(target);
  await fs.mkdir(backup);
  expect(await saveInstance(root, sheet, noopLogger)).toMatchObject({ success: false });
});

test('rejects an existing writer lock without removing it', async () => {
  await fs.mkdir(directory);
  const lockPath = target + '.lock';
  await fs.writeFile(lockPath, 'held');
  expect(await saveInstance(root, sheet, noopLogger)).toMatchObject({ success: false });
  expect(await fs.readFile(lockPath, 'utf8')).toBe('held');
});

test('a second save cannot publish while the first holds the lock', async () => {
  const { rename } = await vi.importActual<typeof fs>('node:fs/promises');
  let announcePublication!: () => void;
  const publishing = new Promise<void>((resolve) => {
    announcePublication = resolve;
  });
  let resumePublication!: () => void;
  const resume = new Promise<void>((resolve) => {
    resumePublication = resolve;
  });
  vi.mocked(fs.rename).mockImplementationOnce(async (...args) => {
    announcePublication();
    await resume;
    await rename(...args);
  });
  const first = saveInstance(root, sheet, noopLogger);
  await Promise.race([publishing, first]);
  try {
    expect(
      await saveInstance(root, { ...sheet, displayName: 'Competing save' }, noopLogger),
    ).toMatchObject({
      success: false,
      diagnostics: [{ message: expect.stringContaining('in progress') }],
    });
    await expect(fs.lstat(target)).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    resumePublication();
    await first;
  }
  expect(JSON.parse(await fs.readFile(target, 'utf8'))).toEqual(sheet);
  await expect(fs.lstat(target + '.lock')).rejects.toMatchObject({ code: 'ENOENT' });
});

test('a failed first publication leaves no partial sheet and allows a retry', async () => {
  vi.mocked(fs.rename).mockRejectedValueOnce(new Error('injected first rename failure'));
  expect(await saveInstance(root, sheet, noopLogger)).toMatchObject({ success: false });
  expect(await fs.readdir(directory)).toEqual([]);
  expect(await saveInstance(root, sheet, noopLogger)).toEqual({ success: true, value: sheet });
});

test('a failed staging write leaves the existing revisions intact', async () => {
  const prior = JSON.stringify(sheet);
  await fs.mkdir(directory);
  await fs.writeFile(target, prior);
  await fs.writeFile(backup, prior);
  const openFile = fs.open;
  const actual = await vi.importActual<typeof fs>('node:fs/promises');
  vi.mocked(openFile)
    .mockImplementationOnce(actual.open)
    .mockImplementationOnce(async (...args) => {
      const handle = await actual.open(...args);
      vi.spyOn(handle, 'writeFile').mockRejectedValueOnce(new Error('injected write failure'));
      return handle;
    });

  expect(await saveInstance(root, { ...sheet, displayName: 'Revised' }, noopLogger)).toMatchObject({
    success: false,
  });
  expect(await fs.readFile(target, 'utf8')).toBe(prior);
  expect(await fs.readFile(backup, 'utf8')).toBe(prior);
  expect(new Set(await fs.readdir(directory))).toEqual(
    new Set([path.basename(target), path.basename(backup)]),
  );
});

test('failed backup and primary replacements leave recoverable revisions and allow retry', async () => {
  const original = JSON.stringify(sheet);
  const current = JSON.stringify({ ...sheet, displayName: 'Current' });
  const edited = { ...sheet, displayName: 'Revised' };
  await fs.mkdir(directory);
  await fs.writeFile(target, current);
  await fs.writeFile(backup, original);

  vi.mocked(fs.rename).mockRejectedValueOnce(new Error('injected backup replacement failure'));
  expect(await saveInstance(root, edited, noopLogger)).toMatchObject({ success: false });
  expect(await fs.readFile(target, 'utf8')).toBe(current);
  expect(await fs.readFile(backup, 'utf8')).toBe(original);

  const { rename } = await vi.importActual<typeof fs>('node:fs/promises');
  vi.mocked(fs.rename)
    .mockImplementationOnce(rename)
    .mockRejectedValueOnce(new Error('injected primary replacement failure'));
  expect(await saveInstance(root, edited, noopLogger)).toMatchObject({ success: false });
  expect(await fs.readFile(target, 'utf8')).toBe(current);
  expect(await fs.readFile(backup, 'utf8')).toBe(current);
  expect(new Set(await fs.readdir(directory))).toEqual(
    new Set([path.basename(target), path.basename(backup)]),
  );
  expect(await saveInstance(root, edited, noopLogger)).toEqual({ success: true, value: edited });
});

test('records correlated, sanitized terminal results even with a throwing sink', async () => {
  const events: LogInput[] = [];
  const logger = {
    record(event: LogInput) {
      events.push(event);
      throw new Error('injected logging failure');
    },
  };
  expect(await saveInstance(root, sheet, logger)).toMatchObject({ success: true });
  const success = events.splice(0);
  vi.mocked(fs.rename).mockRejectedValueOnce(new Error('private OS failure at ' + target));
  expect(await saveInstance(root, sheet, logger)).toMatchObject({ success: false });

  const operationId = expect.any(String);
  expect(success.at(-1)).toMatchObject({
    event: 'instance.save',
    operationId,
    step: 'sheet.save',
    outcome: 'succeeded',
    level: 'info',
  });
  expect(events.at(-1)).toMatchObject({
    event: 'instance.save',
    operationId,
    step: 'backup.publish',
    outcome: 'failed',
    reason: 'SAVE_IO_FAILED',
    level: 'error',
  });
  for (const operation of [success, events]) {
    expect(new Set(operation.map((event) => event.operationId)).size).toBe(1);
    expect(JSON.stringify(operation)).not.toContain(sheet.id);
    expect(JSON.stringify(operation)).not.toContain(sheet.displayName);
    expect(JSON.stringify(operation)).not.toContain('private OS failure');
  }
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadActiveSystem, loadExactDefinitions } from '../../../src/main/definition-loader';
import { LogService } from '../../../src/main/logging';
import type { SystemManifest, Template } from '../../../src/domain/definitions/document-models';

vi.mock('node:fs/promises', { spy: true });

const systemId = 'rogue-trader';
const selected = 'RPG_systems/' + systemId;
const activePath = selected + '/system.json';
const version = '1.0.1';
// Locate the selected system's manifest archive for a fixture revision.
const archivedPath = (revision: string) => selected + '/manifests/' + revision + '/system.json';
// Locate the creature template fixture for a specific revision.
const templatePath = (revision: string) =>
  selected + '/templates/creature-core/' + revision + '/template.json';
// Build an exact request for fixtures whose manifest and template share a revision.
const request = (revision: string) => ({
  system: { id: systemId, version: revision },
  template: { id: 'creature-core', version: revision },
});
const other = 'RPG_systems/other-system/system.json';
let temp: string;
let root: string;

// Map a fixture's library-relative path to the current test library.
function file(document: string): string {
  return path.join(root, document);
}

// Create or replace a fixture, including cases with deliberately invalid bytes.
async function write(document: string, value: string | Uint8Array) {
  await fs.mkdir(path.dirname(file(document)), { recursive: true });
  await fs.writeFile(file(document), value);
}

// Normalize recorded payload reads to library-relative paths for assertions.
function reads(): string[] {
  return vi
    .mocked(fs.readFile)
    .mock.calls.map(([name]) => path.relative(root, String(name)).split(path.sep).join('/'));
}

// Copy the seed so each test can alter definitions without affecting the repository or other tests.
beforeEach(async () => {
  temp = await fs.mkdtemp(path.join(tmpdir(), 'rpg-buddy-definitions-'));
  root = await fs.realpath(temp);
  await fs.cp(path.resolve('runtime-library', 'RPG_systems'), file('RPG_systems'), {
    recursive: true,
  });
  vi.clearAllMocks();
});

// Remove the disposable library after the test finishes.
afterEach(async () => {
  await fs.rm(temp, { recursive: true, force: true });
});

describe('main-process definition loader', () => {
  it('rejects a template whose filename uses different capitalization', async () => {
    const document = templatePath(version);
    const original = file(document);
    const temporary = path.join(path.dirname(original), 'rename.json');
    const wrongCase = path.join(path.dirname(original), 'Template.JSON');
    // Rename through a distinct name so Windows updates the directory entry's casing.
    await fs.rename(original, temporary);
    await fs.rename(temporary, wrongCase);
    for (const result of [
      await loadActiveSystem(root, systemId),
      await loadExactDefinitions(root, request(version)),
    ]) {
      expect(result).toMatchObject({
        success: false,
        diagnostics: [{ code: 'DEFINITION_NOT_FOUND', document }],
      });
    }
  });

  it('loads long acyclic dependencies between shallow formulas', async () => {
    const document = templatePath(version);
    const template: Template = JSON.parse(await fs.readFile(file(document), 'utf8'));
    const inputIds = template.inputs.map(({ id }) => id);
    const count = 7_000;
    template.derived = Array.from({ length: count }, (_, index) => ({
      ...template.derived[0],
      id: 'field' + index,
      expression: { op: 'field', id: index + 1 === count ? inputIds[0] : 'field' + (index + 1) },
    }));
    template.sections = [
      {
        id: 'all-fields',
        label: 'All fields',
        fields: [...inputIds, ...template.derived.map(({ id }) => id)],
      },
    ];
    template.modifierTargets = [];
    await write(document, JSON.stringify(template));

    expect(await loadActiveSystem(root, systemId)).toMatchObject({ success: true });
    expect(await loadExactDefinitions(root, request(version))).toMatchObject({ success: true });
  });

  it('reports an unsupported schema before validating the current schema shape', async () => {
    const payload = '{"schemaVersion":99,"systemName":"Example"}';
    await write(activePath, payload);
    await write(archivedPath(version), payload);
    for (const [result, document] of [
      [await loadActiveSystem(root, systemId), activePath],
      [await loadExactDefinitions(root, request(version)), archivedPath(version)],
    ] as const) {
      expect(result).toMatchObject({
        success: false,
        diagnostics: [{ code: 'UNSUPPORTED_SCHEMA_VERSION', document, pointer: '/schemaVersion' }],
      });
    }
  });

  it('writes correlated product logs for both load paths without definition data', async () => {
    const profile = await fs.mkdtemp(path.join(tmpdir(), 'rpg-buddy-log-profile-'));
    const logDirectory = path.join(profile, 'logs');
    const logger = new LogService({
      directory: logDirectory,
      metadata: {
        buildId: 'test-build',
        appVersion: 'test-version',
        electron: 'test-electron',
        chrome: 'test-chrome',
        node: process.versions.node,
      },
      debug: true,
    });

    try {
      expect(await loadActiveSystem(root, systemId, logger)).toMatchObject({ success: true });
      expect(await loadExactDefinitions(root, request(version), logger)).toMatchObject({
        success: true,
      });
      await write(templatePath(version), '{"privateProperty": 1, "privateProperty": 2}');
      expect(await loadExactDefinitions(root, request(version), logger)).toMatchObject({
        success: false,
      });
      await logger.close();

      const log = await fs.readFile(path.join(logDirectory, 'application.jsonl'), 'utf8');
      const records = log
        .trimEnd()
        .split('\n')
        .map((line) => JSON.parse(line));
      const expectedEvents = [
        ['library.definitions.active', 'definitions.load', 'started', 'debug'],
        ['library.definitions.active', 'manifest.read', 'succeeded', 'debug'],
        ['library.definitions.active', 'archive.read', 'succeeded', 'debug'],
        ['library.definitions.active', 'templates.read', 'succeeded', 'debug'],
        ['library.definitions.active', 'definitions.load', 'succeeded', 'info'],
        ['library.definitions.exact', 'definitions.load', 'started', 'debug'],
        ['library.definitions.exact', 'archive.read', 'succeeded', 'debug'],
        ['library.definitions.exact', 'template.read', 'succeeded', 'debug'],
        ['library.definitions.exact', 'definitions.load', 'succeeded', 'info'],
        ['library.definitions.exact', 'definitions.load', 'started', 'debug'],
        ['library.definitions.exact', 'archive.read', 'succeeded', 'debug'],
        ['library.definitions.exact', 'template.read', 'rejected', 'warn'],
      ];
      expect(
        records.map(({ event, step, outcome, level }) => [event, step, outcome, level]),
      ).toEqual(expectedEvents);
      expect(records.at(-1)).toMatchObject({ reason: 'INVALID_JSON' });
      expect(
        records.every(
          ({ sessionId, source }) => sessionId === logger.sessionId && source === 'main',
        ),
      ).toBe(true);
      const operations = [records.slice(0, 5), records.slice(5, 9), records.slice(9)];
      const operationIds = operations.map((events) => {
        const ids = new Set(events.map(({ operationId }) => operationId));
        expect(ids.size).toBe(1);
        return events[0].operationId;
      });
      expect(new Set(operationIds).size).toBe(3);
      expect(log).not.toContain(JSON.stringify(root).slice(1, -1));
      expect(log).not.toContain(systemId);
      expect(log).not.toContain('privateProperty');
    } finally {
      await logger.close();
      await fs.rm(profile, { recursive: true, force: true });
    }
  });

  it('preserves loader results when the logging sink throws', async () => {
    const logger = {
      record: vi.fn(() => {
        throw new Error('Log sink unavailable');
      }),
    };

    expect(await loadExactDefinitions(root, request(version), logger)).toMatchObject({
      success: true,
    });
    expect(await loadActiveSystem(root, 'missing-system', logger)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DEFINITION_NOT_FOUND' }],
    });
    expect(logger.record).toHaveBeenCalledTimes(6);
  });

  it('reads only the selected definition payloads and leaves library files intact', async () => {
    await write(other, '{invalid');
    const documents = [activePath, archivedPath(version), templatePath(version), other];
    const before = await Promise.all(documents.map((document) => fs.readFile(file(document))));
    vi.clearAllMocks();

    const result = await loadActiveSystem(root, systemId);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(reads()).toEqual(documents.slice(0, 3));
    expect(result.value.manifest).toMatchObject({ id: systemId, version });
    const location = { document: 'test', pointer: '' };
    expect(
      result.value.catalog.getTemplate(systemId, request(version).template, location),
    ).toMatchObject({
      success: true,
      value: { document: templatePath(version) },
    });
    expect(result.value.catalog.getSystem({ id: 'other-system', version }, location)).toMatchObject(
      {
        success: false,
        diagnostics: [{ code: 'DEFINITION_NOT_FOUND' }],
      },
    );
    expect(await Promise.all(documents.map((document) => fs.readFile(file(document))))).toEqual(
      before,
    );
  });

  it('reads an older exact pair without reading the active manifest or other templates', async () => {
    const old = '1.0.0';
    const manifest: SystemManifest = JSON.parse(await fs.readFile(file(activePath), 'utf8'));
    const template: Template = JSON.parse(await fs.readFile(file(templatePath(version)), 'utf8'));
    manifest.version = old;
    manifest.templates = [
      { id: template.id, version: old },
      { id: 'missing-template', version: old },
    ];
    template.version = old;
    template.system.version = old;
    await write(archivedPath(old), JSON.stringify(manifest));
    await write(templatePath(old), JSON.stringify(template));
    vi.clearAllMocks();

    expect(await loadExactDefinitions(root, request(old))).toMatchObject({
      success: true,
      value: {
        system: { document: archivedPath(old), value: { version: old } },
        template: { document: templatePath(old), value: { version: old } },
      },
    });
    expect(reads()).toEqual([archivedPath(old), templatePath(old)]);
  });

  it('fails a missing exact archive without falling back and can retry after restoration', async () => {
    const archive = await fs.readFile(file(archivedPath(version)));
    await fs.unlink(file(archivedPath(version)));
    vi.clearAllMocks();

    expect(await loadExactDefinitions(root, request(version))).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DEFINITION_NOT_FOUND', document: archivedPath(version) }],
    });
    expect(reads()).toEqual([]);
    expect(await loadActiveSystem(root, systemId)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DEFINITION_NOT_FOUND', document: archivedPath(version) }],
    });
    await write(archivedPath(version), archive);
    expect(await loadActiveSystem(root, systemId)).toMatchObject({ success: true });
  });

  it('identifies the repeated property in a malformed definition', async () => {
    await write(activePath, '{"source":{"id":1,"\\u0069d":2}}');

    expect(await loadActiveSystem(root, systemId)).toMatchObject({
      success: false,
      diagnostics: [
        {
          code: 'INVALID_JSON',
          document: activePath,
          message: expect.stringContaining(
            'This file is malformed. The property "id" appears more than once',
          ),
        },
      ],
    });
    expect(reads()).toEqual([activePath]);
  });

  it.each([
    ['malformed syntax', '{', 'INVALID_JSON', ''],
    ['invalid UTF-8', Uint8Array.of(0xc3, 0x28), 'INVALID_JSON', ''],
    ['unsupported schema', '{"schemaVersion":1}', 'UNSUPPORTED_SCHEMA_VERSION', '/schemaVersion'],
  ] as const)('rejects %s in the selected manifest', async (_, bytes, code, pointer) => {
    await write(activePath, bytes);

    expect(await loadActiveSystem(root, systemId)).toMatchObject({
      success: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code, pointer, document: activePath }),
      ]),
    });
    expect(reads()).toEqual([activePath]);
  });

  it('rejects conflicting active and archived contents before reading templates', async () => {
    const manifest: SystemManifest = JSON.parse(await fs.readFile(file(activePath), 'utf8'));
    await write(
      archivedPath(version),
      JSON.stringify({ ...manifest, label: 'Conflicting archive' }),
    );
    vi.clearAllMocks();

    expect(await loadActiveSystem(root, systemId)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DEFINITION_CONFLICT', document: archivedPath(version) }],
    });
    expect(reads()).toEqual([activePath, archivedPath(version)]);
  });

  it('rejects a manifest with the wrong canonical system ID', async () => {
    const manifest: SystemManifest = JSON.parse(await fs.readFile(file(activePath), 'utf8'));
    await write(activePath, JSON.stringify({ ...manifest, id: 'another-system' }));

    expect(await loadActiveSystem(root, systemId)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'IDENTITY_MISMATCH', document: activePath, pointer: '/id' }],
    });
  });

  it('requires the exact template to appear in the archived manifest before reading it', async () => {
    const unlisted = request(version);
    unlisted.template.id = 'not-listed';

    expect(await loadExactDefinitions(root, unlisted)).toMatchObject({
      success: false,
      diagnostics: [
        { code: 'IDENTITY_MISMATCH', document: archivedPath(version), pointer: '/templates' },
      ],
    });
    expect(reads()).toEqual([archivedPath(version)]);
  });

  it('reports a missing template required by the active manifest', async () => {
    await fs.unlink(file(templatePath(version)));

    expect(await loadActiveSystem(root, systemId)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DEFINITION_NOT_FOUND', document: templatePath(version) }],
    });
  });

  it('rejects a template whose system version disagrees with the manifest', async () => {
    const template: Template = JSON.parse(await fs.readFile(file(templatePath(version)), 'utf8'));
    template.system.version = '9.0.0';
    await write(templatePath(version), JSON.stringify(template));

    for (const result of [
      await loadActiveSystem(root, systemId),
      await loadExactDefinitions(root, request(version)),
    ]) {
      expect(result).toMatchObject({
        success: false,
        diagnostics: [
          { code: 'IDENTITY_MISMATCH', document: templatePath(version), pointer: '/system' },
        ],
      });
    }
  });

  it.each([
    [{ op: 'field', id: 'missingField' }, 'MISSING_REFERENCE'],
    [
      { op: 'equal', left: { op: 'constant', value: 1 }, right: { op: 'constant', value: 1 } },
      'TYPE_MISMATCH',
    ],
  ] as const)(
    'rejects invalid expression semantics during definition loading',
    async (expression, code) => {
      const template: Template = JSON.parse(await fs.readFile(file(templatePath(version)), 'utf8'));
      template.derived[0].expression = expression;
      await write(templatePath(version), JSON.stringify(template));

      expect(await loadActiveSystem(root, systemId)).toMatchObject({
        success: false,
        diagnostics: [
          {
            code,
            document: templatePath(version),
            pointer: expect.stringContaining('/derived/0/expression'),
          },
        ],
      });
    },
  );

  it.each([
    { floors: 127, accepted: true },
    { floors: 128, accepted: false },
    { floors: 1_500, accepted: false },
  ])('handles $floors nested floor operations in both loaders', async ({ floors, accepted }) => {
    const document = templatePath(version);
    const template: Template = JSON.parse(await fs.readFile(file(document), 'utf8'));
    template.derived[0].expression = { op: 'constant', value: 0 };
    const leaf = JSON.stringify(template.derived[0].expression);
    // Build the deep fixture as text so setup does not need to stringify a deep object.
    const expression = '{"op":"floor","value":'.repeat(floors) + leaf + '}'.repeat(floors);
    await write(document, JSON.stringify(template).replace(leaf, expression));

    for (const result of [
      await loadActiveSystem(root, systemId),
      await loadExactDefinitions(root, request(version)),
    ]) {
      if (accepted) {
        expect(result).toMatchObject({ success: true });
      } else {
        expect(result).toMatchObject({
          success: false,
          diagnostics: [
            {
              code: 'INVALID_VALUE',
              document,
              pointer: '/derived/0/expression' + '/value'.repeat(128),
              message: expect.stringContaining(
                'This formula is too deeply nested. Simplify it to at most 128 expression levels',
              ),
            },
          ],
        });
      }
    }
  });

  it('accepts a valid expression that would fail if evaluated', async () => {
    const template: Template = JSON.parse(await fs.readFile(file(templatePath(version)), 'utf8'));
    template.derived[0].expression = {
      op: 'divide',
      left: { op: 'constant', value: 1 },
      right: { op: 'constant', value: 0 },
    };
    await write(templatePath(version), JSON.stringify(template));

    expect(await loadExactDefinitions(root, request(version))).toMatchObject({ success: true });
  });

  it('rejects an unsupported exact archive without substituting the active revision', async () => {
    const archive: SystemManifest = JSON.parse(
      await fs.readFile(file(archivedPath(version)), 'utf8'),
    );
    await write(
      archivedPath('1.0.0'),
      JSON.stringify({ ...archive, version: '1.0.0', schemaVersion: 1 }),
    );
    vi.clearAllMocks();

    expect(await loadExactDefinitions(root, request('1.0.0'))).toMatchObject({
      success: false,
      diagnostics: [
        {
          code: 'UNSUPPORTED_SCHEMA_VERSION',
          document: archivedPath('1.0.0'),
          pointer: '/schemaVersion',
        },
      ],
    });
    expect(reads()).toEqual([archivedPath('1.0.0')]);
  });

  it('rejects invalid path identifiers before reading a payload', async () => {
    expect(await loadActiveSystem(root, '../rogue-trader')).toMatchObject({ success: false });
    const invalid = request(version);
    invalid.system.version = '../../1.0.1';
    expect(await loadExactDefinitions(root, invalid)).toMatchObject({ success: false });
    expect(reads()).toEqual([]);
  });

  it('rejects a linked system directory before reading outside the library', async () => {
    const external = await fs.mkdtemp(path.join(tmpdir(), 'rpg-buddy-outside-'));
    try {
      await fs.writeFile(path.join(external, 'system.json'), '{invalid');
      await fs.symlink(external, file('RPG_systems/linked'), 'junction');

      expect(await loadActiveSystem(root, 'linked')).toMatchObject({
        success: false,
        diagnostics: [{ code: 'INVALID_VALUE', document: 'RPG_systems/linked/system.json' }],
      });
      expect(reads()).toEqual([]);
    } finally {
      await fs.rm(external, { recursive: true, force: true });
    }
  });
});

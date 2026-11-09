import { expect, test, vi } from 'vitest';
import { createInstance } from '../../../src/domain/instances/create-instance';
import { createInMemoryDefinitionCatalog } from '../../../src/domain/definition-processing/in-memory-definition-catalog';
import { loadFixtures } from './fixtures';

const timestamp = '2026-11-04T16:30:00.123Z';
const TEST_AGILITY_DEFAULT = 12;

function setup(
  configureTemplate?: (template: ReturnType<typeof loadFixtures>['template']) => void,
) {
  const { manifest, template } = loadFixtures();
  // A nonzero generic default proves creation reads the template, not hardcoded RT defaults.
  const agility = template.inputs.find((field) => field.id === 'agility');
  if (!agility) throw new Error('Expected agility in the test template');
  agility.default = TEST_AGILITY_DEFAULT;
  configureTemplate?.(template);
  const result = createInMemoryDefinitionCatalog(
    [{ document: 'manifest', value: manifest }],
    [{ document: 'template', value: template }],
  );
  if (!result.success) throw new Error('Expected valid catalog');
  const request = {
    system: { ...template.system },
    template: { id: template.id, version: template.version },
    role: 'character' as const,
  };
  let sequence = 0;
  const providers = {
    newId: vi.fn(() => `instance-${++sequence}`),
    now: vi.fn(() => timestamp),
  };
  return { catalog: result.value, request, providers, manifest, template };
}

test.each(['character', 'monster'] as const)(
  'creates a complete %s sheet with template defaults and final results',
  (role) => {
    const data = setup();
    const result = createInstance(
      data.catalog,
      { ...data.request, role },
      data.providers,
      'creation',
    );
    expect(result).toEqual({
      success: true,
      value: {
        schemaVersion: 2,
        id: 'instance-1',
        entityType: 'creature',
        role,
        system: data.request.system,
        template: data.request.template,
        displayName: 'Creature',
        values: {
          weaponSkill: 0,
          ballisticSkill: 0,
          strength: 0,
          toughness: 0,
          agility: TEST_AGILITY_DEFAULT,
          intelligence: 0,
          perception: 0,
          willpower: 0,
          fellowship: 0,
        },
        derived: {
          strengthBonus: 0,
          toughnessBonus: 0,
          agilityBonus: 1,
          halfMove: 1,
          fullMove: 2,
          chargeMove: 3,
          runMove: 6,
        },
        presentation: loadFixtures().character.presentation,
        entries: [],
        createdAt: timestamp,
        modifiedAt: timestamp,
      },
    });
    expect(data.providers.newId).toHaveBeenCalledTimes(1);
    expect(data.providers.now).toHaveBeenCalledTimes(1);
  },
);

test('creates distinct independent state without changing requests, definitions or later creations', () => {
  const data = setup();
  const before = structuredClone({
    request: data.request,
    manifest: data.manifest,
    template: data.template,
  });
  const first = createInstance(data.catalog, data.request, data.providers, 'first');
  const second = createInstance(data.catalog, data.request, data.providers, 'second');
  if (!first.success || !second.success) throw new Error('Expected instances');
  const saved = structuredClone(second.value);
  expect(first.value.id).not.toBe(second.value.id);
  first.value.values.strength = 99;
  first.value.derived.strengthBonus = 9;
  first.value.presentation.fields.strength.label = 'Changed';
  first.value.presentation.sections[0].fields.reverse();
  first.value.system.version = '9.0.0';
  first.value.template.id = 'changed';
  first.value.entries.push({
    id: 'custom',
    category: 'custom',
    label: 'Custom',
    description: '',
    effects: [],
  });
  expect(second.value).toEqual(saved);
  expect({ request: data.request, manifest: data.manifest, template: data.template }).toEqual(
    before,
  );
  const third = createInstance(data.catalog, data.request, data.providers, 'third');
  expect(third).toEqual({ success: true, value: { ...saved, id: 'instance-3' } });
});

test('reports a failed initial calculation without creating a partial sheet or consuming an ID', () => {
  const data = setup((template) => {
    template.derived[0].expression = {
      op: 'divide',
      left: { op: 'constant', value: 1 },
      right: { op: 'field', id: 'strength' },
    };
  });
  const result = createInstance(data.catalog, data.request, data.providers, 'creation');
  expect(result).toMatchObject({
    success: false,
    diagnostics: [{ code: 'DIVISION_BY_ZERO', document: 'template' }],
  });
  expect(result).not.toHaveProperty('value');
  expect(data.providers.newId).not.toHaveBeenCalled();
  expect(data.providers.now).not.toHaveBeenCalled();
});

test.each([
  null,
  {},
  { role: 'npc' },
  { role: null },
  { displayName: 'Override' },
  { 'extra~/key': true },
])('rejects malformed requests before invoking providers: %j', (patch) => {
  const data = setup();
  const request =
    patch === null ? null : Object.keys(patch).length ? { ...data.request, ...patch } : {};
  const before = structuredClone(request);
  const result = createInstance(data.catalog, request, data.providers, 'creation');
  expect(result.success).toBe(false);
  expect(result).not.toHaveProperty('value');
  expect(data.providers.newId).not.toHaveBeenCalled();
  expect(data.providers.now).not.toHaveBeenCalled();
  expect(request).toEqual(before);
});

test.each([
  ['system', 'id', 'missing', 'DEFINITION_NOT_FOUND'],
  ['template', 'version', '9.0.0', 'UNSUPPORTED_DEFINITION_VERSION'],
] as const)('propagates exact resolution failure for %s %s', (kind, key, value, code) => {
  const data = setup();
  data.request[kind][key] = value;
  expect(createInstance(data.catalog, data.request, data.providers, 'creation')).toMatchObject({
    success: false,
    diagnostics: [{ code, document: 'creation', pointer: `/${kind}` }],
  });
  expect(data.providers.newId).not.toHaveBeenCalled();
});

test.each(['', 'UPPER', 'two--parts', 'valid-id\n', 'x'.repeat(65), null, 123])(
  'rejects invalid provider ID %j',
  (id) => {
    const data = setup();
    const result = createInstance(
      data.catalog,
      data.request,
      { ...data.providers, newId: () => id as string },
      'creation',
    );
    expect(result).toMatchObject({
      success: false,
      diagnostics: [{ document: 'creation', pointer: '/id' }],
    });
    expect(result).not.toHaveProperty('value');
    expect(data.providers.now).not.toHaveBeenCalled();
  },
);

test.each([
  '2026-02-29T12:00:00Z',
  '2026-01-01T12:00:00Z\n',
  '2024-02-30T12:00:00Z',
  '2026-04-31T12:00:00Z',
  '2026-13-01T12:00:00Z',
  '2026-01-00T12:00:00Z',
  '2026-01-01T24:00:00Z',
  '2026-01-01T12:60:00Z',
  '2026-01-01T12:00:60Z',
  '2026-01-01T12:00Z',
  '2026-01-01T12:00:00+00:00',
  '',
  null,
  123,
])('rejects invalid provider UTC timestamp %j', (time) => {
  const data = setup();
  const result = createInstance(
    data.catalog,
    data.request,
    { ...data.providers, now: () => time as string },
    'creation',
  );
  expect(result).toMatchObject({
    success: false,
    diagnostics: [{ code: 'INVALID_VALUE', document: 'creation', pointer: '/createdAt' }],
  });
  expect(result).not.toHaveProperty('value');
});

test.each(['2024-02-29T23:59:59Z', '2000-02-29T00:00:00.123456789Z', '0000-02-29T00:00:00Z'])(
  'accepts valid calendar timestamp %s',
  (time) => {
    const data = setup();
    expect(
      createInstance(
        data.catalog,
        data.request,
        { ...data.providers, now: () => time },
        'creation',
      ),
    ).toMatchObject({ success: true, value: { createdAt: time, modifiedAt: time } });
  },
);

test.each(['newId', 'now'] as const)(
  'contains thrown %s failures and recovers without affecting previous state',
  (provider) => {
    const data = setup();
    const first = createInstance(data.catalog, data.request, data.providers, 'first');
    const saved = structuredClone(first);
    const result = createInstance(
      data.catalog,
      data.request,
      {
        ...data.providers,
        [provider]: () => {
          throw new Error('private contents');
        },
      },
      'failure',
    );
    expect(result).toMatchObject({
      success: false,
      diagnostics: [
        {
          code: 'INVALID_VALUE',
          document: 'failure',
          pointer: provider === 'newId' ? '/id' : '/createdAt',
        },
      ],
    });
    expect(result).not.toHaveProperty('value');
    expect(JSON.stringify(result)).not.toContain('private contents');
    expect(first).toEqual(saved);
    expect(createInstance(data.catalog, data.request, data.providers, 'recovery').success).toBe(
      true,
    );
  },
);

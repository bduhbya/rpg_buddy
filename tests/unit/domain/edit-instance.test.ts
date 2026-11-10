import { afterEach, expect, test, vi } from 'vitest';
import * as calculations from '../../../src/domain/calculation/calculate-with-entries';
import { createInMemoryDefinitionCatalog } from '../../../src/domain/definition-processing/in-memory-definition-catalog';
import { editInstance } from '../../../src/domain/instances/edit-instance';
import type { InstanceEditOperation } from '../../../src/domain/instances/edit-instance';
import { loadFixtures } from './fixtures';

const editTime = '2026-11-07T18:00:00Z';
const strengthEntry = {
  id: 'unnatural-strength',
  category: 'trait',
  label: 'Unnatural Strength',
  description: 'Multiply Strength Bonus.',
  effects: [{ op: 'multiply', target: 'strengthBonus', factor: 2 }],
  metadata: { sourceRegisterRefs: ['example'] },
};

afterEach(() => {
  vi.restoreAllMocks();
});

function setup() {
  const { manifest, template, character, monster } = loadFixtures();
  const catalog = createInMemoryDefinitionCatalog(
    [{ document: 'manifest', value: manifest }],
    [{ document: 'template', value: template }],
  );
  if (!catalog.success) throw new Error('Expected valid definitions');
  const clock = { now: vi.fn(() => editTime) };
  return { catalog: catalog.value, character, monster, clock };
}

test('sets one source value and stores effect-aware results in an independent sheet', () => {
  const { catalog, character, monster, clock } = setup();
  const before = structuredClone({ character, monster });

  const result = editInstance(catalog, monster, clock, 'ork', 'set-value', 'toughness', 50);
  if (!result.success) throw new Error('Expected a valid edit');
  const instance = result.value;
  expect(instance).toEqual({
    ...before.monster,
    values: { ...before.monster.values, toughness: 50 },
    derived: { ...before.monster.derived, toughnessBonus: 10 },
    modifiedAt: editTime,
  });
  expect(clock.now).toHaveBeenCalledOnce();

  // Mutate nested results to check that the original source state owns its data.
  const unnaturalToughness = instance.entries.find(({ id }) => id === 'unnatural-toughness');
  const effect = unnaturalToughness?.effects.find(({ target }) => target === 'toughnessBonus');
  const refs = unnaturalToughness?.metadata?.sourceRegisterRefs;
  if (!effect || !refs) throw new Error('Expected the Unnatural Toughness effect and references');
  effect.factor = 3;
  refs.push('extra');
  instance.template.version = '9.0.0';
  instance.values.toughness = 99;
  instance.derived.toughnessBonus = 1;
  instance.presentation.fields.toughness.label = 'Changed';
  expect({ character, monster }).toEqual(before);
});

test('sets the display name and sets or clears career in separate calls', () => {
  const { catalog, character, clock } = setup();
  const calculator = vi.spyOn(calculations, 'calculateWithEntries');
  // A valid recorded result can differ from a fresh evaluation.
  character.derived.halfMove = 91.5;
  const renamed = editInstance(
    catalog,
    character,
    clock,
    'character',
    'set-display-name',
    ' Explorer ',
  );
  if (!renamed.success) throw new Error('Expected a valid name edit');
  expect(renamed.value.displayName).toBe(' Explorer ');
  expect(renamed.value.career).toBe(character.career);

  const hired = editInstance(catalog, renamed.value, clock, 'character', 'set-career', 'Mercenary');
  if (!hired.success) throw new Error('Expected a valid career edit');
  expect(hired.value.career).toBe('Mercenary');

  const cleared = editInstance(catalog, hired.value, clock, 'character', 'set-career', null);
  if (!cleared.success) throw new Error('Expected a valid career removal');
  expect(cleared.value).not.toHaveProperty('career');
  expect(cleared.value.displayName).toBe(' Explorer ');
  expect(cleared.value.derived).toEqual(character.derived);
  expect(cleared.value.derived).toEqual(renamed.value.derived);
  expect(cleared.value.derived).not.toBe(renamed.value.derived);
  expect(clock.now).toHaveBeenCalledTimes(3);
  expect(calculator).not.toHaveBeenCalled();
});

test.each<InstanceEditOperation>([
  ['set-value', 'toughness', 45],
  ['set-display-name', 'Example Ork Freebooter'],
  ['set-career', null],
])('preserves an equivalent %s edit without calculating or reading the clock', (...operation) => {
  const { catalog, monster, clock } = setup();
  const calculator = vi.spyOn(calculations, 'calculateWithEntries');
  const result = editInstance(catalog, monster, clock, 'ork', ...operation);
  expect(result).toEqual({ success: true, value: monster });
  if (!result.success) throw new Error('Expected an equivalent edit');
  expect(result.value).not.toBe(monster);
  expect(calculator).not.toHaveBeenCalled();
  expect(clock.now).not.toHaveBeenCalled();
});

test.each([
  [[], '/operation', 'ork'],
  [['rename', 'Ork'], '/operation', 'ork'],
  [['set-value', 'toughness'], '/operation', 'ork'],
  [['set-value', 'toughness', 50, 'set-career', 'Mercenary'], '/operation', 'ork'],
  [['set-display-name', '   '], '/displayName', 'ork'],
  [['set-career', ''], '/career', 'ork'],
  [['set-career', undefined], '/career', 'ork'],
  [['set-value', null, 50], '/fieldId', 'ork'],
  [['set-value', 'toughness', '50'], '/value', 'ork'],
  [['set-value', 'toughness', 100], '/toughness', 'ork values'],
  [['set-value', 'toughness', 49.5], '/toughness', 'ork values'],
  [['set-value', 'toughnessBonus', 10], '/toughnessBonus', 'ork values'],
  [['set-value', '__proto__', 1], '/__proto__', 'ork values'],
  [['set-value', 'bad~/id', 1], '/bad~0~1id', 'ork values'],
] as const)(
  'rejects invalid operation %j before reading the clock',
  (operation, pointer, document) => {
    const { catalog, monster, clock } = setup();
    const before = structuredClone(monster);
    const result = editInstance(
      catalog,
      monster,
      clock,
      'ork',
      ...(operation as unknown as InstanceEditOperation),
    );

    expect(result).toMatchObject({ success: false, diagnostics: [{ document, pointer }] });
    expect(result).not.toHaveProperty('value');
    expect(monster).toEqual(before);
    expect(clock.now).not.toHaveBeenCalled();
  },
);

test('rejects live objects without triggering proxy traps or coercion', () => {
  const { catalog, monster, clock } = setup();
  const trap = vi.fn(() => {
    throw new Error('A patch object was inspected');
  });
  const oldPatch = new Proxy({ values: { toughness: 50 } }, { get: trap, ownKeys: trap });
  const textObject = new Proxy(new String(JSON.stringify(strengthEntry)), { get: trap });
  const legacyValues = new Map([['toughness', 50]]);
  const iterator = Object.setPrototypeOf(Object.assign([50].values(), { toughness: 50 }), null);

  for (const [operation, pointer] of [
    [[oldPatch, 'unused'], '/operation'],
    [['set-value', 'toughness', legacyValues], '/value'],
    [['set-value', 'toughness', iterator], '/value'],
    [['add-entry', textObject], '/entry'],
  ] as const) {
    const result = editInstance(
      catalog,
      monster,
      clock,
      'ork',
      ...(operation as unknown as InstanceEditOperation),
    );
    expect(result).toMatchObject({ success: false, diagnostics: [{ document: 'ork', pointer }] });
    expect(result).not.toHaveProperty('value');
  }
  expect(trap).not.toHaveBeenCalled();
  expect(clock.now).not.toHaveBeenCalled();
  expect(monster.values.toughness).toBe(45);
});

test('requires the exact template version before calculating or reading the clock', () => {
  const { catalog, monster, clock } = setup();
  monster.template.version = '9.0.0';
  expect(editInstance(catalog, monster, clock, 'ork', 'set-display-name', 'Ork')).toMatchObject({
    success: false,
    diagnostics: [
      { code: 'UNSUPPORTED_DEFINITION_VERSION', document: 'ork', pointer: '/template' },
    ],
  });
  expect(clock.now).not.toHaveBeenCalled();
});

test('preserves the last valid edit on arithmetic failure and can recover', () => {
  const { catalog, monster, clock } = setup();
  // At Toughness 15 the base bonus is 1, so the largest safe factor still fits.
  const lowered = editInstance(catalog, monster, clock, 'ork', 'set-value', 'toughness', 15);
  if (!lowered.success) throw new Error('Expected a valid source edit');
  const unnaturalToughness = structuredClone(lowered.value.entries[0]);
  const effect = unnaturalToughness?.effects.find(({ target }) => target === 'toughnessBonus');
  if (!effect) throw new Error('Expected the Unnatural Toughness effect');
  effect.factor = Number.MAX_SAFE_INTEGER;
  clock.now.mockClear();
  const prior = editInstance(
    catalog,
    lowered.value,
    clock,
    'ork',
    'replace-entry',
    JSON.stringify(unnaturalToughness),
  );
  if (!prior.success) throw new Error('Expected a valid first edit');
  expect(prior.value.derived.toughnessBonus).toBe(Number.MAX_SAFE_INTEGER);
  const before = structuredClone(prior.value);

  // Toughness 20 is a valid source value, but its base bonus of 2 makes the effect overflow.
  const failure = editInstance(catalog, prior.value, clock, 'ork', 'set-value', 'toughness', 20);
  expect(failure).toMatchObject({
    success: false,
    diagnostics: [
      {
        code: 'NONFINITE_RESULT',
        document: 'ork entries',
        pointer: '/0/effects/0/factor',
        related: [{ document: 'template' }],
      },
    ],
  });
  expect(failure).not.toHaveProperty('value');
  expect(prior.value).toEqual(before);
  expect(clock.now).toHaveBeenCalledOnce();

  const recovered = editInstance(catalog, prior.value, clock, 'ork', 'set-value', 'toughness', 19);
  expect(recovered).toMatchObject({
    success: true,
    value: {
      values: { toughness: 19 },
      derived: { toughnessBonus: Number.MAX_SAFE_INTEGER },
    },
  });
  expect(prior.value).toEqual(before);
  expect(clock.now).toHaveBeenCalledTimes(2);
});

test.each([
  '2026-11-07T17:59:59.999Z',
  '2026-11-07T18:00:00.1234567889Z',
  '2026-02-30T18:00:00Z',
  '2026-11-07T18:00:00+00:00',
])('rejects an earlier or malformed clock timestamp %s', (time) => {
  const { catalog, monster, clock } = setup();
  monster.modifiedAt = '2026-11-07T18:00:00.123456789Z';
  clock.now.mockReturnValue(time);
  const result = editInstance(catalog, monster, clock, 'ork', 'set-display-name', 'Ork');
  expect(result).toMatchObject({
    success: false,
    diagnostics: [{ code: 'INVALID_VALUE', document: 'ork', pointer: '/modifiedAt' }],
  });
  expect(result).not.toHaveProperty('value');
  expect(monster.modifiedAt).toBe('2026-11-07T18:00:00.123456789Z');
});

test.each(['2026-11-07T18:00:00.12345678900Z', '2026-11-07T18:00:00.1234567891Z'])(
  'accepts an equal or later clock timestamp %s',
  (time) => {
    const { catalog, monster, clock } = setup();
    monster.modifiedAt = '2026-11-07T18:00:00.123456789Z';
    clock.now.mockReturnValue(time);
    expect(editInstance(catalog, monster, clock, 'ork', 'set-display-name', 'Ork')).toMatchObject({
      success: true,
      value: { modifiedAt: time },
    });
  },
);

test('preserves the complete sheet on a clock exception after calculation and allows retry', () => {
  const { catalog, monster, clock } = setup();
  const before = structuredClone(monster);
  clock.now.mockImplementationOnce(() => {
    throw new Error('private provider error');
  });
  const result = editInstance(catalog, monster, clock, 'ork', 'set-value', 'toughness', 50);
  expect(result).toMatchObject({
    success: false,
    diagnostics: [{ code: 'INVALID_VALUE', document: 'ork', pointer: '/modifiedAt' }],
  });
  expect(result).not.toHaveProperty('value');
  expect(JSON.stringify(result)).not.toContain('private provider error');
  expect(monster).toEqual(before);
  expect(editInstance(catalog, monster, clock, 'ork', 'set-value', 'toughness', 50)).toMatchObject({
    success: true,
    value: { values: { toughness: 50 }, derived: { toughnessBonus: 10 }, modifiedAt: editTime },
  });
  expect(monster).toEqual(before);
});

test('adds, replaces and removes one entry per call while preserving earlier results', () => {
  const { catalog, monster, clock } = setup();
  const added = editInstance(
    catalog,
    monster,
    clock,
    'ork',
    'add-entry',
    JSON.stringify(strengthEntry),
  );
  if (!added.success) throw new Error('Expected a valid add');
  expect(added.value.entries).toEqual([...monster.entries, strengthEntry]);
  expect(added.value.derived).toMatchObject({ strengthBonus: 10, toughnessBonus: 8 });

  const replacement = {
    ...strengthEntry,
    label: 'Updated Strength',
    effects: [{ op: 'multiply', target: 'strengthBonus', factor: 3 }],
  };
  const updated = editInstance(
    catalog,
    added.value,
    clock,
    'ork',
    'replace-entry',
    JSON.stringify(replacement),
  );
  if (!updated.success) throw new Error('Expected a valid replacement');
  expect(updated.value.entries).toEqual([...monster.entries, replacement]);
  expect(updated.value.derived).toMatchObject({ strengthBonus: 15, toughnessBonus: 8 });
  expect(added.value.derived.strengthBonus).toBe(10);

  const removed = editInstance(
    catalog,
    updated.value,
    clock,
    'ork',
    'remove-entry',
    strengthEntry.id,
  );
  expect(removed).toMatchObject({
    success: true,
    value: {
      entries: monster.entries,
      derived: { strengthBonus: 5, toughnessBonus: 8 },
    },
  });
  expect(clock.now).toHaveBeenCalledTimes(3);

  const updatedEntry = updated.value.entries.find(({ id }) => id === strengthEntry.id);
  const updatedEffect = updatedEntry?.effects.find(({ target }) => target === 'strengthBonus');
  if (!updatedEffect) throw new Error('Expected the updated effect');
  updatedEffect.factor = 4;
  expect(added.value.entries).toEqual([...monster.entries, strengthEntry]);
  expect(removed).toMatchObject({
    success: true,
    value: { entries: monster.entries },
  });
});

test('preserves an equivalent JSON replacement without calculating or reading the clock', () => {
  const { catalog, monster, clock } = setup();
  const calculator = vi.spyOn(calculations, 'calculateWithEntries');
  const original = monster.entries.find(({ id }) => id === 'unnatural-toughness');
  if (!original) throw new Error('Expected the Unnatural Toughness entry');
  const { id, ...rest } = original;
  // Object key order and JSON whitespace do not make a different snapshot.
  const result = editInstance(
    catalog,
    monster,
    clock,
    'ork',
    'replace-entry',
    JSON.stringify({ ...rest, id }, null, 2),
  );
  expect(result).toEqual({ success: true, value: monster });
  expect(calculator).not.toHaveBeenCalled();
  expect(clock.now).not.toHaveBeenCalled();
});

test('validates descriptive entry edits and preserves results when effects by target are unchanged', () => {
  const { catalog, character, clock } = setup();
  const entry = {
    ...strengthEntry,
    effects: [...strengthEntry.effects, { op: 'multiply', target: 'toughnessBonus', factor: 2 }],
  };
  const added = editInstance(
    catalog,
    character,
    clock,
    'sheet',
    'add-entry',
    JSON.stringify(entry),
  );
  if (!added.success) throw new Error('Expected a valid entry');
  added.value.derived.toughnessBonus = 91.5;
  clock.now.mockClear();
  const calculator = vi.spyOn(calculations, 'calculateWithEntries');

  const replacement = { ...entry, label: 'Renamed', effects: [...entry.effects].reverse() };
  const edited = editInstance(
    catalog,
    added.value,
    clock,
    'sheet',
    'replace-entry',
    JSON.stringify(replacement),
  );
  expect(edited).toEqual({
    success: true,
    value: { ...added.value, entries: [replacement], modifiedAt: editTime },
  });
  expect(added.value.entries).toEqual([entry]);
  expect(
    editInstance(
      catalog,
      added.value,
      clock,
      'sheet',
      'replace-entry',
      JSON.stringify({ ...replacement, label: ' ' }),
    ),
  ).toMatchObject({
    success: false,
    diagnostics: [{ document: 'sheet entries', pointer: '/0/label' }],
  });
  expect(calculator).not.toHaveBeenCalled();
  expect(clock.now).toHaveBeenCalledOnce();
});

test.each([
  [['replace-entry', JSON.stringify(strengthEntry)], '/entry/id', 'MISSING_REFERENCE'],
  [['replace-entry', 'null'], '/entry/id', 'INVALID_STRUCTURE'],
  [['remove-entry', strengthEntry.id], '/entryId', 'MISSING_REFERENCE'],
  [['remove-entry', ''], '/entryId', 'INVALID_STRUCTURE'],
] as const)('rejects invalid entry identity %j', (operation, pointer, code) => {
  const { catalog, monster, clock } = setup();
  const result = editInstance(catalog, monster, clock, 'ork', ...operation);
  expect(result).toMatchObject({
    success: false,
    diagnostics: [{ document: 'ork', pointer, code }],
  });
  expect(result).not.toHaveProperty('value');
  expect(clock.now).not.toHaveBeenCalled();
});

test.each([
  '{"id":',
  '{"factor": NaN}',
  '{"factor": Infinity}',
  '{"id":"first","id":"second"}',
  '{"id":"first","\\u0069d":"second"}',
  '{"metadata":{"sourceReview":"first","sourceReview":"second"}}',
])('rejects malformed or duplicate-key entry JSON %s', (entryJson) => {
  const { catalog, monster, clock } = setup();
  const result = editInstance(catalog, monster, clock, 'ork', 'add-entry', entryJson);
  expect(result).toMatchObject({
    success: false,
    diagnostics: [{ code: 'INVALID_JSON', document: 'ork', pointer: '/entry' }],
  });
  expect(result).not.toHaveProperty('value');
  expect(clock.now).not.toHaveBeenCalled();
});

test('accepts entry JSON with a ten-million-character description', () => {
  const { catalog, monster, clock } = setup();
  const length = 10_000_000;
  const entryJson = JSON.stringify({ ...strengthEntry, description: 'x'.repeat(length) });

  const result = editInstance(catalog, monster, clock, 'ork', 'add-entry', entryJson);

  if (!result.success) throw new Error('Expected the long description to be accepted');
  const entry = result.value.entries.find(({ id }) => id === strengthEntry.id);
  expect(entry?.description.length).toBe(length);
  expect(result.value.derived.strengthBonus).toBe(10);
});
test('allows braces, quotes and repeated words inside strings and keys reused in separate objects', () => {
  const { catalog, character, clock } = setup();
  const entry = {
    ...strengthEntry,
    description: 'Literal {"id":"one","id":"two"} and [ ] in the description.',
    effects: [...strengthEntry.effects, { op: 'multiply', target: 'toughnessBonus', factor: 2 }],
  };
  expect(
    editInstance(catalog, character, clock, 'character', 'add-entry', JSON.stringify(entry)),
  ).toMatchObject({
    success: true,
    value: { entries: [entry], derived: { strengthBonus: 8, toughnessBonus: 6 } },
  });
});

test.each([
  [{ ...strengthEntry, id: 'unnatural-toughness' }, 'DUPLICATE_ID', '/1/id'],
  [{ ...strengthEntry, label: '' }, 'INVALID_STRUCTURE', '/1/label'],
  [
    { ...strengthEntry, effects: [{ op: 'multiply', target: 'agilityBonus', factor: 2 }] },
    'INVALID_MODIFIER',
    '/1/effects/0/target',
  ],
  [
    {
      ...strengthEntry,
      effects: [{ op: 'multiply', target: 'strengthBonus', factor: Number.MAX_SAFE_INTEGER }],
    },
    'NONFINITE_RESULT',
    '/1/effects/0/factor',
  ],
  [{ ...strengthEntry, ['__proto__']: { unexpected: true } }, 'INVALID_STRUCTURE', '/1/__proto__'],
])('rejects an invalid candidate snapshot %j', (entry, code, pointer) => {
  const { catalog, monster, clock } = setup();
  const before = structuredClone(monster);
  const result = editInstance(catalog, monster, clock, 'ork', 'add-entry', JSON.stringify(entry));
  expect(result).toMatchObject({
    success: false,
    diagnostics: [{ code, document: 'ork entries', pointer }],
  });
  expect(result).not.toHaveProperty('value');
  expect(monster).toEqual(before);
  expect(clock.now).not.toHaveBeenCalled();
});

test('rejects a conflicting entry and preserves the last valid source state', () => {
  const { catalog, monster, clock } = setup();
  const before = structuredClone(monster);
  const entry = {
    ...strengthEntry,
    effects: [{ op: 'multiply', target: 'toughnessBonus', factor: 2 }],
  };
  const result = editInstance(catalog, monster, clock, 'ork', 'add-entry', JSON.stringify(entry));
  expect(result).toMatchObject({
    success: false,
    diagnostics: [
      {
        code: 'MODIFIER_CONFLICT',
        document: 'ork entries',
        pointer: '/1/effects/0/target',
        related: [{ document: 'ork entries', pointer: '/0/effects/0/target' }],
      },
    ],
  });
  expect(result).not.toHaveProperty('value');
  expect(monster).toEqual(before);
  expect(clock.now).not.toHaveBeenCalled();
});

test('keeps equivalent and rejected edits intact when logging fails', () => {
  const { catalog, monster, clock } = setup();
  const before = structuredClone(monster);
  const record = vi.fn(() => {
    throw new Error('sink unavailable');
  });
  const source = {
    document: 'ork',
    logging: { logger: { record }, operationId: '00000000-0000-4000-8000-000000000002' },
  };

  expect(
    editInstance(catalog, monster, clock, source, 'set-display-name', monster.displayName),
  ).toEqual(
    editInstance(catalog, monster, clock, source.document, 'set-display-name', monster.displayName),
  );
  expect(editInstance(catalog, monster, clock, source, 'remove-entry', 'missing-entry')).toEqual(
    editInstance(catalog, monster, clock, source.document, 'remove-entry', 'missing-entry'),
  );
  expect(clock.now).not.toHaveBeenCalled();
  expect(monster).toEqual(before);
  expect(record.mock.calls).toEqual([
    [
      expect.objectContaining({
        event: 'instance.edit',
        step: 'sheet.update',
        outcome: 'unchanged',
      }),
    ],
    [
      expect.objectContaining({
        event: 'instance.edit',
        step: 'change.apply',
        outcome: 'rejected',
      }),
    ],
  ]);
});

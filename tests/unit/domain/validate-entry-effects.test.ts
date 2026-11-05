import { describe, expect, it } from 'vitest';
import { validateEntryEffects } from '../../../src/domain/calculation/validate-entry-effects';
import { loadFixtures } from './fixtures';
import { multiplyEffect, entryFixture } from './effect-fixtures';

function validate(entries: unknown) {
  return validateEntryEffects(loadFixtures().template, { document: 'entries', value: entries });
}

function failure(entries: unknown, code: string, pointer?: string) {
  const result = validate(entries);
  expect(result.success).toBe(false);
  if (result.success) throw new Error('Expected failure');
  expect(result).not.toHaveProperty('value');
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code,
      document: 'entries',
      ...(pointer === undefined ? {} : { pointer }),
    }),
  );
  return result.diagnostics;
}

describe('validateEntryEffects', () => {
  it.each(['strength', 'absent', 'halfMove'])('rejects undeclared/input target %s', (target) => {
    failure([entryFixture([multiplyEffect(target)])], 'INVALID_MODIFIER', '/0/effects/0/target');
  });

  it('rejects effects when modifier targets are disabled', () => {
    const { template } = loadFixtures();
    template.modifierTargets = [];
    const result = validateEntryEffects(template, { document: 'entries', value: [entryFixture()] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.diagnostics[0].code).toBe('INVALID_MODIFIER');
  });

  it.each([
    [entryFixture([multiplyEffect(), multiplyEffect()])],
    [entryFixture(), entryFixture([multiplyEffect()], 'another')],
  ])('rejects conflicts with the original target location: %j', (...entries) => {
    const diagnostics = failure(entries, 'MODIFIER_CONFLICT');
    expect(diagnostics.find(({ code }) => code === 'MODIFIER_CONFLICT')!.related).toEqual([
      { document: 'entries', pointer: '/0/effects/0/target' },
    ]);
  });

  it('rejects duplicate IDs even without effects but allows duplicate labels', () => {
    failure([entryFixture([]), entryFixture([])], 'DUPLICATE_ID', '/1/id');
    expect(validate([entryFixture([], 'first'), entryFixture([], 'second')]).success).toBe(true);
  });

  it.each([
    null,
    {},
    'entries',
    [null],
    [true],
    [entryFixture(null)],
    [{ ...entryFixture(), extra: 1 }],
    [{ ...entryFixture(), metadata: { origin: 'undeclared' } }],
    [{ ...entryFixture(), source: '' }],
    [{ ...entryFixture(), description: null }],
    [{ ...entryFixture(), category: 'Invalid slug' }],
    [{ ...entryFixture(), label: ' ' }],
    [{ ...entryFixture(), id: '' }],
  ])('rejects malformed entry data %j', (entries) => {
    failure(entries, 'INVALID_STRUCTURE');
  });

  it.each(['id', 'category', 'label', 'description', 'effects'])(
    'requires entry property %s',
    (key) => {
      const value: Record<string, unknown> = entryFixture();
      delete value[key];
      failure([value], 'INVALID_STRUCTURE', `/0/${key}`);
    },
  );
});

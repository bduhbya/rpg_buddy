import { describe, expect, it } from 'vitest';
import { calculateBase } from '../../../src/domain/calculation/calculate-base';
import { calculateWithEntries } from '../../../src/domain/calculation/calculate-with-entries';
import type { Entry, Instance, Template } from '../../../src/domain/definitions/document-models';
import { loadFixtures } from './fixtures';

import { multiplyEffect, entryFixture } from './effect-fixtures';

function statistics(sb: number, tb: number, ab: number, movement: readonly number[]) {
  return {
    strengthBonus: sb,
    toughnessBonus: tb,
    agilityBonus: ab,
    halfMove: movement[0],
    fullMove: movement[1],
    chargeMove: movement[2],
    runMove: movement[3],
  };
}

function calculateInstance(template: Template, instance: Instance) {
  return calculateWithEntries(
    { document: 'template', value: template },
    { document: 'values', value: instance.values },
    { document: 'entries', value: instance.entries },
  );
}

function calculate(entries: unknown, template?: Template) {
  const fixtures = loadFixtures();
  return calculateWithEntries(
    { document: 'template', value: template ?? fixtures.template },
    { document: 'values', value: fixtures.character.values },
    { document: 'entries', value: entries },
  );
}

describe('calculateWithEntries', () => {
  it('propagates a located source-input failure with valid entries', () => {
    const { template, character } = loadFixtures();
    const result = calculateWithEntries(
      { document: 'template', value: template },
      { document: 'values', value: { ...character.values, strength: 100 } },
      { document: 'entries', value: [entryFixture()] },
    );
    expect(result).toMatchObject({
      success: false,
      diagnostics: [
        expect.objectContaining({
          code: 'INVALID_VALUE',
          document: 'values',
          pointer: '/strength',
        }),
      ],
    });
    expect(result).not.toHaveProperty('value');
  });
  it('matches base calculations without effects and accepts informational snapshots', () => {
    const { template, character } = loadFixtures();
    const expected = calculateBase(
      { document: 'template', value: template },
      { document: 'values', value: character.values },
    );
    expect(calculate([])).toEqual(expected);
    expect(
      calculate([
        entryFixture([]),
        {
          ...entryFixture([], 'another'),
          source: 'Rulebook p. 1',
          metadata: {
            sourceReview: 'Documentary only',
            requirementRefs: [],
            sourceRegisterRefs: [],
          },
        },
      ]),
    ).toEqual(expected);
  });

  it.each([
    [45, 8],
    [49, 8],
    [50, 10],
  ])('applies the authored Ork effect after floor at T%s', (score, expected) => {
    const { template, monster } = loadFixtures();
    monster.values.toughness = score;
    const result = calculateWithEntries(
      { document: 'template', value: template },
      { document: 'values', value: monster.values },
      { document: 'entries', value: monster.entries },
    );
    expect(result).toEqual({ success: true, value: statistics(5, expected, 3, [3, 6, 9, 18]) });
  });

  it('modifies both targets generically without interpreting labels or categories', () => {
    const result = calculate([entryFixture([multiplyEffect(), multiplyEffect('toughnessBonus')])]);
    expect(result).toEqual({ success: true, value: statistics(8, 6, 3, [3, 6, 9, 18]) });
  });

  it.each([
    [0, 0, 0, [0.5, 1, 2, 3]],
    [9, 0, 0, [0.5, 1, 2, 3]],
    [10, 1, 2, [1, 2, 3, 6]],
    [39, 3, 6, [3, 6, 9, 18]],
    [40, 4, 8, [4, 8, 12, 24]],
    [99, 9, 18, [9, 18, 27, 54]],
  ] as const)(
    'matches independent effect-adjusted boundary results at score %s',
    (score, bonus, modifiedTB, movement) => {
      const { template, monster } = loadFixtures();
      Object.assign(monster.values, { strength: score, toughness: score, agility: score });
      expect(calculateInstance(template, monster)).toEqual({
        success: true,
        value: statistics(bonus, modifiedTB, bonus, movement),
      });
    },
  );

  it('round-trips independent selected snapshots and applies floor before both effects', () => {
    const fixtures = loadFixtures();
    const before = structuredClone(fixtures);
    const instance = structuredClone(fixtures.character);
    Object.assign(instance.values, { strength: 49, toughness: 49 });
    instance.entries = [
      entryFixture([multiplyEffect()], 'strength-trait'),
      entryFixture([multiplyEffect('toughnessBonus')], 'toughness-trait'),
    ] as Entry[];
    const expected = { success: true, value: statistics(8, 8, 3, [3, 6, 9, 18]) };
    expect(calculateInstance(fixtures.template, instance)).toEqual(expected);
    const restored = JSON.parse(JSON.stringify(instance)) as Instance;
    expect(calculateInstance(fixtures.template, restored)).toEqual(expected);
    restored.entries[0].effects[0].factor = 3;
    expect(instance.entries[0].effects[0].factor).toBe(2);
    expect(fixtures).toEqual(before);
  });

  it('uses snapshots independently of role, career, feature names and source metadata', () => {
    const { template, monster } = loadFixtures();
    const expected = { success: true, value: statistics(5, 8, 3, [3, 6, 9, 18]) };
    monster.role = 'character';
    monster.displayName = 'Custom creature';
    monster.career = 'Homebrew profession';
    monster.entries[0].label = 'An informational story choice';
    monster.entries[0].category = 'custom';
    expect(calculateInstance(template, monster)).toEqual(expected);
    const stripMetadata = (_key: string, value: unknown) =>
      _key === 'metadata' ? undefined : value;
    const plainTemplate = JSON.parse(JSON.stringify(template, stripMetadata)) as Template;
    const plainInstance = JSON.parse(JSON.stringify(monster, stripMetadata)) as Instance;
    expect(calculateInstance(plainTemplate, plainInstance)).toEqual(expected);
    plainTemplate.metadata = { sourceReview: 'No such document is needed' };
    plainInstance.entries[0].metadata = { sourceRegisterRefs: ['Multiply by 999'] };
    expect(calculateInstance(plainTemplate, plainInstance)).toEqual(expected);
    plainInstance.entries = [];
    expect(calculateInstance(plainTemplate, plainInstance)).toEqual({
      success: true,
      value: statistics(5, 4, 3, [3, 6, 9, 18]),
    });
  });

  it('exposes final values downstream and applies each target factor exactly once', () => {
    const { template } = loadFixtures();
    template.derived.find(({ id }) => id === 'toughnessBonus')!.expression = {
      op: 'field',
      id: 'strengthBonus',
    };
    template.derived.find(({ id }) => id === 'agilityBonus')!.expression = {
      op: 'field',
      id: 'toughnessBonus',
    };
    template.derived.reverse();
    const result = calculate(
      [entryFixture([multiplyEffect(), multiplyEffect('toughnessBonus', 3)])],
      template,
    );
    expect(result.success && result.value).toMatchObject({
      strengthBonus: 8,
      toughnessBonus: 24,
      agilityBonus: 24,
      halfMove: 24,
      runMove: 144,
    });
  });

  it('never interprets descriptions as rules', () => {
    expect(calculate([{ ...entryFixture([]), description: 'multiply everything by 100' }])).toEqual(
      calculate([]),
    );
  });

  it('rejects an effect result just beyond the safe-integer boundary', () => {
    const base = 2 ** 52;
    const { template } = loadFixtures();
    template.derived[0].expression = { op: 'constant', value: base };
    const result = calculate([entryFixture()], template);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'NONFINITE_RESULT',
          document: 'entries',
          pointer: '/0/effects/0/factor',
          related: [{ document: 'template', pointer: '/derived/0/expression' }],
        }),
      );
    expect(result).not.toHaveProperty('value');
  });

  it.each([
    [1, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    [-0, 2, 0],
  ])('preserves numeric semantics for %s times %s', (base, factor, expected) => {
    const { template } = loadFixtures();
    template.derived[0].expression = { op: 'constant', value: base };
    const result = calculate([entryFixture([multiplyEffect('strengthBonus', factor)])], template);
    expect(result.success && result.value.strengthBonus).toBe(expected);
  });

  it('validates effects before arithmetic can fail', () => {
    const { template } = loadFixtures();
    template.derived[0].expression = {
      op: 'divide',
      left: { op: 'constant', value: 1 },
      right: { op: 'constant', value: 0 },
    };
    const result = calculate([entryFixture([multiplyEffect('absent')])], template);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.diagnostics.map(({ code }) => code)).toContain('INVALID_MODIFIER');
    if (!result.success)
      expect(result.diagnostics.map(({ code }) => code)).not.toContain('DIVISION_BY_ZERO');
  });

  it('recomputes without compounding and preserves caller and prior valid results on failure', () => {
    const { template, character } = loadFixtures();
    const entries = [entryFixture()] as Entry[];
    const run = () =>
      calculateWithEntries(
        { document: 'template', value: template },
        { document: 'values', value: character.values },
        { document: 'entries', value: entries },
      );
    const before = structuredClone({ template, character, entries });
    const valid = run();
    expect(valid.success && valid.value.strengthBonus).toBe(8);
    expect(run()).toEqual(valid);
    expect({ template, character, entries }).toEqual(before);
    entries[0].effects[0].factor = 0;
    expect(run().success).toBe(false);
    expect(valid.success && valid.value.strengthBonus).toBe(8);
    entries[0].effects[0].factor = 3;
    expect(run().success && run()).toMatchObject({ success: true, value: { strengthBonus: 12 } });
    entries.length = 0;
    expect(run()).toMatchObject({ success: true, value: { strengthBonus: 4 } });
  });
});

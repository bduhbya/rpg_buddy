import { describe, expect, it } from 'vitest';
import { calculateDerived } from '../../../src/domain/calculation/calculation-engine';
import { createInMemoryDefinitionCatalog } from '../../../src/domain/definition-processing/in-memory-definition-catalog';
import { resolveDefinitions } from '../../../src/domain/definition-processing/resolve-definitions';
import type { Expression } from '../../../src/domain/definitions/expressions';
import { loadFixtures } from './fixtures';

const constant = (value: number): Expression => ({ op: 'constant', value });
const equal: Expression = { op: 'equal', left: constant(1), right: constant(1) };

// When additional RPG systems are added, make this helper generic across system-specific statistics.
function statistics(sb: number, tb: number, ab: number, movement: number[]) {
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

function expressionResult(expression: unknown, edits: Record<string, unknown> = {}) {
  const { template, character } = loadFixtures();
  template.derived[0].expression = expression as Expression;
  return calculateDerived(
    { document: 'template', value: template },
    { document: 'values', value: { ...character.values, ...edits } },
  );
}

function expectFailure(expression: unknown, code: string, pointer?: string) {
  const result = expressionResult(expression);
  expect(result.success).toBe(false);
  if (result.success) throw new Error('Expected failure');
  expect(result).not.toHaveProperty('value');
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code, ...(pointer === undefined ? {} : { pointer }) }),
  );
}

describe('calculateDerived', () => {
  it.each([
    ['character', {}, statistics(4, 3, 3, [3, 6, 9, 18])],
    ['monster', {}, statistics(5, 4, 3, [3, 6, 9, 18])],
    ['character', { agility: 40 }, statistics(4, 3, 4, [4, 8, 12, 24])],
    ['monster', { toughness: 49 }, statistics(5, 4, 3, [3, 6, 9, 18])],
    ['monster', { toughness: 50 }, statistics(5, 5, 3, [3, 6, 9, 18])],
  ] as const)('matches independent base expectations for %s with %j', (role, edits, expected) => {
    const fixtures = loadFixtures();
    const catalog = createInMemoryDefinitionCatalog(
      [{ document: 'system', value: fixtures.manifest }],
      [{ document: 'template', value: fixtures.template }],
    );
    if (!catalog.success) throw new Error('Invalid fixtures');
    const instance = fixtures[role];
    const resolved = resolveDefinitions(
      catalog.value,
      {
        system: instance.system,
        template: instance.template,
      },
      'instance',
    );
    if (!resolved.success) throw new Error('Resolution failed');
    const before = JSON.stringify(fixtures);
    const values = { ...instance.values, ...edits };
    expect(
      calculateDerived(resolved.value.template, { document: 'values', value: values }),
    ).toEqual({
      success: true,
      value: expected,
    });
    expect(JSON.stringify(fixtures)).toBe(before);
    expect(values).toEqual({ ...instance.values, ...edits });
  });

  it.each([
    [0, 0, [0.5, 1, 2, 3]],
    [9, 0, [0.5, 1, 2, 3]],
    [10, 1, [1, 2, 3, 6]],
    [39, 3, [3, 6, 9, 18]],
    [40, 4, [4, 8, 12, 24]],
    [99, 9, [9, 18, 27, 54]],
  ] as const)('matches the boundary score %s for both roles', (score, bonus, movement) => {
    const fixtures = loadFixtures();
    for (const instance of [fixtures.character, fixtures.monster]) {
      expect(
        calculateDerived(
          { document: 'template', value: fixtures.template },
          {
            document: 'values',
            value: { ...instance.values, strength: score, toughness: score, agility: score },
          },
        ),
      ).toEqual({ success: true, value: statistics(bonus, bonus, bonus, [...movement]) });
    }
  });

  it('uses zero defaults only when explicitly supplied and recomputes without stale results', () => {
    const { template, character } = loadFixtures();
    const located = { document: 'template', value: template };
    expect(
      calculateDerived(located, {
        document: 'values',
        value: Object.fromEntries(template.inputs.map((input) => [input.id, input.default])),
      }),
    ).toEqual({ success: true, value: statistics(0, 0, 0, [0.5, 1, 2, 3]) });
    const source = { document: 'values', value: character.values };
    expect(calculateDerived(located, source).success).toBe(true);
    character.values.agility = 100;
    expect(calculateDerived(located, source).success).toBe(false);
    character.values.agility = 40;
    expect(calculateDerived(located, source)).toEqual({
      success: true,
      value: statistics(4, 3, 4, [4, 8, 12, 24]),
    });
  });

  it('orders dependencies even when the template declarations are reversed', () => {
    const { template, character } = loadFixtures();
    template.derived.reverse();
    expect(
      calculateDerived(
        { document: 'template', value: template },
        { document: 'values', value: character.values },
      ),
    ).toEqual({ success: true, value: statistics(4, 3, 3, [3, 6, 9, 18]) });
  });

  it.each([true, false])('evaluates only the selected branch (condition %s)', (truth) => {
    const failure: Expression = { op: 'divide', left: constant(1), right: constant(0) };
    const result = expressionResult({
      op: 'if',
      condition: { op: 'equal', left: constant(1), right: constant(truth ? 1 : 2) },
      then: truth ? constant(4) : failure,
      else: truth ? failure : constant(4),
    });
    expect(result.success && result.value.strengthBonus).toBe(4);
  });

  it.each([
    [equal, 'TYPE_MISMATCH'],
    [{ op: 'floor', value: equal }, 'TYPE_MISMATCH'],
    [{ op: 'multiply', left: equal, right: constant(2) }, 'TYPE_MISMATCH'],
    [{ op: 'equal', left: equal, right: constant(2) }, 'TYPE_MISMATCH'],
    [{ op: 'if', condition: constant(1), then: constant(2), else: constant(3) }, 'TYPE_MISMATCH'],
    [{ op: 'if', condition: equal, then: constant(2), else: equal }, 'TYPE_MISMATCH'],
    [{ op: 'field', id: 'absent' }, 'MISSING_REFERENCE'],
    [{ op: 'field', id: 'strengthBonus' }, 'DEPENDENCY_CYCLE'],
    [
      { op: 'if', condition: equal, then: constant(1), else: { op: 'field', id: 'strengthBonus' } },
      'DEPENDENCY_CYCLE',
    ],
    [{ op: 'exec', value: 'code' }, 'INVALID_STRUCTURE'],
    [{ op: 'multiply', left: constant(1) }, 'INVALID_STRUCTURE'],
    [{ op: 'constant', value: true }, 'INVALID_VALUE'],
    [{ op: 'constant', value: 1, extra: 2 }, 'INVALID_STRUCTURE'],
    [constant(Infinity), 'INVALID_VALUE'],
    [constant(NaN), 'INVALID_VALUE'],
    [constant(2 ** 53), 'INVALID_VALUE'],
    [{ op: 'multiply', left: constant(2 ** 52), right: constant(2) }, 'NONFINITE_RESULT'],
    [
      { op: 'divide', left: constant(Number.MIN_VALUE), right: constant(Number.MIN_VALUE * 2) },
      null,
    ],
  ])('checks all expression nodes for %j', (expression, code) => {
    if (code) expectFailure(expression, code);
    else expect(expressionResult(expression).success).toBe(true);
  });

  it.each([0, -0])('rejects division by signed zero %s', (zero) => {
    expectFailure(
      { op: 'divide', left: constant(1), right: constant(zero) },
      'DIVISION_BY_ZERO',
      '/derived/0/expression/right',
    );
  });

  it('rejects nonfinite intermediate results before a later operation can hide them', () => {
    expectFailure(
      {
        op: 'multiply',
        left: {
          op: 'divide',
          left: constant(1),
          right: constant(Number.MIN_VALUE),
        },
        right: constant(0),
      },
      'NONFINITE_RESULT',
      '/derived/0/expression/left',
    );
  });

  it.each([
    [constant(-0), 0],
    [{ op: 'floor', value: constant(-1.5) }, -2],
    [{ op: 'divide', left: constant(3), right: constant(2) }, 1.5],
    [constant(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
  ])('preserves numeric semantics for %j', (expression, expected) => {
    const result = expressionResult(expression);
    expect(result.success && result.value.strengthBonus).toBe(expected);
  });

  it.each([true, '40', 1.5, NaN, Infinity, 2 ** 53, -1, 100])(
    'rejects invalid input %s',
    (value) => {
      const result = expressionResult(constant(1), { agility: value });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.diagnostics).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_VALUE',
            document: 'values',
            pointer: '/agility',
          }),
        );
    },
  );

  it.each([null, [], {}, { strength: 40 }, { extra: 1 }])(
    'rejects incomplete or malformed input maps %j',
    (value) => {
      const { template } = loadFixtures();
      expect(
        calculateDerived({ document: 'template', value: template }, { document: 'values', value })
          .success,
      ).toBe(false);
    },
  );

  it('rejects extra keys and inherited input values', () => {
    const { template, character } = loadFixtures();
    const located = { document: 'template', value: template };
    for (const value of [{ ...character.values, extra: 1 }, Object.create(character.values)]) {
      expect(calculateDerived(located, { document: 'values', value }).success).toBe(false);
    }
  });
});

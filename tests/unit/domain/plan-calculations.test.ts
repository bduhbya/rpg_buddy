import { describe, expect, it } from 'vitest';
import type { Expression } from '../../../src/domain/definitions/expressions';
import { planCalculations } from '../../../src/domain/calculation/plan-calculations';
import { loadFixtures } from './fixtures';

function plan(expressions: Record<string, Expression>) {
  const value = loadFixtures().template;
  value.derived = Object.entries(expressions).map(([id, expression]) => ({
    id,
    label: id,
    type: 'number',
    sourceRefs: [],
    expression,
  }));
  return planCalculations({ document: 'template.json', value });
}

const constant: Expression = { op: 'constant', value: 1 };
const field = (id: string): Expression => ({ op: 'field', id });

describe('planCalculations', () => {
  it('orders prerequisites first and includes a shared prerequisite once', () => {
    const input = loadFixtures().template.inputs[0].id;
    const result = plan({ first: field('base'), second: field('base'), base: field(input) });

    expect(result.success && result.value.map(({ id }) => id)).toEqual(['base', 'first', 'second']);
  });

  it('checks references in the unselected branch', () => {
    expect(
      plan({
        first: {
          op: 'if',
          condition: { op: 'equal', left: constant, right: constant },
          then: constant,
          else: field('absent'),
        },
      }),
    ).toEqual({
      success: false,
      diagnostics: [
        {
          code: 'MISSING_REFERENCE',
          document: 'template.json',
          pointer: '/derived/0/expression/else/id',
          message: 'Unknown field "absent".',
        },
      ],
    });
  });

  it.each([
    {
      expressions: { first: field('first') },
      pointer: '/derived/0/expression/id',
      chain: 'first -> first',
      participants: [0],
    },
    {
      expressions: { first: field('second'), second: field('first') },
      pointer: '/derived/1/expression/id',
      chain: 'first -> second -> first',
      participants: [0, 1],
    },
    {
      expressions: { lead: field('first'), first: field('second'), second: field('first') },
      pointer: '/derived/2/expression/id',
      chain: 'first -> second -> first',
      participants: [1, 2],
    },
  ])(
    'rejects a cycle at its closing edge ($chain)',
    ({ expressions, pointer, chain, participants }) => {
      expect(plan(expressions as Record<string, Expression>)).toEqual({
        success: false,
        diagnostics: [
          {
            code: 'DEPENDENCY_CYCLE',
            document: 'template.json',
            pointer,
            message: `Dependency cycle: ${chain}.`,
            related: participants.map((index) => ({
              document: 'template.json',
              pointer: `/derived/${index}/id`,
            })),
          },
        ],
      });
    },
  );
});

import { describe, expect, it } from 'vitest';
import {
  applyEffectOperation,
  validateEffectOperation,
} from '../../../src/domain/calculation/effect-operations';
import { DefinitionChecks } from '../../../src/domain/validation';
import { multiplyEffect } from './effect-fixtures';

function validate(value: unknown) {
  const checks = new DefinitionChecks('effect');
  const parsed = validateEffectOperation(value, '', checks);
  return { parsed, diagnostics: checks.diagnostics };
}

function reject(value: unknown, code: string, pointer: string) {
  const result = validate(value);
  expect(result.parsed).toBeUndefined();
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code, document: 'effect', pointer }),
  );
}

describe('effect operations', () => {
  it('multiply accepts the identity factor', () => {
    const factor = 1;
    expect(validate(multiplyEffect('strengthBonus', factor))).toEqual({
      parsed: multiplyEffect('strengthBonus', factor),
      diagnostics: [],
    });
  });

  it.each([0, -1, 1.5, '2', true, null, NaN, Infinity, -Infinity, 2 ** 53])(
    'multiply rejects invalid factor %s',
    (factor) => {
      reject(multiplyEffect('strengthBonus', factor), 'INVALID_MODIFIER', '/factor');
    },
  );

  it.each(['add', '__proto__', 'constructor', 'toString', 2, null])(
    'rejects unregistered operation %s',
    (op) => {
      reject({ ...multiplyEffect(), op }, 'INVALID_MODIFIER', '/op');
    },
  );

  it('rejects a non-object effect', () => {
    reject(null, 'INVALID_STRUCTURE', '');
  });

  it('multiply rejects unknown properties', () => {
    reject({ ...multiplyEffect(), extra: 1 }, 'INVALID_STRUCTURE', '/extra');
  });

  it.each(['op', 'target', 'factor'])('multiply requires property %s', (key) => {
    const value: Record<string, unknown> = multiplyEffect();
    delete value[key];
    reject(value, 'INVALID_STRUCTURE', `/${key}`);
  });

  it('multiply rejects a malformed target identifier', () => {
    reject({ ...multiplyEffect(), target: '__proto__' }, 'INVALID_MODIFIER', '/target');
  });

  it.each([
    [4, 1, 4],
    [0.5, 3, 1.5],
    [-2, 3, -6],
  ])('multiply calculates base %s times factor %s', (base, factor, expected) => {
    expect(applyEffectOperation(base, { op: 'multiply', target: 'strengthBonus', factor })).toBe(
      expected,
    );
  });
});

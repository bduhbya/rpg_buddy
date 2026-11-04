import type { EntryEffect } from './documents';
import type { DefinitionChecks } from './validation';

type EffectOperationHandlers = {
  [Operation in EntryEffect['op']]: {
    validate(value: unknown, pointer: string, checks: DefinitionChecks): EntryEffect | undefined;
    apply(base: number, effect: EntryEffect): number;
  };
};

/** One registration owns each operation's closed shape, validation and arithmetic. */
const operations = {
  multiply: {
    validate(value, pointer, checks) {
      const start = checks.diagnostics.length;
      if (!checks.object(value, pointer, ['op', 'target', 'factor'])) return undefined;
      const beforeTarget = checks.diagnostics.length;
      checks.fieldId(value.target, `${pointer}/target`);
      for (const diagnostic of checks.diagnostics.slice(beforeTarget))
        diagnostic.code = 'INVALID_MODIFIER';
      if (
        typeof value.factor !== 'number' ||
        !Number.isSafeInteger(value.factor) ||
        value.factor <= 0
      )
        checks.issue(
          `${pointer}/factor`,
          'Expected a positive safe-integer multiplier.',
          'INVALID_MODIFIER',
        );
      if (checks.diagnostics.length !== start) return undefined;
      return { op: 'multiply', target: value.target as string, factor: value.factor as number };
    },
    apply(base, effect) {
      return base * effect.factor;
    },
  },
} satisfies EffectOperationHandlers;

export function validateEffectOperation(
  value: unknown,
  pointer: string,
  checks: DefinitionChecks,
): EntryEffect | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    checks.issue(pointer, 'Expected an effect object.');
    return undefined;
  }
  if (!Object.hasOwn(value, 'op')) {
    checks.issue(`${pointer}/op`, 'Required property is missing.');
    return undefined;
  }
  const op = (value as Record<string, unknown>).op;
  if (typeof op !== 'string' || !Object.hasOwn(operations, op)) {
    checks.issue(
      `${pointer}/op`,
      `Expected a supported effect operation: ${Object.keys(operations).join(', ')}.`,
      'INVALID_MODIFIER',
    );
    return undefined;
  }
  return operations[op as EntryEffect['op']].validate(value, pointer, checks);
}

/** Called only with effects accepted by validateEffectOperation. */
export function applyEffectOperation(base: number, effect: EntryEffect): number {
  return operations[effect.op].apply(base, effect);
}

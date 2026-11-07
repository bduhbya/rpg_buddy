import type { EntryEffect } from '../definitions/document-models';
import type { DefinitionChecks } from '../instances/structural-validation';

type EffectOperationHandlers = {
  [Operation in EntryEffect['op']]: {
    validate(value: unknown, pointer: string, checks: DefinitionChecks): EntryEffect | undefined;
    apply(base: number, effect: EntryEffect): number;
  };
};

/** One registration owns each operation's closed shape, validation and arithmetic. */
const operations = {
  multiply: {
    // Check the multiplier's closed shape, target identifier, and positive safe-integer factor.
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

/**
 * Validate an effect's operation name, properties, and operands using the registered validator.
 * @param value Parsed effect object to check.
 * @param pointer JSON Pointer to the effect within the entry document.
 * @param checks Call-local validator that collects operation diagnostics.
 * @returns The validated effect, or undefined when operation validation fails.
 */
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

/**
 * Apply a validated operation to a derived field's base value. The caller checks the result against the calculation's numeric constraints.
 * @param base Result of the field's base formula.
 * @param effect Effect previously accepted by validateEffectOperation.
 * @returns The operation's numeric result.
 */
export function applyEffectOperation(base: number, effect: EntryEffect): number {
  return operations[effect.op].apply(base, effect);
}

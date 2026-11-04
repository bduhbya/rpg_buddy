import type { Expression } from './expressions';
import type { Template } from './documents';
import type { LocatedDefinition } from './in-memory-definition-catalog';
import { planCalculations } from './plan-calculations';
import { validateTemplate } from './validate-template';
import { validateEntryEffects } from './validate-entry-effects';
import { applyEffectOperation } from './effect-operations';
import { childPointer, DefinitionChecks } from './validation';
import type { ValidationResult } from './validation';

function checkType(
  expression: Expression,
  expected: 'number' | 'boolean',
  pointer: string,
  checks: DefinitionChecks,
): void {
  const actual = expression.op === 'equal' ? 'boolean' : 'number';
  if (actual !== expected)
    checks.issue(pointer, `Expected ${expected} expression, received ${actual}.`, 'TYPE_MISMATCH');
  switch (expression.op) {
    case 'floor':
      checkType(expression.value, 'number', `${pointer}/value`, checks);
      break;
    case 'divide':
    case 'multiply':
    case 'equal':
      checkType(expression.left, 'number', `${pointer}/left`, checks);
      checkType(expression.right, 'number', `${pointer}/right`, checks);
      break;
    case 'if':
      checkType(expression.condition, 'boolean', `${pointer}/condition`, checks);
      checkType(expression.then, 'number', `${pointer}/then`, checks);
      checkType(expression.else, 'number', `${pointer}/else`, checks);
      break;
  }
}

function evaluate(
  expression: Expression,
  pointer: string,
  values: Map<string, number>,
  checks: DefinitionChecks,
): number | boolean | undefined {
  let result: number;
  switch (expression.op) {
    case 'constant':
      result = expression.value;
      break;
    case 'field':
      return values.get(expression.id);
    case 'if': {
      const condition = evaluate(expression.condition, `${pointer}/condition`, values, checks);
      if (condition === undefined) return undefined;
      const branch = condition ? 'then' : 'else';
      return evaluate(expression[branch], `${pointer}/${branch}`, values, checks);
    }
    case 'floor': {
      const operand = evaluate(expression.value, `${pointer}/value`, values, checks);
      if (operand === undefined) return undefined;
      result = Math.floor(operand as number);
      break;
    }
    default: {
      const left = evaluate(expression.left, `${pointer}/left`, values, checks);
      const right = evaluate(expression.right, `${pointer}/right`, values, checks);
      if (left === undefined || right === undefined) return undefined;
      if (expression.op === 'equal') return left === right;
      if (expression.op === 'divide' && right === 0) {
        checks.issue(`${pointer}/right`, 'Division by zero is not permitted.', 'DIVISION_BY_ZERO');
        return undefined;
      }
      result =
        expression.op === 'multiply'
          ? (left as number) * (right as number)
          : (left as number) / (right as number);
    }
  }
  if (!Number.isFinite(result)) {
    checks.issue(pointer, 'Calculation produced a nonfinite number.', 'NONFINITE_RESULT');
    return undefined;
  }
  if (Number.isInteger(result) && !Number.isSafeInteger(result)) {
    checks.issue(
      pointer,
      'Calculation produced an integer outside the safe range.',
      'NONFINITE_RESULT',
    );
    return undefined;
  }
  return result === 0 ? 0 : result;
}

/**
 * Shared implementation for base-only and effect-aware derived calculations.
 * Revalidates the template because callers may have changed a resolved copy.
 * Inputs are located separately so diagnostics identify their requesting document.
 * Each call owns its cache. Neither definitions nor supplied values are changed.
 */
export function calculateDerived(
  template: LocatedDefinition<Template>,
  sourceValues: LocatedDefinition<unknown>,
  entries?: LocatedDefinition<unknown>,
): ValidationResult<Record<string, number>> {
  const validated = validateTemplate(template.value, template.document);
  if (!validated.success) return validated;
  const planned = planCalculations(template);
  if (!planned.success) return planned;
  const effects = validateEntryEffects(
    template.value,
    entries ?? { document: template.document, value: [] },
  );
  if (!effects.success) return effects;
  const checks = new DefinitionChecks(template.document);
  template.value.derived.forEach((field, index) =>
    checkType(field.expression, 'number', `/derived/${index}/expression`, checks),
  );
  const inputChecks = new DefinitionChecks(sourceValues.document);
  const values = new Map<string, number>();
  const inputs = template.value.inputs;
  if (
    inputChecks.object(
      sourceValues.value,
      '',
      [],
      inputs.map(({ id }) => id),
    )
  ) {
    // The closed-object check reports only extra keys once the map shape is valid.
    for (const diagnostic of inputChecks.diagnostics) diagnostic.code = 'UNKNOWN_FIELD';
    for (const input of inputs) {
      const pointer = childPointer('', input.id);
      if (!Object.hasOwn(sourceValues.value, input.id)) {
        inputChecks.issue(pointer, `Missing input "${input.id}".`, 'MISSING_FIELD');
        continue;
      }
      const value = sourceValues.value[input.id];
      if (!inputChecks.number(value, pointer, true)) continue;
      if (value < input.minimum || value > input.maximum)
        inputChecks.issue(
          pointer,
          `Expected a value from ${input.minimum} through ${input.maximum}.`,
          'INVALID_VALUE',
        );
      values.set(input.id, value === 0 ? 0 : value);
    }
  }
  checks.diagnostics.push(...inputChecks.diagnostics);
  if (checks.diagnostics.length) return checks.result({});
  const indices = new Map(template.value.derived.map(({ id }, index) => [id, index]));
  const results: Record<string, number> = {};
  for (const field of planned.value) {
    let value = evaluate(
      field.expression,
      `/derived/${indices.get(field.id)}/expression`,
      values,
      checks,
    );
    if (value === undefined) return checks.result({});
    const effect = effects.value.get(field.id);
    if (effect) {
      const modified = applyEffectOperation(value as number, effect.effect);
      if (
        !Number.isFinite(modified) ||
        (Number.isInteger(modified) && !Number.isSafeInteger(modified))
      ) {
        return {
          success: false,
          diagnostics: [
            {
              code: 'NONFINITE_RESULT',
              document: effect.document,
              pointer: `${effect.pointer}/factor`,
              message: `Effect on "${field.id}" produced a nonfinite number or an integer outside the safe range.`,
              related: [
                {
                  document: template.document,
                  pointer: `/derived/${indices.get(field.id)}/expression`,
                },
              ],
            },
          ],
        };
      }
      value = modified === 0 ? 0 : modified;
    }
    values.set(field.id, value as number);
    Object.defineProperty(results, field.id, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return checks.result(results);
}

import type { Expression } from '../definitions/expressions';
import type { Template } from '../documents';
import type { LocatedDefinition } from '../definition-processing/in-memory-definition-catalog';
import { planCalculations } from './plan-calculations';
import { validateTemplate } from '../definition-processing/validate-template';
import { validateEntryEffects } from './validate-entry-effects';
import { applyEffectOperation } from './effect-operations';
import { childPointer, DefinitionChecks } from '../validation';
import type { ValidationResult } from '../validation';

// Check operand types recursively, including both branches of a conditional.
function checkExpressionType(
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
      checkExpressionType(expression.value, 'number', `${pointer}/value`, checks);
      break;
    case 'divide':
    case 'multiply':
    case 'equal':
      checkExpressionType(expression.left, 'number', `${pointer}/left`, checks);
      checkExpressionType(expression.right, 'number', `${pointer}/right`, checks);
      break;
    case 'if':
      checkExpressionType(expression.condition, 'boolean', `${pointer}/condition`, checks);
      checkExpressionType(expression.then, 'number', `${pointer}/then`, checks);
      checkExpressionType(expression.else, 'number', `${pointer}/else`, checks);
      break;
  }
}

// Evaluate against known field values, evaluating only the selected conditional branch.
function evaluateExpression(
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
      const condition = evaluateExpression(
        expression.condition,
        `${pointer}/condition`,
        values,
        checks,
      );
      if (condition === undefined) return undefined;
      const branch = condition ? 'then' : 'else';
      return evaluateExpression(expression[branch], `${pointer}/${branch}`, values, checks);
    }
    case 'floor': {
      const operand = evaluateExpression(expression.value, `${pointer}/value`, values, checks);
      if (operand === undefined) return undefined;
      result = Math.floor(operand as number);
      break;
    }
    default: {
      const left = evaluateExpression(expression.left, `${pointer}/left`, values, checks);
      const right = evaluateExpression(expression.right, `${pointer}/right`, values, checks);
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
 * Run the shared calculation pipeline. Revalidate the caller's template, then compute each derived field in dependency order using a fresh cache.
 * @param template Located template to validate and evaluate.
 * @param sourceValues Located input map containing exactly the template's declared inputs.
 * @param entries Located entry snapshots to validate and apply. Omit for base-only calculation.
 * @returns Derived values keyed by field ID, or diagnostics without partial values.
 */
export function calculateDerived(
  template: LocatedDefinition<Template>,
  sourceValues: LocatedDefinition<unknown>,
  entries?: LocatedDefinition<unknown>,
): ValidationResult<Record<string, number>> {
  const validated = validateTemplate(template.value, template.document);
  if (!validated.success) return validated;
  const evaluationOrder = planCalculations(template);
  if (!evaluationOrder.success) return evaluationOrder;
  const effectsByTarget = validateEntryEffects(
    template.value,
    entries ?? { document: template.document, value: [] },
  );
  if (!effectsByTarget.success) return effectsByTarget;
  const checks = new DefinitionChecks(template.document);
  template.value.derived.forEach((field, index) =>
    checkExpressionType(field.expression, 'number', `/derived/${index}/expression`, checks),
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
  const declarationIndices = new Map(template.value.derived.map(({ id }, index) => [id, index]));
  const results: Record<string, number> = {};
  for (const field of evaluationOrder.value) {
    const expressionPointer = `/derived/${declarationIndices.get(field.id)}/expression`;
    const baseValue = evaluateExpression(field.expression, expressionPointer, values, checks);
    if (baseValue === undefined) return checks.result({});
    let finalValue = baseValue as number;
    const effect = effectsByTarget.value.get(field.id);
    if (effect) {
      const modified = applyEffectOperation(finalValue, effect.effect);
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
                  pointer: expressionPointer,
                },
              ],
            },
          ],
        };
      }
      finalValue = modified === 0 ? 0 : modified;
    }
    // Downstream field references read the value after effects.
    values.set(field.id, finalValue);
    Object.defineProperty(results, field.id, {
      value: finalValue,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return checks.result(results);
}

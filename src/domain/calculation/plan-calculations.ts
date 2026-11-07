import type { DerivedField, Template } from '../definitions/document-models';
import type { Expression } from '../definitions/expressions';
import type { LocatedDefinition } from '../definition-processing/in-memory-definition-catalog';
import { DefinitionChecks } from '../instances/structural-validation';
import type { ValidationResult } from '../instances/structural-validation';

// Yield field references and their locations from every expression branch.
function* references(
  expression: Expression,
  pointer: string,
): Generator<{ id: string; pointer: string }> {
  switch (expression.op) {
    case 'field':
      yield { id: expression.id, pointer: `${pointer}/id` };
      break;
    case 'floor':
      yield* references(expression.value, `${pointer}/value`);
      break;
    case 'divide':
    case 'multiply':
    case 'equal':
      yield* references(expression.left, `${pointer}/left`);
      yield* references(expression.right, `${pointer}/right`);
      break;
    case 'if':
      yield* references(expression.condition, `${pointer}/condition`);
      yield* references(expression.then, `${pointer}/then`);
      yield* references(expression.else, `${pointer}/else`);
      break;
  }
}

/**
 * Plan evaluation order and diagnose missing references or dependency cycles.
 * @param template Located template that has already passed structural validation.
 * @returns Derived fields ordered so dependencies precede their consumers, or diagnostics.
 */
export function planCalculations(
  template: LocatedDefinition<Template>,
): ValidationResult<readonly DerivedField[]> {
  const checks = new DefinitionChecks(template.document);
  const inputs = new Set(template.value.inputs.map(({ id }) => id));
  const derived = new Map(
    template.value.derived.map((field, index) => [field.id, { field, index }]),
  );
  const active = new Set<string>();
  const visited = new Set<string>();
  const order: DerivedField[] = [];

  // Walk dependencies depth first and append each field after its prerequisites.
  function visit(field: DerivedField, index: number): void {
    if (visited.has(field.id)) return;
    active.add(field.id);
    for (const reference of references(field.expression, `/derived/${index}/expression`)) {
      if (inputs.has(reference.id)) continue;
      const dependency = derived.get(reference.id);
      if (!dependency) {
        checks.issue(reference.pointer, `Unknown field "${reference.id}".`, 'MISSING_REFERENCE');
      } else if (active.has(reference.id)) {
        const cycle = [...active].slice([...active].indexOf(reference.id));
        checks.diagnostics.push({
          code: 'DEPENDENCY_CYCLE',
          document: template.document,
          pointer: reference.pointer,
          message: `Dependency cycle: ${[...cycle, reference.id].join(' -> ')}.`,
          related: cycle.map((id) => ({
            document: template.document,
            pointer: `/derived/${derived.get(id)!.index}/id`,
          })),
        });
      } else {
        visit(dependency.field, dependency.index);
      }
    }
    active.delete(field.id);
    visited.add(field.id);
    order.push(field);
  }

  template.value.derived.forEach(visit);
  return checks.result<readonly DerivedField[]>(order);
}

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

  // Put each dependency walk on the heap so long chains do not exhaust the call stack.
  function frame(field: DerivedField, index: number) {
    return { field, references: references(field.expression, `/derived/${index}/expression`) };
  }

  for (const [index, field] of template.value.derived.entries()) {
    if (visited.has(field.id)) continue;
    const stack = [frame(field, index)];
    active.add(field.id);

    while (stack.length) {
      const current = stack[stack.length - 1];
      const next = current.references.next();
      if (next.done) {
        stack.pop();
        active.delete(current.field.id);
        visited.add(current.field.id);
        order.push(current.field);
        continue;
      }

      const reference = next.value;
      if (inputs.has(reference.id)) continue;
      const dependency = derived.get(reference.id);
      if (!dependency) {
        checks.issue(reference.pointer, `Unknown field "${reference.id}".`, 'MISSING_REFERENCE');
      } else if (active.has(reference.id)) {
        const chain = [...active];
        const cycle = chain.slice(chain.indexOf(reference.id));
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
      } else if (!visited.has(reference.id)) {
        active.add(reference.id);
        stack.push(frame(dependency.field, dependency.index));
      }
    }
  }
  return checks.result<readonly DerivedField[]>(order);
}

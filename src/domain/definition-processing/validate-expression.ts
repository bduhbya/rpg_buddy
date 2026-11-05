import { childPointer } from '../validation';
import type { DefinitionChecks } from '../validation';

/**
 * Check the closed expression syntax in every branch. Reference resolution and type checking happen during calculation.
 * @param value Parsed expression node to check.
 * @param pointer JSON Pointer to the node within the template.
 * @param checks Call-local validator that collects syntax diagnostics.
 */
export function checkExpression(value: unknown, pointer: string, checks: DefinitionChecks): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    checks.issue(pointer, 'Expected an expression object.');
    return;
  }
  const node = value as Record<string, unknown>;
  const at = (key: string) => childPointer(pointer, key);
  // Each operation has a closed set of properties and recursively checked operands.
  switch (node.op) {
    case 'constant':
      checks.object(node, pointer, ['op', 'value']);
      checks.number(node.value, at('value'));
      break;
    case 'field':
      checks.object(node, pointer, ['op', 'id']);
      checks.fieldId(node.id, at('id'));
      break;
    case 'floor':
      checks.object(node, pointer, ['op', 'value']);
      checkExpression(node.value, at('value'), checks);
      break;
    case 'divide':
    case 'multiply':
    case 'equal':
      checks.object(node, pointer, ['op', 'left', 'right']);
      checkExpression(node.left, at('left'), checks);
      checkExpression(node.right, at('right'), checks);
      break;
    case 'if':
      checks.object(node, pointer, ['op', 'condition', 'then', 'else']);
      // Both branches must be well formed, even though evaluation will select only one.
      for (const key of ['condition', 'then', 'else']) checkExpression(node[key], at(key), checks);
      break;
    default:
      checks.issue(
        at('op'),
        'Expected a supported expression operation: constant, field, floor, divide, multiply, equal or if.',
      );
  }
}

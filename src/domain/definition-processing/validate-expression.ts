import type { Template } from '../definitions/document-models';
import type { Expression } from '../definitions/expressions';
import { childPointer } from '../instances/structural-validation';
import type { DefinitionChecks } from '../instances/structural-validation';

const MAX_EXPRESSION_DEPTH = 128;

/**
 * Check expression syntax and nesting depth before dependency and type checks.
 * @param value Parsed expression node to check.
 * @param pointer JSON Pointer to the node within the template.
 * @param checks Call-local validator that collects syntax and nesting diagnostics.
 */
export function checkExpression(value: unknown, pointer: string, checks: DefinitionChecks): void {
  checkExpressionNode(value, pointer, checks, 1);
}

// Validate one node and stop before nesting can overflow validation or catalog cloning.
function checkExpressionNode(
  value: unknown,
  pointer: string,
  checks: DefinitionChecks,
  depth: number,
): void {
  if (depth > MAX_EXPRESSION_DEPTH) {
    checks.issue(
      pointer,
      `This formula is too deeply nested. Simplify it to at most ${MAX_EXPRESSION_DEPTH} expression levels, including the outermost expression.`,
      'INVALID_VALUE',
    );
    return;
  }

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
      checkExpressionNode(node.value, at('value'), checks, depth + 1);
      break;
    case 'divide':
    case 'multiply':
    case 'equal':
      checks.object(node, pointer, ['op', 'left', 'right']);
      checkExpressionNode(node.left, at('left'), checks, depth + 1);
      checkExpressionNode(node.right, at('right'), checks, depth + 1);
      break;
    case 'if':
      checks.object(node, pointer, ['op', 'condition', 'then', 'else']);
      // Both branches must be well formed, even though evaluation will select only one.
      for (const key of ['condition', 'then', 'else'])
        checkExpressionNode(node[key], at(key), checks, depth + 1);
      break;
    default:
      checks.issue(
        at('op'),
        'Expected a supported expression operation: constant, field, floor, divide, multiply, equal or if.',
      );
  }
}

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

/**
 * Check types throughout each structurally valid derived expression.
 * @param template Structurally validated template.
 * @param checks Collector that receives diagnostics for mismatched expression types.
 */
export function checkDerivedExpressionTypes(template: Template, checks: DefinitionChecks): void {
  template.derived.forEach((field, index) =>
    checkExpressionType(field.expression, 'number', `/derived/${index}/expression`, checks),
  );
}

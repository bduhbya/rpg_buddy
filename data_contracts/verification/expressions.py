"""Bounded arithmetic traces for contract fixtures, not a production engine.

Keep this limited to the already specified expression subset. New game rules
belong in data and production TypeScript tests, not Python-specific behavior.
"""
from __future__ import annotations

import math
from collections.abc import Mapping

from .helpers import ContractViolation, require, safe_number
from .models import Expression, ExpressionType, Number, Statistics, Template


def expression_type(
    expression: Expression, field_ids: set[str], references: set[str],
) -> ExpressionType:
    """Check all branches and collect even unchosen-branch dependencies."""
    if expression['op'] == 'constant':
        safe_number(expression['value'])
        return 'number'
    if expression['op'] == 'field':
        field_id = expression['id']
        require(field_id in field_ids, f'Missing field reference: {field_id}')
        references.add(field_id)
        return 'number'
    if expression['op'] == 'floor':
        operand_type = expression_type(expression['value'], field_ids, references)
        require(operand_type == 'number', 'floor requires a numeric operand')
        return 'number'
    if expression['op'] == 'if':
        condition_type = expression_type(expression['condition'], field_ids, references)
        then_type = expression_type(expression['then'], field_ids, references)
        else_type = expression_type(expression['else'], field_ids, references)
        require(condition_type == 'boolean', 'if requires a boolean condition')
        require(then_type == else_type == 'number', 'if branches must be numeric')
        return 'number'
    left_type = expression_type(expression['left'], field_ids, references)
    right_type = expression_type(expression['right'], field_ids, references)
    require(left_type == right_type == 'number', 'Binary operands must be numeric')
    return 'boolean' if expression['op'] == 'equal' else 'number'


def reject_dependency_cycles(dependencies: Mapping[str, set[str]]) -> None:
    completed: set[str] = set()
    active_path: set[str] = set()

    def visit(field_id: str) -> None:
        require(field_id not in active_path, f'Dependency cycle at {field_id}')
        if field_id in completed:
            return
        active_path.add(field_id)
        for dependency in dependencies.get(field_id, set()):
            visit(dependency)
        active_path.remove(field_id)
        completed.add(field_id)

    for field_id in dependencies:
        visit(field_id)


def trace_statistics(
    template: Template,
    source_values: Mapping[str, Number],
    modifiers: Mapping[str, Number],
) -> Statistics:
    """Trace a validated fixture: base formula, then its explicit effect once.

    The local cache is discarded on return. Dependents see final modified values.
    This function is used only after ContractVerifier has checked the documents.
    """
    values = dict(source_values)
    expressions = {field['id']: field['expression'] for field in template['derived']}

    def field_value(field_id: str) -> Number:
        if field_id not in values:
            base_value = safe_number(evaluate_expression(expressions[field_id]))
            values[field_id] = safe_number(base_value * modifiers.get(field_id, 1))
        return values[field_id]

    def evaluate_expression(expression: Expression) -> Number | bool:
        if expression['op'] == 'constant':
            return safe_number(expression['value'])
        if expression['op'] == 'field':
            return field_value(expression['id'])
        if expression['op'] == 'if':
            condition = evaluate_expression(expression['condition'])
            branch = expression['then'] if condition else expression['else']
            return evaluate_expression(branch)
        if expression['op'] == 'floor':
            operand = safe_number(evaluate_expression(expression['value']))
            return safe_number(math.floor(operand))
        left = safe_number(evaluate_expression(expression['left']))
        right = safe_number(evaluate_expression(expression['right']))
        if expression['op'] == 'equal':
            return left == right
        if expression['op'] == 'multiply':
            return safe_number(left * right)
        if expression['op'] == 'divide':
            require(right != 0, 'Division by zero')
            return safe_number(left / right)
        raise ContractViolation('Unsupported expression operation')

    return {field['id']: field_value(field['id']) for field in template['derived']}

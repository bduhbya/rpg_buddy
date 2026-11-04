"""Expression type, reference and cycle checks for authored contract documents.

Arithmetic acceptance is owned by the production TypeScript engine tests.
"""
from __future__ import annotations

from collections.abc import Mapping

from .helpers import require, safe_number
from .models import Expression, ExpressionType


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

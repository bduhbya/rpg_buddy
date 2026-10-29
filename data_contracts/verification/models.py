"""Typed document shapes after schema validation; not runtime validation.

RawDocument is deliberately permissive at JSON/schema boundaries and in tests
that construct malformed data. Domain checks use the TypedDict shapes below.
"""
from __future__ import annotations

from typing import Any, Literal, NotRequired, TypeAlias, TypedDict

Number: TypeAlias = int | float
JsonValue: TypeAlias = None | bool | int | float | str | list['JsonValue'] | dict[str, 'JsonValue']
RawDocument: TypeAlias = dict[str, Any]
ExpressionType: TypeAlias = Literal['number', 'boolean']
BinaryOperation: TypeAlias = Literal['divide', 'multiply', 'equal']
Statistics: TypeAlias = dict[str, Number]
Movement: TypeAlias = tuple[Number, Number, Number, Number]


class Metadata(TypedDict, total=False):
    sourceReview: str
    requirementRefs: list[str]
    sourceRegisterRefs: list[str]


class DefinitionReference(TypedDict):
    id: str
    version: str


class ConstantExpression(TypedDict):
    op: Literal['constant']
    value: Number


class FieldExpression(TypedDict):
    op: Literal['field']
    id: str


class FloorExpression(TypedDict):
    op: Literal['floor']
    value: Expression


class BinaryExpression(TypedDict):
    op: BinaryOperation
    left: Expression
    right: Expression


ConditionalExpression = TypedDict('ConditionalExpression', {
    'op': Literal['if'],
    'condition': 'Expression',
    'then': 'Expression',
    'else': 'Expression',
})
Expression: TypeAlias = (
    ConstantExpression | FieldExpression | FloorExpression
    | BinaryExpression | ConditionalExpression
)


class InputField(TypedDict):
    id: str
    label: str
    type: Literal['integer']
    sourceRefs: list[str]
    default: int
    minimum: int
    maximum: int
    metadata: NotRequired[Metadata]


class DerivedField(TypedDict):
    id: str
    label: str
    type: Literal['number']
    sourceRefs: list[str]
    expression: Expression
    unit: NotRequired[str]
    metadata: NotRequired[Metadata]


class Section(TypedDict):
    id: str
    label: str
    fields: list[str]


class Template(TypedDict):
    schemaVersion: Literal[1]
    id: str
    version: str
    system: DefinitionReference
    entityType: str
    label: str
    defaultDisplayName: str
    sections: list[Section]
    inputs: list[InputField]
    derived: list[DerivedField]
    modifierTargets: list[str]
    metadata: NotRequired[Metadata]


class MultiplyEffect(TypedDict):
    op: Literal['multiply']
    target: str
    factor: int


class Entry(TypedDict):
    id: str
    category: str
    label: str
    description: str
    effects: list[MultiplyEffect]
    source: NotRequired[str]
    metadata: NotRequired[Metadata]


class Instance(TypedDict):
    schemaVersion: Literal[1]
    id: str
    entityType: str
    role: Literal['character', 'monster']
    system: DefinitionReference
    template: DefinitionReference
    displayName: str
    values: dict[str, int]
    entries: list[Entry]
    createdAt: str
    modifiedAt: str
    career: NotRequired[str]
    metadata: NotRequired[Metadata]


class Source(TypedDict):
    designation: str
    isbn: str
    sha256: str


class Manifest(TypedDict):
    schemaVersion: Literal[1]
    id: str
    version: str
    label: str
    source: Source
    templates: list[DefinitionReference]

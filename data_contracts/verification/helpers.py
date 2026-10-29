"""Strict JSON loading and shared numeric checks; no file writes."""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import NoReturn, cast

from .models import JsonValue, Number, RawDocument

DATA_CONTRACTS = Path(__file__).resolve().parents[1]
MAX_SAFE_INTEGER = 2**53 - 1


class ContractViolation(ValueError):
    """A document violates a semantic rule not expressible in JSON Schema."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ContractViolation(message)


def parse_json(text: str) -> JsonValue:
    """Reject duplicate object keys and the non-JSON NaN/Infinity tokens."""
    def unique_object(pairs: list[tuple[str, JsonValue]]) -> dict[str, JsonValue]:
        result: dict[str, JsonValue] = {}
        for key, value in pairs:
            require(key not in result, f'Duplicate JSON key: {key}')
            result[key] = value
        return result

    def reject_non_json_number(token: str) -> NoReturn:
        raise ContractViolation(f'Invalid JSON numeric token: {token}')

    # json.loads is the untyped external boundary. Shape checks follow separately.
    return cast(JsonValue, json.loads(
        text, object_pairs_hook=unique_object, parse_constant=reject_non_json_number,
    ))


def read_json(path: Path) -> RawDocument:
    document = parse_json(path.read_text(encoding='utf-8'))
    require(isinstance(document, dict), f'Expected a JSON object in {path}')
    return cast(RawDocument, document)


def safe_number(value: object) -> Number:
    """Match the contract's finite binary64 / safe-integer numeric boundary."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ContractViolation(f'Expected a number, received {value!r}')
    require(math.isfinite(value), f'Number must be finite: {value!r}')
    if float(value).is_integer():
        require(abs(value) <= MAX_SAFE_INTEGER, f'Unsafe integer: {value!r}')
    return 0 if value == 0 else value

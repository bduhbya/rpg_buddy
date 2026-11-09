"""Fixture loading and test builders, including deliberately malformed JSON.

RawDocument is appropriate here because rejection tests must construct invalid
shapes. Accepted documents are narrowed by ContractVerifier after schema checks.
"""
from __future__ import annotations

import copy
import unittest
from collections.abc import Sequence

from jsonschema import ValidationError

from ..helpers import DATA_CONTRACTS, ContractViolation, read_json
from ..models import RawDocument
from ..validation import ContractVerifier


def trait(entry_id: str, target: str, factor: object = 2) -> RawDocument:
    return {
        'id': entry_id, 'category': 'trait', 'label': entry_id,
        'description': 'User-selected feature',
        'effects': [{'op': 'multiply', 'target': target, 'factor': factor}],
    }


def replace_value(document: RawDocument, path: Sequence[str], value: object) -> None:
    """Edit malformed test input using an explicit sequence of object keys."""
    container = document
    for key in path[:-1]:
        container = container[key]
    container[path[-1]] = value


class ContractTestCase(unittest.TestCase):
    """Shared fixtures only; test methods live in the focused test modules."""
    verifier: ContractVerifier
    manifest: RawDocument
    template: RawDocument
    character: RawDocument
    monster: RawDocument
    sheet: RawDocument
    explorator: RawDocument
    ork: RawDocument

    @classmethod
    def setUpClass(cls) -> None:
        cls.verifier = ContractVerifier()
        examples = DATA_CONTRACTS / 'examples/v2'
        cls.manifest = read_json(examples / 'system.json')
        cls.template = read_json(examples / 'templates/creature-core/1.0.1/template.json')
        cls.character = read_json(examples / 'explorator.instance.json')
        cls.monster = read_json(examples / 'ork-freebooter.instance.json')

    def setUp(self) -> None:
        # Each case gets its own copies, so order cannot change the fixtures.
        self.sheet = copy.deepcopy(self.template)
        self.explorator = copy.deepcopy(self.character)
        self.ork = copy.deepcopy(self.monster)

    def assert_invalid_instance(self, instance: RawDocument) -> None:
        # Programming errors such as KeyError are not successful rejections.
        with self.assertRaises((ContractViolation, ValidationError)):
            self.verifier.validate_sheet(instance, self.sheet, self.manifest)

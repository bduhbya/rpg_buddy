"""Snapshot contract integrity; arithmetic acceptance lives in TypeScript."""
from __future__ import annotations

import copy

from jsonschema import ValidationError

from ..helpers import ContractViolation
from ..models import RawDocument
from .support import ContractTestCase, trait

class FeatureTests(ContractTestCase):
    def test_invalid_modifier_targets_and_factors(self) -> None:
            """Reject undeclared/input targets and nonpositive, fractional or unsafe factors."""
            for target in ("absent", "strength", "agilityBonus"):
                with self.subTest(target=target):
                    instance = copy.deepcopy(self.character)
                    instance["entries"] = [trait("custom", target)]
                    self.assert_invalid_instance(instance)
            for factor in (0, -1, 1.5, "2", True, None, float("inf"), 2**53):
                with self.subTest(factor=repr(factor)):
                    instance = copy.deepcopy(self.character)
                    instance["entries"] = [trait("custom", "toughnessBonus", factor)]
                    self.assert_invalid_instance(instance)

    def test_invalid_entry_structure_and_conflicts(self) -> None:
            """Reject duplicate entry IDs, conflicting effects and executable additions."""
            duplicate_effect = trait("one", "strengthBonus")
            duplicate_effect["effects"].append(copy.deepcopy(duplicate_effect["effects"][0]))
            executable = trait("one", "strengthBonus")
            executable["effects"][0]["op"] = "execute"
            extra_expression = trait("one", "strengthBonus")
            extra_expression["effects"][0]["expression"] = {"op": "constant", "value": 999}
            cases: list[tuple[str, list[RawDocument]]] = [
                ("duplicate entry IDs", [trait("same", "strengthBonus"), trait("same", "toughnessBonus")]),
                ("conflict across entries", [trait("one", "strengthBonus"), trait("two", "strengthBonus")]),
                ("conflict inside entry", [duplicate_effect]),
                ("unsupported effect operation", [executable]),
                ("extra executable expression", [extra_expression]),
            ]
            for name, entries in cases:
                with self.subTest(scenario=name):
                    instance = copy.deepcopy(self.character)
                    instance["entries"] = entries
                    self.assert_invalid_instance(instance)
            for name, key, value in (("blank career", "career", " "),
                                     ("unsupported role", "role", "voidship")):
                with self.subTest(scenario=name):
                    instance = copy.deepcopy(self.character)
                    instance[key] = value
                    self.assert_invalid_instance(instance)
            with self.subTest(scenario="missing entries"):
                del self.explorator["entries"]
                self.assert_invalid_instance(self.explorator)

    def test_invalid_modifier_declarations(self) -> None:
            """Reject bad template allowlists, retired kind and disabled effects."""
            for targets in (["strength"], ["missing"], ["strengthBonus", "strengthBonus"]):
                with self.subTest(targets=targets):
                    template = copy.deepcopy(self.template)
                    template["modifierTargets"] = targets
                    with self.assertRaises((ContractViolation, ValidationError)):
                        self.verifier.validate_template(template)
            with self.subTest(scenario="retired template kind"):
                self.sheet["kind"] = "monster"
                with self.assertRaises(ValidationError):
                    self.verifier.validate_template(self.sheet)
                del self.sheet["kind"]
            with self.subTest(scenario="all modifiers disabled"):
                self.sheet["modifierTargets"] = []
                self.assert_invalid_instance(self.ork)

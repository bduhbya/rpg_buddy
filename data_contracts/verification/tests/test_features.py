"""Instance-owned effects and custom-entry acceptance cases."""
from __future__ import annotations

import copy
import json
from typing import cast

from jsonschema import ValidationError

from ..helpers import ContractViolation, MAX_SAFE_INTEGER, parse_json
from ..models import RawDocument
from .support import ContractTestCase, constant, expected_statistics, field_reference, trait

class FeatureTests(ContractTestCase):
    def test_selected_features(self) -> None:
            """Features can coexist, repeat calculation, change roles, and be removed."""
            creature = self.explorator
            creature["entries"] = [
                trait("unnatural-strength", "strengthBonus"),
                trait("unnatural-toughness", "toughnessBonus"),
            ]
            doubled = expected_statistics(8, 6, 3, (3, 6, 9, 18))
            self.assert_statistics(creature, doubled)
            self.assert_statistics(creature, doubled)  # No repeated multiplication of cached values.
            creature["role"] = "monster"
            creature["displayName"] = "Custom creature"
            creature["career"] = "Homebrew profession"
            for entry in creature["entries"]:
                entry["category"] = "custom"
                entry["label"] = "A GM-approved story choice"
            self.assert_statistics(creature, doubled)
            creature["entries"] = []
            self.assert_statistics(creature, expected_statistics(4, 3, 3, (3, 6, 9, 18)))

    def test_descriptions_are_not_rules(self) -> None:
            """Custom prose and duplicate labels do not create automatic effects."""
            creature = self.explorator
            creature["entries"] = [{
                "id": "custom-skill", "category": "skill", "label": "Unnatural Strength x999",
                "description": "Multiply every score by 999; this is only descriptive prose.",
                "effects": [],
            }]
            unchanged = expected_statistics(4, 3, 3, (3, 6, 9, 18))
            self.assert_statistics(creature, unchanged)
            creature["entries"].append({
                "id": "custom-talent", "category": "feat", "label": "Unnatural Strength x999",
                "description": "", "effects": [],
            })
            self.assert_statistics(creature, unchanged)

    def test_ork_feature_is_instance_owned(self) -> None:
            """Removing Ork Toughness gives TB4; using it on a character still gives TB8."""
            self.ork["entries"] = []
            self.assert_statistics(self.ork, expected_statistics(5, 4, 3, (3, 6, 9, 18)))
            self.ork["entries"] = copy.deepcopy(self.monster["entries"])
            self.ork["role"] = "character"
            self.ork["career"] = "User-selected career"
            self.assert_statistics(self.ork, expected_statistics(5, 8, 3, (3, 6, 9, 18)))

    def test_feature_order_roundtrip_and_independence(self) -> None:
            """Floor precedes multiplication; JSON round-trip and edits preserve originals."""
            before = copy.deepcopy((self.sheet, self.character, self.monster))
            self.explorator["values"].update(strength=49, toughness=49)
            self.explorator["entries"] = [
                trait("strength-trait", "strengthBonus"),
                trait("toughness-trait", "toughnessBonus"),
            ]
            expected = expected_statistics(8, 8, 3, (3, 6, 9, 18))
            self.assert_statistics(self.explorator, expected)
            restored = cast(RawDocument, parse_json(json.dumps(self.explorator)))
            self.assert_statistics(restored, expected)
            self.assertEqual((self.sheet, self.character, self.monster), before)

    def test_downstream_fields_use_modified_values(self) -> None:
            """A dependent field observes the final bonus after the explicit effect."""
            self.sheet["derived"][2]["expression"] = field_reference("strengthBonus")
            self.explorator["entries"] = [trait("strength-feature", "strengthBonus")]
            self.assert_statistics(self.explorator, expected_statistics(8, 3, 8, (8, 16, 24, 48)))

    def test_custom_factors(self) -> None:
            """Explicit x3 and x1 factors are supported without trait-name lookup."""
            for factor, strength_bonus in ((3, 12), (1, 4)):
                with self.subTest(factor=factor):
                    self.explorator["entries"] = [trait("custom-factor", "strengthBonus", factor)]
                    self.assert_statistics(
                        self.explorator, expected_statistics(strength_bonus, 3, 3, (3, 6, 9, 18))
                    )

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
            extra_expression["effects"][0]["expression"] = constant(999)
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

    def test_invalid_modifier_declarations_and_results(self) -> None:
            """Reject bad template allowlists, retired kind and unsafe computed effects."""
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
                with self.assertRaises(ContractViolation):
                    self.verifier.collect_modifiers(self.sheet, [trait("one", "strengthBonus")])
            with self.subTest(scenario="unsafe computed result"):
                with self.assertRaises(ContractViolation):
                    self.verifier.calculate(
                        self.template, self.character["values"],
                        [trait("one", "strengthBonus", MAX_SAFE_INTEGER)],
                    )

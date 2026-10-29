"""Independent expected arithmetic for the bounded contract fixtures."""
from __future__ import annotations

import copy

from jsonschema import ValidationError

from ..helpers import ContractViolation
from ..models import Movement, Number, RawDocument
from .support import ContractTestCase, binary, constant, expected_statistics, field_reference

class CalculationTests(ContractTestCase):
    def test_zero_defaults(self) -> None:
            """A fresh creature starts with nine zero attributes and zero-row movement."""
            defaults = {field["id"]: field["default"] for field in self.sheet["inputs"]}
            self.assertEqual(defaults, dict.fromkeys(defaults, 0))
            self.explorator["values"] = defaults
            self.explorator["entries"] = []
            self.assert_statistics(self.explorator, expected_statistics(0, 0, 0, (0.5, 1, 2, 3)))

    def test_worked_rule_examples(self) -> None:
            """C1/M1/C2/M2 retain their worked instance values, independent of defaults."""
            cases: list[tuple[str, RawDocument, dict[str, int], tuple[Number, Number, Number, Movement]]] = [
                ("C1: Explorator", self.character, {}, (4, 3, 3, (3, 6, 9, 18))),
                ("M1: Ork", self.monster, {}, (5, 8, 3, (3, 6, 9, 18))),
                ("C2: Agility 40", self.character, {"agility": 40}, (4, 3, 4, (4, 8, 12, 24))),
                ("M2: Toughness 50", self.monster, {"toughness": 50}, (5, 10, 3, (3, 6, 9, 18))),
                ("M2: Toughness 49", self.monster, {"toughness": 49}, (5, 8, 3, (3, 6, 9, 18))),
            ]
            for name, original, edits, expected in cases:
                with self.subTest(scenario=name):
                    instance = copy.deepcopy(original)
                    instance["values"].update(edits)
                    self.assert_statistics(instance, expected_statistics(*expected))

    def test_numeric_boundaries(self) -> None:
            """B1: six boundary scores work for both unmodified and Ork trait bonuses."""
            boundaries: list[tuple[int, int, Movement]] = [
                (0, 0, (0.5, 1, 2, 3)),
                (9, 0, (0.5, 1, 2, 3)),
                (10, 1, (1, 2, 3, 6)),
                (39, 3, (3, 6, 9, 18)),
                (40, 4, (4, 8, 12, 24)),
                (99, 9, (9, 18, 27, 54)),
            ]
            # Expected multipliers are independent test facts, not engine role logic.
            for original, toughness_factor in ((self.character, 1), (self.monster, 2)):
                for score, bonus, movement in boundaries:
                    with self.subTest(instance=original["displayName"], score=score):
                        instance = copy.deepcopy(original)
                        instance["values"].update(strength=score, toughness=score, agility=score)
                        expected = expected_statistics(bonus, bonus * toughness_factor, bonus, movement)
                        self.assert_statistics(instance, expected)

    def test_if_evaluates_only_chosen_branch(self) -> None:
            """An unchosen division by zero is not executed, but is still type-checked."""
            self.sheet["derived"][0]["expression"] = {
                "op": "if", "condition": binary("equal", constant(1), constant(1)),
                "then": constant(4), "else": binary("divide", constant(1), constant(0)),
            }
            self.assert_statistics(self.explorator, expected_statistics(4, 3, 3, (3, 6, 9, 18)))

    def test_invalid_expressions(self) -> None:
            """Reject missing/circular references, wrong types and malformed operations."""
            cases: list[tuple[str, RawDocument]] = [
                ("missing reference", field_reference("absent")),
                ("self-reference", field_reference("strengthBonus")),
                ("boolean literal", constant(True)),
                ("executable operation", {"op": "exec", "value": "code"}),
                ("missing operand", {"op": "multiply", "left": constant(1)}),
                ("unsafe integer literal", constant(2**53)),
                ("boolean result", binary("equal", constant(1), constant(1))),
                ("unknown property", {"op": "constant", "value": 1, "extra": 2}),
            ]
            for name, expression in cases:
                with self.subTest(scenario=name):
                    template = copy.deepcopy(self.template)
                    template["derived"][0]["expression"] = expression
                    with self.assertRaises((ContractViolation, ValidationError)):
                        self.verifier.validate_template(template)

    def test_invalid_arithmetic(self) -> None:
            """Reject division by zero and unsafe numeric literals before using results."""
            cases: list[tuple[str, RawDocument]] = [
                ("zero divisor", binary("divide", constant(1), constant(0))),
                ("unsafe large literal", binary("multiply", constant(1.1e308), constant(1.1e308))),
            ]
            for name, expression in cases:
                with self.subTest(scenario=name):
                    template = copy.deepcopy(self.template)
                    template["derived"][0]["expression"] = expression
                    with self.assertRaises(ContractViolation):
                        self.verifier.calculate(template, self.character["values"])

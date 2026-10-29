"""File structure, identity, provenance and semantic rejection checks."""
from __future__ import annotations

import copy
import json
from typing import cast

from jsonschema import ValidationError

from ..helpers import ContractViolation, parse_json
from ..models import JsonValue, RawDocument, Statistics
from .support import ContractTestCase, expected_statistics, field_reference, replace_value

class ContractSchemaTests(ContractTestCase):
    def test_schema_and_fixture_links(self) -> None:
            """Three schemas and four fixtures agree on one shared creature template."""
            self.verifier.validators["system"].validate(self.manifest)
            self.verifier.validate_template(self.sheet)
            pairs = [(item["id"], item["version"]) for item in self.manifest["templates"]]
            self.assertEqual(len(pairs), len(set(pairs)))
            self.assertEqual(pairs, [(self.sheet["id"], self.sheet["version"])])
            self.assertEqual(len(self.sheet["inputs"]), 9)
            self.assertEqual(len(self.sheet["derived"]), 7)
            for instance in (self.explorator, self.ork):
                with self.subTest(instance=instance["displayName"]):
                    self.verifier.validate_instance(instance, self.sheet, self.manifest)

    def test_development_metadata_is_optional_and_inert(self) -> None:
            """Development provenance can be removed or changed without changing rules."""
            def remove_metadata(value: JsonValue) -> JsonValue:
                if isinstance(value, dict):
                    return {
                        key: remove_metadata(item)
                        for key, item in value.items()
                        if key != "metadata"
                    }
                if isinstance(value, list):
                    return [remove_metadata(item) for item in value]
                return value

            template = cast(RawDocument, remove_metadata(self.sheet))
            self.verifier.validate_template(template)
            cases: list[tuple[RawDocument, Statistics]] = [
                (self.explorator, expected_statistics(4, 3, 3, (3, 6, 9, 18))),
                (self.ork, expected_statistics(5, 8, 3, (3, 6, 9, 18))),
            ]
            for original, expected in cases:
                with self.subTest(instance=original["displayName"]):
                    instance = cast(RawDocument, remove_metadata(original))
                    self.assert_statistics(instance, expected, template=template)
                    instance["metadata"] = {"requirementRefs": ["Documentary text only"]}
                    for entry in instance["entries"]:
                        entry["metadata"] = {"sourceRegisterRefs": ["Multiply by 999"]}
                    template["metadata"] = {"sourceReview": "No such document is needed"}
                    self.assert_statistics(instance, expected, template=template)

            entry = self.ork["entries"][0]
            self.assertIn("Rogue Trader", entry["source"])
            self.assertNotIn("Phase", entry["source"])
            self.assertIn("S6", entry["metadata"]["sourceRegisterRefs"])
            for field in self.sheet["inputs"] + self.sheet["derived"]:
                for citation in field["sourceRefs"]:
                    self.assertIn("Rogue Trader", citation)
                    self.assertNotIn("Phase", citation)

    def test_invalid_development_metadata(self) -> None:
            """Optional metadata stays closed and validates reference types when supplied."""
            invalid_metadata: list[tuple[str, object]] = [
                ("not an object", "development notes"),
                ("unknown property", {"execute": "code"}),
                ("blank review", {"sourceReview": " "}),
                ("references not an array", {"requirementRefs": "DC-8"}),
                ("blank register reference", {"sourceRegisterRefs": [" "]}),
            ]
            for name, metadata in invalid_metadata:
                with self.subTest(scenario=name):
                    instance = copy.deepcopy(self.character)
                    instance["metadata"] = metadata
                    self.assert_invalid_instance(instance)
                    instance = copy.deepcopy(self.monster)
                    instance["entries"][0]["metadata"] = metadata
                    self.assert_invalid_instance(instance)
                    template = copy.deepcopy(self.template)
                    template["metadata"] = metadata
                    with self.assertRaises(ValidationError):
                        self.verifier.validate_template(template)
                    template = copy.deepcopy(self.template)
                    template["inputs"][0]["metadata"] = metadata
                    with self.assertRaises(ValidationError):
                        self.verifier.validate_template(template)
                    template = copy.deepcopy(self.template)
                    template["derived"][0]["metadata"] = metadata
                    with self.assertRaises(ValidationError):
                        self.verifier.validate_template(template)

    def test_invalid_core_values(self) -> None:
            """Reject null, text, fractions, negatives, 100+, booleans, Infinity and NaN."""
            invalid_values: list[tuple[str, object]] = [
                ("null", None), ("numeric text", "34"), ("fraction", 34.5),
                ("negative", -1), ("out of range", 100), ("boolean", True),
                ("infinity", float("inf")), ("NaN", float("nan")),
            ]
            for name, value in invalid_values:
                with self.subTest(scenario=name):
                    instance = copy.deepcopy(self.character)
                    instance["values"]["agility"] = value
                    self.assert_invalid_instance(instance)

    def test_invalid_instance_metadata(self) -> None:
            """Reject incorrect identity, timestamps, names and editable-field keys."""
            edits: list[tuple[str, tuple[str, ...], object]] = [
                ("extra editable field", ("values", "derived"), 3),
                ("blank display name", ("displayName",), "  "),
                ("unsupported schema", ("schemaVersion",), 2),
                ("wrong entity type", ("entityType",), "voidship"),
                ("wrong template version", ("template", "version"), "2.0.0"),
                ("wrong system version", ("system", "version"), "2.0.0"),
                ("invalid calendar date", ("createdAt",), "2026-02-30T00:00:00Z"),
                ("modification before creation", ("modifiedAt",), "2025-01-01T00:00:00Z"),
                ("non-Z time zone", ("modifiedAt",), "2026-10-28T18:00:00+00:00"),
                ("saved derived output", ("derived",), {}),
            ]
            for name, path, value in edits:
                with self.subTest(scenario=name):
                    instance = copy.deepcopy(self.character)
                    replace_value(instance, path, value)
                    self.assert_invalid_instance(instance)
            with self.subTest(scenario="missing editable field"):
                del self.explorator["values"]["agility"]
                self.assert_invalid_instance(self.explorator)

    def test_invalid_template_structure_and_dependencies(self) -> None:
            """Reject invalid defaults, section membership, duplicate IDs and cycles."""
            for name in ("default outside bounds", "duplicate section member", "duplicate field ID",
                         "cycle in unchosen branch", "mutual cycle"):
                with self.subTest(scenario=name):
                    template = copy.deepcopy(self.template)
                    if name == "default outside bounds":
                        template["inputs"][0]["default"] = 100
                    elif name == "duplicate section member":
                        template["sections"][0]["fields"].append("agility")
                    elif name == "duplicate field ID":
                        template["inputs"][1]["id"] = "weaponSkill"
                    elif name == "cycle in unchosen branch":
                        template["derived"][3]["expression"]["else"] = field_reference("halfMove")
                    else:
                        template["derived"][0]["expression"] = field_reference("toughnessBonus")
                        template["derived"][1]["expression"] = field_reference("strengthBonus")
                    with self.assertRaises((ContractViolation, ValidationError)):
                        self.verifier.validate_template(template)

    def test_invalid_json(self) -> None:
            """Reject duplicate object keys, NaN, Infinity and malformed JSON."""
            cases: list[tuple[str, str]] = [
                ("duplicate key", '{"a":1,"a":2}'), ("NaN", '{"a":NaN}'),
                ("Infinity", '{"a":Infinity}'), ("malformed", '{broken'),
            ]
            for name, text in cases:
                with self.subTest(scenario=name):
                    with self.assertRaises((ContractViolation, json.JSONDecodeError)):
                        parse_json(text)

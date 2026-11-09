"""File structure, identity, provenance and semantic rejection checks."""
from __future__ import annotations

import copy
import json
from typing import cast

from jsonschema import ValidationError

from ..helpers import ContractViolation, parse_json
from ..models import JsonValue, RawDocument
from .support import ContractTestCase, replace_value, trait

class ContractSchemaTests(ContractTestCase):
    def test_v2_sheet_snapshots(self) -> None:
        """Both roles carry independently readable, exact-template snapshots."""
        for document, role, toughness_bonus in (
            (self.explorator, 'character', 3),
            (self.ork, 'monster', 8),
        ):
            with self.subTest(role=role):
                sheet = self.verifier.validate_sheet_snapshot(document)
                self.assertEqual(sheet['role'], role)
                self.assertEqual(sheet['derived']['toughnessBonus'], toughness_bonus)
                self.assertEqual(sheet['presentation']['fields']['halfMove']['unit'], 'metres/round')
                self.assertEqual(
                    self.verifier.validate_sheet(document, self.sheet, self.manifest),
                    sheet,
                )

        document['createdAt'] = document['modifiedAt'] = '0000-02-29T00:00:00Z'
        self.verifier.validate_sheet_snapshot(document)

    def test_invalid_v2_sheet_snapshots(self) -> None:
        """Reject malformed snapshots independently of definitions."""
        original = self.ork
        original['createdAt'] = original['modifiedAt'] = '2026-10-28T18:00:00.0000002Z'
        for name, path, value in (
            ('missing result keys', ('derived',), {}),
            ('unknown result key', ('derived', 'otherBonus'), 1),
            ('overlapping value maps', ('derived', 'strength'), 5),
            ('nonfinite result', ('derived', 'toughnessBonus'), float('inf')),
            ('unsafe result', ('derived', 'toughnessBonus'), 10**400),
            ('boolean result', ('derived', 'toughnessBonus'), True),
            ('unsafe input', ('values', 'toughness'), 2**53),
            ('modification before creation by a fraction', ('modifiedAt',),
             '2026-10-28T18:00:00.0000001Z'),
            ('invalid calendar date', ('createdAt',), '0000-02-30T00:00:00Z'),
            ('blank label', ('presentation', 'fields', 'toughness', 'label'), ' '),
            ('editable unit', ('presentation', 'fields', 'toughness', 'unit'), 'points'),
            ('effect targets source field', ('entries',), [trait('invalid', 'toughness')]),
            ('conflicting effects', ('entries',), [trait('one', 'strengthBonus'),
                                                    trait('two', 'strengthBonus')]),
        ):
            with self.subTest(scenario=name):
                document = copy.deepcopy(original)
                replace_value(document, path, value)
                with self.assertRaises((ContractViolation, ValidationError)):
                    self.verifier.validate_sheet_snapshot(document)

        for key in ('derived', 'presentation'):
            with self.subTest(missing=key):
                document = copy.deepcopy(original)
                del document[key]
                with self.assertRaises(ValidationError):
                    self.verifier.validate_sheet_snapshot(document)

        for edit in ('repeat section ID', 'repeat field ID'):
            with self.subTest(scenario=edit):
                document = copy.deepcopy(original)
                sections = document['presentation']['sections']
                if edit == 'repeat section ID':
                    sections[1]['id'] = sections[0]['id']
                else:
                    sections[0]['fields'][0] = sections[0]['fields'][1]
                with self.assertRaises(ContractViolation):
                    self.verifier.validate_sheet_snapshot(document)

    def test_v2_sheet_rejects_empty_value_maps(self) -> None:
        """Both kinds of values are required even if presentation matches the remaining fields."""
        for bucket in ('values', 'derived'):
            with self.subTest(bucket=bucket):
                document = copy.deepcopy(self.explorator)
                removed = set(document[bucket])
                document[bucket] = {}
                presentation = document['presentation']
                for field_id in removed:
                    del presentation['fields'][field_id]
                for section in presentation['sections']:
                    section['fields'] = [key for key in section['fields'] if key not in removed]
                presentation['sections'] = [
                    section for section in presentation['sections'] if section['fields']
                ]
                with self.assertRaises(ValidationError):
                    self.verifier.validate_sheet_snapshot(document)

    def test_v2_sheet_rejects_field_ids_with_trailing_newlines(self) -> None:
        """A matching value and presentation ID still must use the supported field syntax."""
        for bucket, field_id in (('values', 'toughness'), ('derived', 'toughnessBonus')):
            with self.subTest(bucket=bucket):
                document = copy.deepcopy(self.explorator)
                invalid_id = field_id + '\n'
                document[bucket][invalid_id] = document[bucket].pop(field_id)
                presentation = document['presentation']
                fields = presentation['fields']
                fields[invalid_id] = fields.pop(field_id)
                for section in presentation['sections']:
                    section['fields'] = [
                        invalid_id if key == field_id else key for key in section['fields']
                    ]
                with self.assertRaises(ValidationError):
                    self.verifier.validate_sheet_snapshot(document)

    def test_v2_template_rejects_field_ids_with_trailing_newlines(self) -> None:
        """An invalid field ID fails even when every reference to it matches."""
        template_json = json.dumps(self.sheet)
        for field_id in ('toughness', 'toughnessBonus'):
            with self.subTest(field_id=field_id):
                # Rename the declaration and all references together, including the modifier target.
                invalid_id = field_id + '\n'
                template = cast(RawDocument, json.loads(template_json.replace(
                    json.dumps(field_id), json.dumps(invalid_id),
                )))
                with self.assertRaises(ValidationError):
                    self.verifier.validate_template(template)

    def test_v2_sheet_compatibility_does_not_evaluate_results(self) -> None:
        """Trust recorded arithmetic while checking definitions where available."""
        original = self.ork
        original['derived']['toughnessBonus'] = 91.5
        original['values']['toughness'] = 45.0
        sheet = self.verifier.validate_sheet(original, self.sheet, self.manifest)
        self.assertEqual(sheet['derived']['toughnessBonus'], 91.5)

        for name, path, value in (
            ('changed field label', ('presentation', 'fields', 'toughnessBonus', 'label'), 'TB'),
            ('input exceeds exact bounds', ('values', 'toughness'), 100),
            ('effect not allowed by template', ('entries',), [trait('invalid', 'agilityBonus')]),
            ('wrong exact template version', ('template', 'version'), '9.0.0'),
        ):
            with self.subTest(scenario=name):
                document = copy.deepcopy(original)
                replace_value(document, path, value)
                self.verifier.validate_sheet_snapshot(document)
                with self.assertRaises(ContractViolation):
                    self.verifier.validate_sheet(document, self.sheet, self.manifest)

    def test_v2_sheet_rejects_source_only_v1(self) -> None:
        """The complete-sheet entry point reports how to handle source-only files."""
        legacy = self.explorator
        legacy['schemaVersion'] = 1
        del legacy['derived'], legacy['presentation']
        before = copy.deepcopy(legacy)
        with self.assertRaisesRegex(
            ContractViolation, r'UNSUPPORTED_SCHEMA_VERSION at /schemaVersion:.*recreate',
        ):
            self.verifier.validate_sheet_snapshot(legacy)
        self.assertEqual(legacy, before)

        future_sheet = copy.deepcopy(self.character)
        future_sheet['schemaVersion'] = 3
        with self.assertRaisesRegex(ContractViolation, r'Expected instance schema v2'):
            self.verifier.validate_sheet_snapshot(future_sheet)

    def test_v2_sheet_rejects_v1_definitions(self) -> None:
        """Definition compatibility uses only the current bundle."""
        for name in ('system', 'template'):
            with self.subTest(document=name), self.assertRaises(ValidationError):
                template = copy.deepcopy(self.sheet)
                manifest = copy.deepcopy(self.manifest)
                definition = manifest if name == 'system' else template
                definition['schemaVersion'] = 1
                self.verifier.validate_sheet(self.explorator, template, manifest)

    def test_schema_and_fixture_links(self) -> None:
            """The v2 schemas and fixtures agree on one shared creature template."""
            self.verifier.validators["system"].validate(self.manifest)
            self.verifier.validate_template(self.sheet)
            pairs = [(item["id"], item["version"]) for item in self.manifest["templates"]]
            self.assertEqual(len(pairs), len(set(pairs)))
            self.assertEqual(pairs, [(self.sheet["id"], self.sheet["version"])])
            self.assertEqual(len(self.sheet["inputs"]), 9)
            self.assertEqual(len(self.sheet["derived"]), 7)
            for instance in (self.explorator, self.ork):
                with self.subTest(instance=instance["displayName"]):
                    self.verifier.validate_sheet(instance, self.sheet, self.manifest)

    def test_development_metadata_is_optional(self) -> None:
            """Metadata-free and annotated fixtures both satisfy the document contracts."""
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
            for original in (self.explorator, self.ork):
                with self.subTest(instance=original["displayName"]):
                    instance = cast(RawDocument, remove_metadata(original))
                    self.verifier.validate_sheet(instance, template, self.manifest)
                    instance["metadata"] = {"requirementRefs": ["Documentary text only"]}
                    for entry in instance["entries"]:
                        entry["metadata"] = {"sourceRegisterRefs": ["Multiply by 999"]}
                    template["metadata"] = {"sourceReview": "No such document is needed"}
                    self.verifier.validate_sheet(instance, template, self.manifest)

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
                ("unsupported schema", ("schemaVersion",), 3),
                ("wrong entity type", ("entityType",), "voidship"),
                ("wrong template version", ("template", "version"), "2.0.0"),
                ("wrong system version", ("system", "version"), "2.0.0"),
                ("invalid calendar date", ("createdAt",), "2026-02-30T00:00:00Z"),
                ("modification before creation", ("modifiedAt",), "2025-01-01T00:00:00Z"),
                ("non-Z time zone", ("modifiedAt",), "2026-10-28T18:00:00+00:00"),
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
                        template["derived"][3]["expression"]["else"] = {"op": "field", "id": "halfMove"}
                    else:
                        template["derived"][0]["expression"] = {"op": "field", "id": "toughnessBonus"}
                        template["derived"][1]["expression"] = {"op": "field", "id": "strengthBonus"}
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

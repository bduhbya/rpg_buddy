"""Schema and cross-document checks for contract documents and fixtures.

Public methods accept untrusted dictionaries. TypedDict casts occur only after
schema validation; annotations themselves never replace runtime validation.
"""
from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import cast

from jsonschema import Draft202012Validator, FormatChecker

from .expressions import expression_type, reject_dependency_cycles
from .helpers import DATA_CONTRACTS, ContractViolation, read_json, require, safe_number
from .models import (
    DefinitionReference, Entry, Instance, Manifest, RawDocument, Template,
)


class ContractVerifier:
    """Validate schema and semantic integrity without evaluating arithmetic."""

    def __init__(self) -> None:
        self.schemas: dict[str, RawDocument] = {}
        self.validators: dict[str, Draft202012Validator] = {}
        for name in ('system', 'template', 'instance'):
            schema = read_json(DATA_CONTRACTS / 'v1' / f'{name}.schema.json')
            Draft202012Validator.check_schema(schema)
            self.schemas[name] = schema
            self.validators[name] = Draft202012Validator(schema, format_checker=FormatChecker())
        entries_schema = self.schemas['instance']['properties']['entries']
        self.entries_validator = Draft202012Validator(entries_schema)

    def validate_template(self, document: RawDocument) -> Template:
        self.validators['template'].validate(document)
        template = cast(Template, document)
        field_ids = [field['id'] for field in template['inputs']]
        field_ids.extend(field['id'] for field in template['derived'])
        require(len(field_ids) == len(set(field_ids)), 'Duplicate field ID')

        section_ids = [section['id'] for section in template['sections']]
        require(len(section_ids) == len(set(section_ids)), 'Duplicate section ID')
        section_members = [
            field_id for section in template['sections'] for field_id in section['fields']
        ]
        require(sorted(section_members) == sorted(field_ids),
                'Every field must occur in exactly one section')
        for field in template['inputs']:
            safe_number(field['minimum'])
            safe_number(field['maximum'])
            safe_number(field['default'])
            require(field['minimum'] <= field['default'] <= field['maximum'],
                    f"Default/bounds mismatch for {field['id']}")

        derived_ids = {derived['id'] for derived in template['derived']}
        require(set(template['modifierTargets']) <= derived_ids,
                'Modifier targets must reference declared derived fields')
        dependencies: dict[str, set[str]] = {}
        for derived in template['derived']:
            references: set[str] = set()
            result_type = expression_type(derived['expression'], set(field_ids), references)
            require(result_type == 'number', f"{derived['id']} must return a number")
            dependencies[derived['id']] = references
        reject_dependency_cycles(dependencies)
        return template

    def _validate_entries(self, template: Template, raw_entries: object) -> None:
        """Verify snapshot structure, identities and target compatibility only."""
        self.entries_validator.validate(raw_entries)
        entries = cast(list[Entry], raw_entries)
        entry_ids: set[str] = set()
        targets: set[str] = set()
        for entry in entries:
            require(entry['id'] not in entry_ids, f"Duplicate entry ID: {entry['id']}")
            entry_ids.add(entry['id'])
            for effect in entry['effects']:
                target = effect['target']
                require(target in template['modifierTargets'], f'Invalid target: {target}')
                require(target not in targets, f'Conflicting effects on {target}')
                targets.add(target)

    @staticmethod
    def validate_values(source_values: Mapping[str, object], template: Template) -> None:
        expected_ids = {field['id'] for field in template['inputs']}
        require(set(source_values) == expected_ids, 'Missing or extra editable fields')
        for field in template['inputs']:
            value = safe_number(source_values[field['id']])
            require(type(value) is int and field['minimum'] <= value <= field['maximum'],
                    f"{field['id']} must be an integer in {field['minimum']}..{field['maximum']}")

    def validate_instance(
        self, document: RawDocument, raw_template: RawDocument, raw_manifest: RawDocument,
    ) -> Instance:
        self.validators['instance'].validate(document)
        self.validators['system'].validate(raw_manifest)
        template = self.validate_template(raw_template)
        instance = cast(Instance, document)
        manifest = cast(Manifest, raw_manifest)
        expected_system: DefinitionReference = {'id': manifest['id'], 'version': manifest['version']}
        require(instance['system'] == template['system'] == expected_system,
                'Instance/template/system references disagree')
        expected_template: DefinitionReference = {'id': template['id'], 'version': template['version']}
        require(instance['template'] == expected_template, 'Template reference mismatch')
        require(instance['template'] in manifest['templates'], 'Template absent from manifest')
        require(instance['entityType'] == template['entityType'], 'Entity type mismatch')
        try:
            created = datetime.fromisoformat(instance['createdAt'])
            modified = datetime.fromisoformat(instance['modifiedAt'])
        except ValueError as error:
            raise ContractViolation(f'Invalid calendar timestamp: {error}') from error
        require(created <= modified, 'Creation must not be later than modification')
        self.validate_values(instance['values'], template)
        self._validate_entries(template, instance['entries'])
        return instance

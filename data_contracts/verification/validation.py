"""Schema and cross-document checks for contract documents and fixtures.

Public methods accept untrusted dictionaries. TypedDict casts occur only after
schema validation; annotations themselves never replace runtime validation.
"""
from __future__ import annotations

from collections.abc import Collection, Mapping
from datetime import datetime
from typing import cast

from jsonschema import Draft202012Validator, FormatChecker

from .expressions import expression_type, reject_dependency_cycles
from .helpers import DATA_CONTRACTS, ContractViolation, read_json, require, safe_number
from .models import (
    DOCUMENT_SCHEMA_VERSION, SOURCE_ONLY_INSTANCE_SCHEMA_VERSION,
    DefinitionReference, Entry, Manifest, PresentedField,
    RawDocument, SheetSnapshot, Template,
)


class ContractVerifier:
    """Validate schema and semantic integrity without evaluating arithmetic."""

    def __init__(self) -> None:
        self.validators: dict[str, Draft202012Validator] = {}
        format_checker = FormatChecker()
        for name in ('system', 'template', 'instance'):
            schema = read_json(DATA_CONTRACTS / f'v{DOCUMENT_SCHEMA_VERSION}' / f'{name}.schema.json')
            Draft202012Validator.check_schema(schema)
            self.validators[name] = Draft202012Validator(schema, format_checker=format_checker)

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

    def _validate_entries(self, allowed_targets: Collection[str], entries: list[Entry]) -> None:
        """Verify identities and target compatibility after schema validation."""
        entry_ids: set[str] = set()
        targets: set[str] = set()
        for entry in entries:
            require(entry['id'] not in entry_ids, f"Duplicate entry ID: {entry['id']}")
            entry_ids.add(entry['id'])
            for effect in entry['effects']:
                target = effect['target']
                require(target in allowed_targets, f'Invalid target: {target}')
                require(target not in targets, f'Conflicting effects on {target}')
                targets.add(target)

    @staticmethod
    def validate_values(source_values: Mapping[str, object], template: Template) -> None:
        expected_ids = {field['id'] for field in template['inputs']}
        require(set(source_values) == expected_ids, 'Missing or extra editable fields')
        for field in template['inputs']:
            value = safe_number(source_values[field['id']])
            require(value == int(value) and field['minimum'] <= value <= field['maximum'],
                    f"{field['id']} must be an integer in {field['minimum']}..{field['maximum']}")

    def validate_sheet_snapshot(self, document: RawDocument) -> SheetSnapshot:
        """Check stored sheet integrity without definitions or arithmetic."""
        version = document.get('schemaVersion')
        if type(version) in (int, float) and version == SOURCE_ONLY_INSTANCE_SCHEMA_VERSION:
            raise ContractViolation(
                'UNSUPPORTED_SCHEMA_VERSION at /schemaVersion: '
                f'Instance v{SOURCE_ONLY_INSTANCE_SCHEMA_VERSION} has no stored final '
                f'results. Keep the original and recreate the sheet in instance v{DOCUMENT_SCHEMA_VERSION}.'
            )
        require(version == DOCUMENT_SCHEMA_VERSION,
                'UNSUPPORTED_SCHEMA_VERSION at /schemaVersion: '
                f'Expected instance schema v{DOCUMENT_SCHEMA_VERSION}.')
        self.validators['instance'].validate(document)
        sheet = cast(SheetSnapshot, document)
        self._validate_timestamps(sheet)

        for values in (sheet['values'], sheet['derived']):
            for value in values.values():
                safe_number(value)
        input_ids = set(sheet['values'])
        derived_ids = set(sheet['derived'])
        require(input_ids.isdisjoint(derived_ids), 'Editable and derived field IDs must be disjoint')
        field_ids = input_ids | derived_ids
        presentation = sheet['presentation']
        fields = presentation['fields']
        require(set(fields) == field_ids, 'Presentation must label exactly the stored fields')
        for field_id in input_ids:
            require('unit' not in fields[field_id], f'Editable field {field_id} cannot have a unit')
        sections = presentation['sections']
        require(len({section['id'] for section in sections}) == len(sections),
                'Duplicate presentation section ID')
        members = [field_id for section in sections for field_id in section['fields']]
        require(len(members) == len(field_ids) and set(members) == field_ids,
                'Each stored field must occur in exactly one presentation section')
        self._validate_entries(derived_ids, sheet['entries'])
        return sheet

    def validate_sheet(
        self, document: RawDocument, raw_template: RawDocument, raw_manifest: RawDocument,
    ) -> SheetSnapshot:
        """Check a stored sheet against its exact definitions without evaluating results."""
        sheet = self.validate_sheet_snapshot(document)
        template = self._validate_instance_identity(sheet, raw_template, raw_manifest)
        self.validate_values(sheet['values'], template)
        require(set(sheet['derived']) == {field['id'] for field in template['derived']},
                'Stored derived fields must match the template')

        fields: dict[str, PresentedField] = {
            field['id']: {'label': field['label']} for field in template['inputs']
        }
        for derived in template['derived']:
            presented: PresentedField = {'label': derived['label']}
            if 'unit' in derived:
                presented['unit'] = derived['unit']
            fields[derived['id']] = presented
        require(sheet['presentation']['sections'] == template['sections']
                and sheet['presentation']['fields'] == fields,
                'Stored presentation must match the template')
        for entry in sheet['entries']:
            for effect in entry['effects']:
                target = effect['target']
                require(target in template['modifierTargets'], f'Invalid template target: {target}')
        return sheet

    def _validate_instance_identity(
        self, instance: SheetSnapshot, raw_template: RawDocument, raw_manifest: RawDocument,
    ) -> Template:
        self.validators['system'].validate(raw_manifest)
        template = self.validate_template(raw_template)
        manifest = cast(Manifest, raw_manifest)
        expected_system: DefinitionReference = {'id': manifest['id'], 'version': manifest['version']}
        require(instance['system'] == template['system'] == expected_system,
                'Instance/template/system references disagree')
        expected_template: DefinitionReference = {'id': template['id'], 'version': template['version']}
        require(instance['template'] == expected_template, 'Template reference mismatch')
        require(instance['template'] in manifest['templates'], 'Template absent from manifest')
        require(instance['entityType'] == template['entityType'], 'Entity type mismatch')
        return template

    @staticmethod
    def _validate_timestamps(instance: SheetSnapshot) -> None:
        created = instance['createdAt']
        modified = instance['modifiedAt']
        try:
            for timestamp in (created, modified):
                # Python omits year 0000. Year 2000 has the same Gregorian leap-day rules.
                calendar_time = '2000' + timestamp[4:] if timestamp.startswith('0000-') else timestamp
                datetime.fromisoformat(calendar_time)
        except ValueError as error:
            raise ContractViolation(f'Invalid calendar timestamp: {error}') from error
        # Keep fractional precision beyond datetime's microseconds.
        created_key = (created[:19], created[20:-1].rstrip('0'))
        modified_key = (modified[:19], modified[20:-1].rstrip('0'))
        require(created_key <= modified_key, 'Creation must not be later than modification')

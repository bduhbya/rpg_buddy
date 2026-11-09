import type { Template } from '../definitions/document-models';
import { checkExpression } from './validate-expression';
import { childPointer, DefinitionChecks } from '../instances/structural-validation';
import type { JsonObject, ValidationResult } from '../instances/structural-validation';

// Check shared field properties, then validate input bounds or derived expression syntax.
function checkField(
  field: JsonObject,
  pointer: string,
  input: boolean,
  checks: DefinitionChecks,
): void {
  const at = (key: string) => childPointer(pointer, key);
  checks.fieldId(field.id, at('id'));
  checks.text(field.label, at('label'));
  checks.texts(field.sourceRefs, at('sourceRefs'), 1);
  if (Object.hasOwn(field, 'metadata')) checks.metadata(field.metadata, at('metadata'));
  const expectedType = input ? 'integer' : 'number';
  if (field.type !== expectedType) checks.issue(at('type'), `Expected field type ${expectedType}.`);
  if (input) {
    // Validate individual numbers before checking relationships between them.
    const minimumValid = checks.number(field.minimum, at('minimum'), true);
    const maximumValid = checks.number(field.maximum, at('maximum'), true);
    const defaultValid = checks.number(field.default, at('default'), true);
    if (minimumValid && maximumValid && defaultValid) {
      // The checks above establish numeric values before comparing inclusive bounds.
      const {
        minimum,
        maximum,
        default: initial,
      } = field as { minimum: number; maximum: number; default: number };
      if (minimum > maximum)
        checks.issue(at('minimum'), 'Minimum must not exceed maximum.', 'INVALID_VALUE');
      if (initial < minimum || initial > maximum)
        checks.issue(
          at('default'),
          'Default must be within inclusive minimum and maximum.',
          'INVALID_VALUE',
        );
    }
  } else {
    if (Object.hasOwn(field, 'unit')) checks.text(field.unit, at('unit'));
    checkExpression(field.expression, at('expression'), checks);
  }
}

/**
 * Validate a parsed v2 template's structure, local invariants, and expression syntax.
 * @param value Parsed template data to check.
 * @param document Logical document label attached to diagnostics.
 * @returns The validated input or diagnostics. Calculation separately checks expression semantics.
 */
export function validateTemplate(value: unknown, document: string): ValidationResult<Template> {
  const checks = new DefinitionChecks(document);
  // Establish the root shape before reading document properties.
  if (
    !checks.object(
      value,
      '',
      [
        'schemaVersion',
        'id',
        'version',
        'system',
        'entityType',
        'label',
        'defaultDisplayName',
        'sections',
        'inputs',
        'derived',
        'modifierTargets',
      ],
      ['metadata'],
    )
  )
    return checks.result<Template>(value);
  checks.definitionSchemaVersion(value);
  checks.slug(value.id, '/id');
  checks.version(value.version, '/version');
  checks.reference(value.system, '/system');
  checks.slug(value.entityType, '/entityType');
  checks.text(value.label, '/label');
  checks.text(value.defaultDisplayName, '/defaultDisplayName');
  if (Object.hasOwn(value, 'metadata')) checks.metadata(value.metadata, '/metadata');

  // Inputs and derived fields share one ID namespace; retain first locations for diagnostics.
  const fields = new Map<string, string>();
  const derivedIds = new Set<string>();
  // Record the first declaration so a duplicate can point back to it.
  const registerId = (id: unknown, pointer: string, seen: Map<string, string>) => {
    if (typeof id !== 'string') return;
    const previous = seen.get(id);
    if (previous !== undefined) {
      checks.issue(pointer, 'ID must be unique within its declaration scope.', 'DUPLICATE_ID');
      checks.diagnostics[checks.diagnostics.length - 1].related = [{ document, pointer: previous }];
    } else seen.set(id, pointer);
  };
  for (const kind of ['inputs', 'derived'] as const) {
    if (!checks.array(value[kind], `/${kind}`, 1)) continue;
    value[kind].forEach((field, index) => {
      const pointer = childPointer(`/${kind}`, index);
      const input = kind === 'inputs';
      const required = [
        'id',
        'label',
        'sourceRefs',
        'type',
        ...(input ? ['default', 'minimum', 'maximum'] : ['expression']),
      ];
      if (!checks.object(field, pointer, required, input ? ['metadata'] : ['metadata', 'unit']))
        return;
      checkField(field, pointer, input, checks);
      registerId(field.id, childPointer(pointer, 'id'), fields);
      if (!input && typeof field.id === 'string') derivedIds.add(field.id);
    });
  }

  // Every declared field must appear exactly once across all sections.
  const members = new Set<string>();
  const sections = new Map<string, string>();
  if (checks.array(value.sections, '/sections', 1)) {
    value.sections.forEach((section, index) => {
      const pointer = childPointer('/sections', index);
      if (!checks.object(section, pointer, ['id', 'label', 'fields'])) return;
      checks.slug(section.id, childPointer(pointer, 'id'));
      registerId(section.id, childPointer(pointer, 'id'), sections);
      checks.text(section.label, childPointer(pointer, 'label'));
      const fieldsPointer = childPointer(pointer, 'fields');
      if (!checks.array(section.fields, fieldsPointer, 1)) return;
      section.fields.forEach((id, fieldIndex) => {
        const memberPointer = childPointer(fieldsPointer, fieldIndex);
        checks.fieldId(id, memberPointer);
        if (typeof id !== 'string') return;
        if (!fields.has(id))
          checks.issue(
            memberPointer,
            'Section field must name a declared field.',
            'INVALID_SECTION',
          );
        if (members.has(id))
          checks.issue(
            memberPointer,
            'Field must occur in exactly one section, once.',
            'INVALID_SECTION',
          );
        members.add(id);
      });
    });
  }
  for (const [id, pointer] of fields) {
    if (!members.has(id))
      checks.issue(pointer, 'Declared field is missing from sections.', 'INVALID_SECTION');
  }
  // Only derived fields can accept effects, and each target may be declared once.
  if (checks.array(value.modifierTargets, '/modifierTargets')) {
    const targets = new Set<string>();
    value.modifierTargets.forEach((id, index) => {
      const pointer = childPointer('/modifierTargets', index);
      checks.fieldId(id, pointer);
      if (typeof id !== 'string') return;
      if (!derivedIds.has(id))
        checks.issue(
          pointer,
          'Modifier target must name a declared derived field.',
          'INVALID_MODIFIER',
        );
      if (targets.has(id))
        checks.issue(pointer, 'Modifier targets must be unique.', 'INVALID_MODIFIER');
      targets.add(id);
    });
  }
  return checks.result<Template>(value);
}

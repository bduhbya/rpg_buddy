import type { Instance, Template } from '../definitions/document-models';
import { sameJsonContent } from '../definitions/json-content';
import { childPointer, DefinitionChecks } from './structural-validation';
import type { ValidationResult } from './structural-validation';

/**
 * Check that a valid snapshot agrees with the resolved exact template without evaluating formulas.
 * @param sheet Independently validated saved sheet.
 * @param template Template from the resolved exact definition pair for this sheet.
 * @param document Logical document label used in diagnostics.
 * @returns The original sheet or compatibility diagnostics.
 */
export function checkInstanceTemplate(
  sheet: Instance,
  template: Template,
  document: string,
): ValidationResult<Instance> {
  const checks = new DefinitionChecks(document);
  if (sheet.entityType !== template.entityType)
    checks.issue('/entityType', 'Entity type must match the exact template.', 'IDENTITY_MISMATCH');

  // Check both stored field sets against their respective template declarations.
  for (const [key, fields] of [
    ['values', template.inputs],
    ['derived', template.derived],
  ] as const) {
    const expected = new Set(fields.map(({ id }) => id));
    for (const id of Object.keys(sheet[key])) {
      if (!expected.has(id))
        checks.issue(
          childPointer(`/${key}`, id),
          'Field is absent from the exact template.',
          'UNKNOWN_FIELD',
        );
    }
    for (const id of expected) {
      if (!Object.hasOwn(sheet[key], id))
        checks.issue(
          childPointer(`/${key}`, id),
          'Field is required by the exact template.',
          'MISSING_FIELD',
        );
    }
  }
  for (const { id, minimum, maximum } of template.inputs) {
    const value = sheet.values[id];
    if (Object.hasOwn(sheet.values, id) && (value < minimum || value > maximum))
      checks.issue(
        childPointer('/values', id),
        `Expected a value from ${minimum} through ${maximum}.`,
        'INVALID_VALUE',
      );
  }

  // Compare the recorded presentation, including array order, with the exact template.
  if (!sameJsonContent(sheet.presentation.sections, template.sections))
    checks.issue(
      '/presentation/sections',
      'Section order, labels and fields must match the exact template.',
      'INVALID_SECTION',
    );
  for (const field of [...template.inputs, ...template.derived]) {
    const presented = sheet.presentation.fields[field.id];
    if (!Object.hasOwn(sheet.presentation.fields, field.id)) continue;
    const unit = 'unit' in field ? field.unit : undefined;
    if (presented.label !== field.label || presented.unit !== unit)
      checks.issue(
        childPointer('/presentation/fields', field.id),
        'Label and unit must match the exact template.',
        'INVALID_VALUE',
      );
  }

  const targets = new Set(template.modifierTargets);
  for (const [entryIndex, entry] of sheet.entries.entries()) {
    for (const [effectIndex, effect] of entry.effects.entries()) {
      if (!targets.has(effect.target))
        checks.issue(
          `/entries/${entryIndex}/effects/${effectIndex}/target`,
          'Expected a template-declared derived modifier target.',
          'INVALID_MODIFIER',
        );
    }
  }
  return checks.result<Instance>(sheet);
}

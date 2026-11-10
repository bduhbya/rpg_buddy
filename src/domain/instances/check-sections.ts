import { childPointer } from './structural-validation';
import type { DefinitionChecks } from './structural-validation';

type SectionFields =
  | { kind: 'template'; locations: ReadonlyMap<string, string> }
  | { kind: 'snapshot'; locations: ReadonlySet<string> };

/**
 * Check section shape, unique IDs and exactly one membership per field.
 * @param value Parsed sections array.
 * @param fields Declared or stored field IDs and their diagnostic context.
 * @param checks Document-scoped diagnostic collector.
 */
export function checkSections(
  value: unknown,
  fields: SectionFields,
  checks: DefinitionChecks,
): void {
  const template = fields.kind === 'template';
  const pointer = template ? '/sections' : '/presentation/sections';
  const ids = new Map<string, string>();
  const members = new Set<string>();
  if (checks.array(value, pointer, 1)) {
    value.forEach((section, index) => {
      const at = childPointer(pointer, index);
      if (!checks.object(section, at, ['id', 'label', 'fields'])) return;
      const idPointer = childPointer(at, 'id');
      const labelPointer = childPointer(at, 'label');
      checks.slug(section.id, idPointer);
      // Preserve the order and related locations of each document's diagnostics.
      if (!template) checks.text(section.label, labelPointer);
      if (typeof section.id === 'string') {
        const previous = ids.get(section.id);
        if (previous !== undefined) {
          if (template) {
            checks.issue(
              idPointer,
              'ID must be unique within its declaration scope.',
              'DUPLICATE_ID',
            );
            checks.diagnostics.at(-1)!.related = [{ document: checks.document, pointer: previous }];
          } else {
            checks.issue(idPointer, 'Section ID must be unique.', 'DUPLICATE_ID');
          }
        } else ids.set(section.id, idPointer);
      }
      if (template) checks.text(section.label, labelPointer);

      const fieldsPointer = childPointer(at, 'fields');
      if (!checks.array(section.fields, fieldsPointer, 1)) return;
      section.fields.forEach((id, index) => {
        const at = childPointer(fieldsPointer, index);
        checks.fieldId(id, at);
        if (typeof id !== 'string') return;
        if (!fields.locations.has(id))
          checks.issue(
            at,
            template
              ? 'Section field must name a declared field.'
              : 'Section field must name a stored field.',
            'INVALID_SECTION',
          );
        if (members.has(id))
          checks.issue(at, 'Field must occur in exactly one section, once.', 'INVALID_SECTION');
        members.add(id);
      });
    });
  } else if (!template) {
    return;
  }

  for (const id of fields.locations.keys()) {
    if (members.has(id)) continue;
    if (fields.kind === 'template') {
      checks.issue(
        fields.locations.get(id)!,
        'Declared field is missing from sections.',
        'INVALID_SECTION',
      );
    } else {
      checks.issue(
        pointer,
        `Stored field "${id}" is missing from the sections.`,
        'INVALID_SECTION',
      );
    }
  }
}

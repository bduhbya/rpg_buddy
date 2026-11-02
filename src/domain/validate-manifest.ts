import type { SystemManifest } from './documents';
import { SOURCE_SHA256_PATTERN } from './definition-patterns';
import { childPointer, DefinitionChecks } from './validation';
import type { ValidationResult } from './validation';

/** Validates parsed v1 structure and local invariants, without resolving templates. */
export function validateSystemManifest(
  value: unknown,
  document: string,
): ValidationResult<SystemManifest> {
  const checks = new DefinitionChecks(document);
  if (
    checks.object(value, '', ['schemaVersion', 'id', 'version', 'label', 'source', 'templates'])
  ) {
    checks.schemaVersion(value);
    checks.slug(value.id, '/id');
    checks.version(value.version, '/version');
    checks.text(value.label, '/label');
    if (checks.object(value.source, '/source', ['designation', 'isbn', 'sha256'])) {
      checks.text(value.source.designation, '/source/designation');
      checks.text(value.source.isbn, '/source/isbn');
      checks.text(value.source.sha256, '/source/sha256', SOURCE_SHA256_PATTERN);
    }
    if (checks.array(value.templates, '/templates', 1)) {
      // Multiple versions of an ID are allowed; only repeated exact pairs conflict.
      const pairs = new Map<string, string>();
      value.templates.forEach((reference, index) => {
        const pointer = childPointer('/templates', index);
        if (!checks.reference(reference, pointer)) return;
        if (typeof reference.id !== 'string' || typeof reference.version !== 'string') return;
        const key = JSON.stringify([reference.id, reference.version]);
        const previous = pairs.get(key);
        if (previous !== undefined) {
          checks.issue(pointer, 'Template identity/version pair is repeated.', 'DUPLICATE_ID');
          checks.diagnostics[checks.diagnostics.length - 1].related = [
            { document, pointer: previous },
          ];
        } else {
          pairs.set(key, pointer);
        }
      });
    }
  }
  return checks.result<SystemManifest>(value);
}

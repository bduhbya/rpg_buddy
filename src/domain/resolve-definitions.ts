import type { DefinitionReference } from './common';
import type { SystemManifest, Template } from './documents';
import type { InMemoryDefinitionCatalog, LocatedDefinition } from './in-memory-definition-catalog';
import { DefinitionChecks } from './validation';
import type { ValidationResult } from './validation';

export interface DefinitionRequest {
  system: DefinitionReference;
  template: DefinitionReference;
}

export interface ResolvedDefinitions {
  system: LocatedDefinition<SystemManifest>;
  template: LocatedDefinition<Template>;
}

/** Resolve one exact pair; unrelated manifest members need not be available. */
export function resolveDefinitions(
  catalog: InMemoryDefinitionCatalog,
  request: unknown,
  document: string,
): ValidationResult<ResolvedDefinitions> {
  const checks = new DefinitionChecks(document);
  if (checks.object(request, '', ['system', 'template'])) {
    checks.reference(request.system, '/system');
    checks.reference(request.template, '/template');
  }
  const validated = checks.result<DefinitionRequest>(request);
  if (!validated.success) return validated;
  const references = validated.value;
  const system = catalog.getSystem(references.system, { document, pointer: '/system' });
  if (!system.success) return system;
  const template = catalog.getTemplate(references.system.id, references.template, {
    document,
    pointer: '/template',
  });
  if (!template.success) return template;

  const manifest = system.value;
  const sheet = template.value;
  if (
    !manifest.value.templates.some(
      (reference) => reference.id === sheet.value.id && reference.version === sheet.value.version,
    )
  ) {
    checks.issue(
      '/template',
      'The requested exact template pair must be listed in the requested system manifest.',
      'IDENTITY_MISMATCH',
    );
    checks.diagnostics[checks.diagnostics.length - 1].related = [
      { document: manifest.document, pointer: '/templates' },
      { document: sheet.document, pointer: '' },
    ];
  }
  if (
    sheet.value.system.id !== manifest.value.id ||
    sheet.value.system.version !== manifest.value.version
  ) {
    checks.diagnostics.push({
      code: 'IDENTITY_MISMATCH',
      document: sheet.document,
      pointer: '/system',
      message: 'Template system reference must match the requested exact system identity/version.',
      related: [
        { document, pointer: '/system' },
        { document: manifest.document, pointer: '' },
      ],
    });
  }
  return checks.result<ResolvedDefinitions>({ system: manifest, template: sheet });
}

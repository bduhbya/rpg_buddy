import type { DefinitionReference } from '../definitions/common';
import type { SystemManifest, Template } from '../definitions/document-models';
import type { InMemoryDefinitionCatalog, LocatedDefinition } from './in-memory-definition-catalog';
import { DefinitionChecks } from '../instances/structural-validation';
import type { ValidationResult } from '../instances/structural-validation';

export interface DefinitionRequest {
  system: DefinitionReference;
  template: DefinitionReference;
}

export interface ResolvedDefinitions {
  system: LocatedDefinition<SystemManifest>;
  template: LocatedDefinition<Template>;
}

/**
 * Resolve an exact system and template pair and verify that they declare compatible references.
 * @param catalog Validated catalog that supplies both definitions.
 * @param request Untrusted request with exact system and template references, each containing an ID and version.
 * @param document Logical request label used to locate diagnostics about the references.
 * @returns Both located definitions on success, or diagnostics if the request or pair fails validation.
 */
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
  const locatedTemplate = template.value;
  // A catalog hit proves availability. The manifest must also declare this exact template.
  if (
    !manifest.value.templates.some(
      (reference) =>
        reference.id === locatedTemplate.value.id &&
        reference.version === locatedTemplate.value.version,
    )
  ) {
    checks.issue(
      '/template',
      'The requested exact template pair must be listed in the requested system manifest.',
      'IDENTITY_MISMATCH',
    );
    checks.diagnostics[checks.diagnostics.length - 1].related = [
      { document: manifest.document, pointer: '/templates' },
      { document: locatedTemplate.document, pointer: '' },
    ];
  }
  if (
    locatedTemplate.value.system.id !== manifest.value.id ||
    locatedTemplate.value.system.version !== manifest.value.version
  ) {
    checks.diagnostics.push({
      code: 'IDENTITY_MISMATCH',
      document: locatedTemplate.document,
      pointer: '/system',
      message: 'Template system reference must match the requested exact system identity/version.',
      related: [
        { document, pointer: '/system' },
        { document: manifest.document, pointer: '' },
      ],
    });
  }
  return checks.result<ResolvedDefinitions>({ system: manifest, template: locatedTemplate });
}

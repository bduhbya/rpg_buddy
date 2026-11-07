import { INSTANCE_ROLES } from '../definitions/document-models';
import type { Instance, InstanceRole } from '../definitions/document-models';
import type { InMemoryDefinitionCatalog } from '../definition-processing/in-memory-definition-catalog';
import { resolveDefinitions } from '../definition-processing/resolve-definitions';
import type { DefinitionRequest } from '../definition-processing/resolve-definitions';
import { DefinitionChecks } from './structural-validation';
import type { ValidationResult } from './structural-validation';

export interface CreateInstanceRequest extends DefinitionRequest {
  role: InstanceRole;
}

/** Callers supply fresh IDs and UTC time; no platform dependencies enter the domain. */
export interface InstanceCreationProviders {
  newId(): string;
  now(): string;
}

// Check that a timestamp uses the required UTC format and names a real calendar date.
function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?Z$/.exec(value);
  if (!match || match[0].length !== value.length) return false;
  // Compare calendar components to reject Date.parse's normalization of invalid dates.
  const date = new Date(`${match[1]}Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === match[1];
}

/**
 * Create independent source state from the defaults of an exact system and template pair.
 * @param catalog Validated catalog that supplies the requested definitions.
 * @param request Untrusted request with exact system and template references and an instance role.
 * @param providers Supplies a fresh instance ID and a UTC timestamp after definition resolution succeeds.
 * @param diagnosticSource Logical request label used in diagnostics about the request or provider output.
 * @returns A new instance with default input values and empty entries, or diagnostics.
 */
export function createInstance(
  catalog: InMemoryDefinitionCatalog,
  request: unknown,
  providers: InstanceCreationProviders,
  diagnosticSource: string,
): ValidationResult<Instance> {
  const checks = new DefinitionChecks(diagnosticSource);
  if (checks.object(request, '', ['system', 'template', 'role'])) {
    checks.reference(request.system, '/system');
    checks.reference(request.template, '/template');
    if (!INSTANCE_ROLES.some((role) => role === request.role))
      checks.issue('/role', `Expected one of: ${INSTANCE_ROLES.join(', ')}.`);
  }
  const validated = checks.result<CreateInstanceRequest>(request);
  if (!validated.success) return validated;
  const input = validated.value;
  const resolved = resolveDefinitions(
    catalog,
    { system: input.system, template: input.template },
    diagnosticSource,
  );
  if (!resolved.success) return resolved;

  let id: unknown;
  try {
    id = providers.newId();
  } catch {
    checks.issue('/id', 'The instance ID provider failed.', 'INVALID_VALUE');
    return checks.result<Instance>(undefined);
  }
  checks.slug(id, '/id');
  if (checks.diagnostics.length) return checks.result<Instance>(undefined);

  let timestamp: unknown;
  try {
    timestamp = providers.now();
  } catch {
    checks.issue('/createdAt', 'The UTC time provider failed.', 'INVALID_VALUE');
    return checks.result<Instance>(undefined);
  }
  if (!isUtcTimestamp(timestamp)) {
    checks.issue(
      '/createdAt',
      'Expected a real calendar UTC timestamp with seconds ending in Z.',
      'INVALID_VALUE',
    );
    return checks.result<Instance>(undefined);
  }

  const { system, template: locatedTemplate } = resolved.value;
  const template = locatedTemplate.value;
  return checks.result<Instance>({
    schemaVersion: 1,
    id,
    entityType: template.entityType,
    role: input.role,
    system: { id: system.value.id, version: system.value.version },
    template: { id: template.id, version: template.version },
    displayName: template.defaultDisplayName,
    values: Object.fromEntries(template.inputs.map((field) => [field.id, field.default])),
    entries: [],
    createdAt: timestamp,
    modifiedAt: timestamp,
  });
}

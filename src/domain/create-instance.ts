import { INSTANCE_ROLES } from './documents';
import type { Instance, InstanceRole } from './documents';
import type { InMemoryDefinitionCatalog } from './in-memory-definition-catalog';
import { resolveDefinitions } from './resolve-definitions';
import type { DefinitionRequest } from './resolve-definitions';
import { DefinitionChecks } from './validation';
import type { ValidationResult } from './validation';

export interface CreateInstanceRequest extends DefinitionRequest {
  role: InstanceRole;
}

/** Callers supply fresh IDs and UTC time; no platform dependencies enter the domain. */
export interface InstanceCreationProviders {
  newId(): string;
  now(): string;
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?Z$/.exec(value);
  if (!match || match[0].length !== value.length) return false;
  // Compare calendar components to reject Date.parse's normalization of invalid dates.
  const date = new Date(`${match[1]}Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === match[1];
}

/**
 * Creates a blank instance from the defaults of an exact system/template pair.
 * @param catalog Validated in-memory catalog used to resolve the requested definitions.
 * @param request Input to validate, containing exact system and template references and an instance role.
 * @param providers Supplies a fresh instance ID for each creation and a UTC timestamp.
 * @param diagnosticSource Caller-chosen label for the request, such as `new-character-request`.
 * It appears as `document` in diagnostics about the request or provider output.
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
  if (!validTimestamp(timestamp)) {
    checks.issue(
      '/createdAt',
      'Expected a real calendar UTC timestamp with seconds ending in Z.',
      'INVALID_VALUE',
    );
    return checks.result<Instance>(undefined);
  }

  const template = resolved.value.template.value;
  return checks.result<Instance>({
    schemaVersion: 1,
    id,
    entityType: template.entityType,
    role: input.role,
    system: { id: resolved.value.system.value.id, version: resolved.value.system.value.version },
    template: { id: template.id, version: template.version },
    displayName: template.defaultDisplayName,
    values: Object.fromEntries(template.inputs.map((field) => [field.id, field.default])),
    entries: [],
    createdAt: timestamp,
    modifiedAt: timestamp,
  });
}

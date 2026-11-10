import { DOCUMENT_SCHEMA_VERSION } from '../definitions/schema-version';
import { calculateBase } from '../calculation/calculate-base';
import { INSTANCE_ROLES } from '../definitions/document-models';
import type { Instance, InstanceRole } from '../definitions/document-models';
import type { InMemoryDefinitionCatalog } from '../definition-processing/in-memory-definition-catalog';
import { resolveDefinitions } from '../definition-processing/resolve-definitions';
import type { DefinitionRequest } from '../definition-processing/resolve-definitions';
import { isUtcTimestamp } from '../definitions/utc-timestamp';
import { createDomainWorkflowLog } from '../workflow-log';
import type { DomainLogging } from '../workflow-log';
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

/**
 * Create a complete sheet from the defaults of an exact system and template pair.
 * @param catalog Validated catalog that supplies the requested definitions.
 * @param request Untrusted request with exact system and template references and an instance role.
 * @param providers Supplies a fresh ID and UTC timestamp after the initial calculation succeeds.
 * @param diagnosticSource Logical request label used in diagnostics about the request or provider output.
 * @param logging Optional shared logger and operation ID for the creation outcome.
 * @returns A new instance with default inputs, final values, presentation and empty entries, or diagnostics.
 */
export function createInstance(
  catalog: InMemoryDefinitionCatalog,
  request: unknown,
  providers: InstanceCreationProviders,
  diagnosticSource: string,
  logging?: DomainLogging,
): ValidationResult<Instance> {
  const log = createDomainWorkflowLog(logging, 'instance.create');
  const checks = new DefinitionChecks(diagnosticSource);
  if (checks.object(request, '', ['system', 'template', 'role'])) {
    checks.reference(request.system, '/system');
    checks.reference(request.template, '/template');
    if (!INSTANCE_ROLES.some((role) => role === request.role))
      checks.issue('/role', `Expected one of: ${INSTANCE_ROLES.join(', ')}.`);
  }
  const validated = checks.result<CreateInstanceRequest>(request);
  if (!validated.success) return log.result('request.validate', validated);
  const input = validated.value;
  const resolved = resolveDefinitions(
    catalog,
    { system: input.system, template: input.template },
    diagnosticSource,
  );
  if (!resolved.success) return log.result('definitions.resolve', resolved);

  const { system, template: locatedTemplate } = resolved.value;
  const template = locatedTemplate.value;
  const values = Object.fromEntries(template.inputs.map((field) => [field.id, field.default]));
  const calculated = calculateBase(locatedTemplate, {
    document: `${diagnosticSource} values`,
    value: values,
  });
  if (!calculated.success) return log.result('defaults.calculate', calculated, 'failed');

  let id: string;
  try {
    id = providers.newId();
  } catch {
    checks.issue('/id', 'The instance ID provider failed.', 'INVALID_VALUE');
    return log.result('id.generate', checks.result<Instance>(undefined), 'failed', 'error');
  }
  checks.slug(id, '/id');
  if (checks.diagnostics.length)
    return log.result('id.validate', checks.result<Instance>(undefined));

  let timestamp: unknown;
  try {
    timestamp = providers.now();
  } catch {
    checks.issue('/createdAt', 'The UTC time provider failed.', 'INVALID_VALUE');
    return log.result('timestamp.read', checks.result<Instance>(undefined), 'failed', 'error');
  }
  if (!isUtcTimestamp(timestamp)) {
    checks.issue(
      '/createdAt',
      'Expected a real calendar UTC timestamp with seconds ending in Z.',
      'INVALID_VALUE',
    );
    return log.result('timestamp.validate', checks.result<Instance>(undefined));
  }

  const instance: Instance = {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id,
    entityType: template.entityType,
    role: input.role,
    system: { id: system.value.id, version: system.value.version },
    template: { id: template.id, version: template.version },
    displayName: template.defaultDisplayName,
    values,
    derived: calculated.value,
    presentation: {
      sections: template.sections,
      fields: Object.fromEntries([
        ...template.inputs.map(({ id, label }) => [id, { label }]),
        ...template.derived.map(({ id, label, unit }) => [
          id,
          unit === undefined ? { label } : { label, unit },
        ]),
      ]),
    },
    entries: [],
    createdAt: timestamp,
    modifiedAt: timestamp,
  };
  return log.result('sheet.build', { success: true, value: instance });
}

import { randomUUID } from 'node:crypto';
import type { ResolvedDefinitions } from '../domain/definition-processing/resolve-definitions';
import type { Diagnostic } from '../domain/definitions/diagnostics';
import { INSTANCE_ROLES } from '../domain/definitions/document-models';
import type { Instance, InstanceRole } from '../domain/definitions/document-models';
import { checkInstanceTemplate } from '../domain/instances/check-instance-template';
import { DefinitionChecks } from '../domain/instances/structural-validation';
import type { ValidationResult } from '../domain/instances/structural-validation';
import { validateInstanceSnapshot } from '../domain/instances/validate-instance-snapshot';
import { sanitizeError } from '../shared/logging-contract';
import type { LogInput, Logger } from '../shared/logging-contract';
import { loadExactDefinitions } from './definition-loader';
import { readLibraryJson, resolveLibraryRoot } from './library-json';
import { SYSTEMS_DIRECTORY } from './library-paths';

interface InstanceAddress {
  systemId: string;
  role: InstanceRole;
  instanceId: string;
}

export type OpenedInstance =
  | { mode: 'editable'; sheet: Instance; definitions: ResolvedDefinitions }
  | { mode: 'read-only'; sheet: Instance; diagnostics: [Diagnostic, ...Diagnostic[]] };

type LoadFailure = Extract<ValidationResult<never>, { success: false }>;

/**
 * Open a saved sheet from its canonical library path using its recorded results.
 * @param libraryRootPath Absolute path to the selected library.
 * @param address Candidate system ID, instance role and stable instance ID.
 * @param logger Shared main-process logger for load checkpoints and outcomes.
 * @returns An editable or read-only sheet, or diagnostics for a rejected load.
 */
export async function loadSavedInstance(
  libraryRootPath: string,
  address: unknown,
  logger: Logger,
): Promise<ValidationResult<OpenedInstance>> {
  const operationId = randomUUID();

  // Keep logging failures separate from the load result.
  function record(input: Omit<LogInput, 'operationId'>): void {
    try {
      logger.record({ ...input, operationId });
    } catch {
      // Logging is best effort.
    }
  }

  // Record the diagnostic code while returning the original rejection to the caller.
  function reject(result: LoadFailure): LoadFailure {
    record({ event: 'instance.load.failed', level: 'warn', reason: result.diagnostics[0].code });
    return result;
  }

  record({ event: 'instance.load.started', level: 'info' });
  try {
    // Derive the path exclusively from a validated address.
    const checks = new DefinitionChecks('saved sheet request');
    if (checks.object(address, '', ['systemId', 'role', 'instanceId'])) {
      checks.slug(address.systemId, '/systemId');
      checks.slug(address.instanceId, '/instanceId');
      if (!INSTANCE_ROLES.some((role) => role === address.role))
        checks.issue('/role', `Expected one of: ${INSTANCE_ROLES.join(', ')}.`);
    }
    const validated = checks.result<InstanceAddress>(address);
    if (!validated.success) return reject(validated);
    const { systemId, role, instanceId } = validated.value;
    const root = await resolveLibraryRoot(libraryRootPath);
    if (!root.success) return reject(root);
    const directory = role === 'character' ? 'characters' : 'monsters';
    const document = `${SYSTEMS_DIRECTORY}/${systemId}/${directory}/${instanceId}.json`;

    const parsed = await readLibraryJson(root.value, document, 'saved sheet');
    if (!parsed.success) return reject(parsed);
    const snapshot = validateInstanceSnapshot(parsed.value, document, { logger, operationId });
    if (!snapshot.success) return snapshot;
    const sheet = snapshot.value;
    const identity = new DefinitionChecks(document);
    if (sheet.id !== instanceId)
      identity.issue('/id', 'Instance ID must match its filename.', 'IDENTITY_MISMATCH');
    if (sheet.role !== role)
      identity.issue('/role', 'Instance role must match its directory.', 'IDENTITY_MISMATCH');
    if (sheet.system.id !== systemId)
      identity.issue('/system/id', 'System ID must match its directory.', 'IDENTITY_MISMATCH');
    const identified = identity.result<Instance>(sheet);
    if (!identified.success) return reject(identified);

    // The instance loader owns the outcome of this exact lookup, including read-only fallback.
    const definitions = await loadExactDefinitions(root.value, {
      system: sheet.system,
      template: sheet.template,
    });
    if (!definitions.success) {
      const { diagnostics } = definitions;
      record({ event: 'instance.load.readonly', level: 'warn', reason: diagnostics[0].code });
      return { success: true, value: { mode: 'read-only', sheet, diagnostics } };
    }
    const compatible = checkInstanceTemplate(sheet, definitions.value.template.value, document);
    if (!compatible.success) return reject(compatible);
    record({ event: 'instance.load.opened', level: 'info' });
    return { success: true, value: { mode: 'editable', sheet, definitions: definitions.value } };
  } catch (error) {
    record({
      event: 'instance.load.failed',
      level: 'error',
      reason: 'UNAVAILABLE',
      error: sanitizeError(error),
    });
    throw error;
  }
}

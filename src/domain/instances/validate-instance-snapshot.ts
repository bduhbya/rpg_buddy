import { checkEntriesAndCollectEffects } from '../calculation/validate-entry-effects';
import { INSTANCE_ROLES } from '../definitions/document-models';
import type { Instance } from '../definitions/document-models';
import { DOCUMENT_SCHEMA_VERSION } from '../definitions/schema-version';
import { isEarlierUtcTimestamp, isUtcTimestamp } from '../definitions/utc-timestamp';
import type { DiagnosticCode } from '../definitions/diagnostics';
import { checkSections } from './check-sections';
import { childPointer, DefinitionChecks } from './structural-validation';
import type { JsonObject, ValidationResult } from './structural-validation';

type SnapshotLogEntry = { operationId: string } & (
  | { event: 'instance.snapshot.validated'; level: 'info' }
  | { event: 'instance.snapshot.invalid'; level: 'warn'; reason: DiagnosticCode }
);

interface SnapshotLogging {
  logger: { record(input: SnapshotLogEntry): void };
  operationId: string;
}

// Narrow a dynamic field map and check the syntax of each own key.
function readFieldMap(value: unknown, pointer: string, checks: DefinitionChecks, minimum = 0) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    checks.issue(pointer, 'Expected a field map object.');
    return [];
  }
  const fields = Object.entries(value as JsonObject);
  if (fields.length < minimum) checks.issue(pointer, 'Expected at least one stored field.');
  for (const [id] of fields) checks.fieldId(id, childPointer(pointer, id));
  return fields;
}

// Check stored numbers and collect the two field sets for coverage and effect validation.
function checkStoredValues(sheet: JsonObject, checks: DefinitionChecks) {
  const inputs = new Set<string>();
  const derived = new Set<string>();
  for (const [key, ids] of [
    ['values', inputs],
    ['derived', derived],
  ] as const) {
    const pointer = `/${key}`;
    for (const [id, value] of readFieldMap(sheet[key], pointer, checks, 1)) {
      const at = childPointer(pointer, id);
      if (key === 'derived' && inputs.has(id))
        checks.issue(at, 'This field is already stored as an editable value.', 'DUPLICATE_ID');
      checks.number(value, at, key === 'values');
      ids.add(id);
    }
  }
  return { inputs, derived };
}

// Check the snapshot's labels, derived units and section coverage without a template.
function checkPresentation(
  value: unknown,
  inputs: Set<string>,
  derived: Set<string>,
  checks: DefinitionChecks,
): void {
  if (!checks.object(value, '/presentation', ['sections', 'fields'])) return;
  const fields = new Set([...inputs, ...derived]);
  const pointer = '/presentation/fields';
  const labeled = new Set<string>();
  for (const [id, field] of readFieldMap(value.fields, pointer, checks)) {
    const at = childPointer(pointer, id);
    labeled.add(id);
    if (!fields.has(id))
      checks.issue(at, 'Presentation must name a stored field.', 'UNKNOWN_FIELD');
    if (!checks.object(field, at, ['label'], ['unit'])) continue;
    checks.text(field.label, `${at}/label`);
    if (Object.hasOwn(field, 'unit')) {
      checks.text(field.unit, `${at}/unit`);
      if (inputs.has(id))
        checks.issue(`${at}/unit`, 'Only a derived field can have a unit.', 'INVALID_VALUE');
    }
  }
  for (const id of fields) {
    if (!labeled.has(id))
      checks.issue(childPointer(pointer, id), 'Stored field needs a label.', 'MISSING_FIELD');
  }
  checkSections(value.sections, { kind: 'snapshot', locations: fields }, checks);
}

// Validate UTC timestamps before comparing them at their recorded precision.
function checkTimestamps(sheet: JsonObject, checks: DefinitionChecks): void {
  const { createdAt, modifiedAt } = sheet;
  const createdValid = isUtcTimestamp(createdAt);
  const modifiedValid = isUtcTimestamp(modifiedAt);
  const message = 'Expected a real calendar UTC timestamp with seconds ending in Z.';
  if (!createdValid) checks.issue('/createdAt', message, 'INVALID_VALUE');
  if (!modifiedValid) checks.issue('/modifiedAt', message, 'INVALID_VALUE');
  if (createdValid && modifiedValid && isEarlierUtcTimestamp(modifiedAt, createdAt))
    checks.issue('/modifiedAt', 'Modification time must not precede creation.', 'INVALID_VALUE');
}

/**
 * Validate a parsed sheet without resolving definitions or evaluating stored results.
 * @param value Parsed JSON data supplied by a saved sheet.
 * @param document Logical document label used in diagnostics.
 * @param logging Optional shared logger and correlation ID for the validation outcome.
 * @returns The original snapshot in the currently supported format, or located diagnostics on failure.
 */
export function validateInstanceSnapshot(
  value: unknown,
  document: string,
  logging?: SnapshotLogging,
): ValidationResult<Instance> {
  const checks = new DefinitionChecks(document);

  // Record one outcome even when a version or shape check ends validation early.
  function finish(): ValidationResult<Instance> {
    const result = checks.result<Instance>(value);
    if (logging) {
      try {
        const { logger, operationId } = logging;
        if (result.success) {
          logger.record({ event: 'instance.snapshot.validated', level: 'info', operationId });
        } else {
          logger.record({
            event: 'instance.snapshot.invalid',
            level: 'warn',
            operationId,
            reason: result.diagnostics[0].code,
          });
        }
      } catch {
        // Logging is best effort and must preserve the validation result.
      }
    }
    return result;
  }

  if (value !== null && typeof value === 'object' && Object.hasOwn(value, 'schemaVersion')) {
    const { schemaVersion } = value as JsonObject;
    if (schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
      checks.issue(
        '/schemaVersion',
        schemaVersion === 1
          ? 'Version 1 sheets lack stored final results. Keep the original file and recreate the sheet in version 2.'
          : `This sheet uses an unsupported schema version. Supply a version ${DOCUMENT_SCHEMA_VERSION} sheet.`,
        'UNSUPPORTED_SCHEMA_VERSION',
      );
      return finish();
    }
  }
  if (
    !checks.object(
      value,
      '',
      [
        'schemaVersion',
        'id',
        'entityType',
        'role',
        'system',
        'template',
        'displayName',
        'values',
        'derived',
        'presentation',
        'entries',
        'createdAt',
        'modifiedAt',
      ],
      ['career', 'metadata'],
    )
  )
    return finish();

  checks.slug(value.id, '/id');
  checks.slug(value.entityType, '/entityType');
  checks.reference(value.system, '/system');
  checks.reference(value.template, '/template');
  checks.text(value.displayName, '/displayName');
  if (!INSTANCE_ROLES.some((role) => role === value.role))
    checks.issue('/role', `Expected one of: ${INSTANCE_ROLES.join(', ')}.`);
  if (Object.hasOwn(value, 'career')) checks.text(value.career, '/career');
  if (Object.hasOwn(value, 'metadata')) checks.metadata(value.metadata, '/metadata');

  checkTimestamps(value, checks);
  const { inputs, derived } = checkStoredValues(value, checks);
  checkPresentation(value.presentation, inputs, derived, checks);
  checkEntriesAndCollectEffects(
    value.entries,
    '/entries',
    derived,
    'a stored derived field',
    checks,
  );
  return finish();
}

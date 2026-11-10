import { calculateWithEntries } from '../calculation/calculate-with-entries';
import { validateEntryEffects } from '../calculation/validate-entry-effects';
import type { InMemoryDefinitionCatalog } from '../definition-processing/in-memory-definition-catalog';
import { resolveDefinitions } from '../definition-processing/resolve-definitions';
import { NONBLANK_TEXT_PATTERN } from '../definitions/definition-patterns';
import type { Entry, Instance } from '../definitions/document-models';
import { sameJsonContent } from '../definitions/json-content';
import { isEarlierUtcTimestamp, isUtcTimestamp } from '../definitions/utc-timestamp';
import { createDomainWorkflowLog } from '../workflow-log';
import type { DomainLogging } from '../workflow-log';
import { DefinitionChecks } from './structural-validation';
import type { ValidationResult } from './structural-validation';

// Positional arguments keep the untrusted operation boundary limited to primitives.
export type InstanceEditOperation =
  | [operation: 'set-value', fieldId: string, value: number]
  | [operation: 'set-display-name', displayName: string]
  | [operation: 'set-career', career: string | null]
  | [operation: 'add-entry' | 'replace-entry', entryJson: string]
  | [operation: 'remove-entry', entryId: string];

// Parsed entry snapshots stay unknown until entry validation succeeds.
type EditCandidate = Omit<Instance, 'entries'> & { entries: unknown[] };

// JSON.parse checks syntax. Scan its input separately because parsing drops duplicate keys.
function parseEntryJson(text: string, checks: DefinitionChecks): unknown {
  let entry: unknown;
  try {
    entry = JSON.parse(text);
  } catch {
    checks.issue('/entry', 'Enter a valid JSON entry snapshot.', 'INVALID_JSON');
    return undefined;
  }

  const containers: (Set<string> | undefined)[] = [];
  let lastStringStart = 0;
  let lastStringEnd = 0;
  for (let index = 0; index < text.length; index++) {
    const token = text[index];
    if (token === '"') {
      lastStringStart = index;
      // Syntax is already valid. Skip escaped characters until the closing quote.
      while (text[++index] !== '"') {
        if (text[index] === '\\') index++;
      }
      lastStringEnd = index + 1;
    } else if (token === '{') containers.push(new Set());
    else if (token === '[') containers.push(undefined);
    else if (token === '}' || token === ']') containers.pop();
    else if (token === ':') {
      // A colon follows an object key. Decode escapes before comparing keys.
      const key = JSON.parse(text.slice(lastStringStart, lastStringEnd)) as string;
      const keys = containers.at(-1)!;
      if (keys.has(key)) {
        checks.issue(
          '/entry',
          'An entry snapshot cannot contain duplicate JSON object keys.',
          'INVALID_JSON',
        );
        return undefined;
      }
      keys.add(key);
    }
  }
  return entry;
}

// Apply one entry operation. Validate the resulting snapshots together before publishing.
function editEntries(
  entries: Entry[],
  operation: 'add-entry' | 'replace-entry' | 'remove-entry',
  argument: unknown,
  checks: DefinitionChecks,
): unknown[] {
  const removing = operation === 'remove-entry';
  const pointer = removing ? '/entryId' : '/entry';
  if (typeof argument !== 'string') {
    checks.issue(pointer, removing ? 'Expected an entry ID string.' : 'Expected entry JSON text.');
    return entries;
  }

  const snapshot = removing ? undefined : parseEntryJson(argument, checks);
  if (checks.diagnostics.length) return entries;
  if (operation === 'add-entry') return [...entries, snapshot];

  const idPointer = removing ? pointer : '/entry/id';
  const id = removing
    ? argument
    : snapshot !== null &&
        typeof snapshot === 'object' &&
        Object.hasOwn(snapshot, 'id') &&
        'id' in snapshot
      ? snapshot.id
      : undefined;
  checks.slug(id, idPointer);
  if (checks.diagnostics.length) return entries;

  const index = entries.findIndex((entry) => entry.id === id);
  if (index === -1) {
    checks.issue(
      idPointer,
      `No entry with ID "${id}" exists in this instance.`,
      'MISSING_REFERENCE',
    );
    return entries;
  }

  const candidate: unknown[] = [...entries];
  if (removing) candidate.splice(index, 1);
  else candidate[index] = snapshot;
  return candidate;
}

// Read only the rest arguments that the call itself supplied, without coercing their values.
function applyOperation(
  instance: Instance,
  operation: readonly unknown[],
  diagnosticSource: string,
): ValidationResult<EditCandidate> {
  const checks = new DefinitionChecks(diagnosticSource);
  const [kind, argument, value] = operation;
  if (operation.length !== (kind === 'set-value' ? 3 : 2)) {
    checks.issue('/operation', 'Supply exactly one edit operation with its required arguments.');
    return checks.result(undefined);
  }

  const candidate: EditCandidate = instance;
  switch (kind) {
    case 'set-value':
      if (typeof argument !== 'string')
        checks.issue('/fieldId', 'Expected an input field ID string.');
      else if (typeof value !== 'number')
        checks.issue('/value', 'Expected a number.', 'INVALID_VALUE');
      else candidate.values = { ...candidate.values, [argument]: value === 0 ? 0 : value };
      break;
    case 'set-display-name':
      if (typeof argument !== 'string' || !NONBLANK_TEXT_PATTERN.test(argument)) {
        checks.issue(
          '/displayName',
          'Enter a display name with at least one non-whitespace character.',
        );
      } else candidate.displayName = argument;
      break;
    case 'set-career':
      if (argument === null) delete candidate.career;
      else if (typeof argument === 'string' && NONBLANK_TEXT_PATTERN.test(argument)) {
        candidate.career = argument;
      } else
        checks.issue(
          '/career',
          'Enter a career with at least one non-whitespace character, or clear it.',
        );
      break;
    case 'add-entry':
    case 'replace-entry':
    case 'remove-entry':
      candidate.entries = editEntries(instance.entries, kind, argument, checks);
      break;
    default:
      checks.issue('/operation', 'Expected a supported instance edit operation.');
  }
  return checks.result(candidate);
}

/**
 * Apply one edit to a private sheet candidate and recalculate only when calculation inputs change.
 * @param catalog Validated catalog that supplies the instance's exact system and template.
 * @param current Previously valid in-memory instance to edit.
 * @param clock Supplies a UTC modification timestamp after validation and any required calculation.
 * Equivalent edits keep the previous timestamp and skip the clock.
 * @param diagnosticSource Label for edit diagnostics, optionally paired with logging context.
 * Calculation uses separate logical documents named by appending " values" and " entries" to this label.
 * @param operation Operation name followed by its primitive arguments. Use null to clear career,
 * JSON text for add or replace, and a local entry ID for remove. Replace uses the ID in the JSON.
 * @returns An independent complete sheet, or diagnostics without partial results.
 */
export function editInstance(
  catalog: InMemoryDefinitionCatalog,
  current: Instance,
  clock: { now(): string },
  diagnosticSource: string | { document: string; logging: DomainLogging },
  ...operation: InstanceEditOperation
): ValidationResult<Instance> {
  const { document, logging } =
    typeof diagnosticSource === 'string'
      ? { document: diagnosticSource, logging: undefined }
      : diagnosticSource;
  const log = createDomainWorkflowLog(logging, 'instance.edit');
  const edited = applyOperation(structuredClone(current), operation, document);
  if (!edited.success) return log.result('change.apply', edited);
  const candidate = edited.value;

  const resolved = resolveDefinitions(
    catalog,
    { system: candidate.system, template: candidate.template },
    document,
  );
  if (!resolved.success) return log.result('definitions.resolve', resolved);

  const template = resolved.value.template;
  const entries = { document: `${document} entries`, value: candidate.entries };
  const valuesChanged = !sameJsonContent(candidate.values, current.values);
  const entriesChanged = !sameJsonContent(candidate.entries, current.entries);
  let effectsChanged = false;
  if (entriesChanged) {
    const validated = validateEntryEffects(template.value, entries);
    if (!validated.success) return log.result('entries.validate', validated);

    // Entry order and descriptive data do not affect the validated effect set.
    const previousEffects = current.entries.flatMap((entry) => entry.effects);
    effectsChanged =
      previousEffects.length !== validated.value.size ||
      previousEffects.some(
        (effect) => !sameJsonContent(effect, validated.value.get(effect.target)?.effect),
      );
  }
  if (valuesChanged || effectsChanged) {
    const calculated = calculateWithEntries(
      template,
      {
        document: `${document} values`,
        value: candidate.values,
      },
      entries,
    );
    if (!calculated.success) return log.result('values.recalculate', calculated, 'failed');
    candidate.derived = calculated.value;
  }
  const changed =
    candidate.displayName !== current.displayName ||
    candidate.career !== current.career ||
    entriesChanged ||
    valuesChanged;

  if (changed) {
    const checks = new DefinitionChecks(document);
    let timestamp: unknown;
    try {
      timestamp = clock.now();
    } catch {
      checks.issue('/modifiedAt', 'The UTC time provider failed.', 'INVALID_VALUE');
      return log.result('timestamp.read', checks.result<Instance>(undefined), 'failed', 'error');
    }
    if (!isUtcTimestamp(timestamp) || isEarlierUtcTimestamp(timestamp, current.modifiedAt)) {
      checks.issue(
        '/modifiedAt',
        'Expected a real UTC timestamp at or after the current modification time.',
        'INVALID_VALUE',
      );
      return log.result('timestamp.validate', checks.result<Instance>(undefined));
    }
    candidate.modifiedAt = timestamp;
  }

  return log.result(
    'sheet.update',
    { success: true, value: candidate as Instance },
    changed ? 'succeeded' : 'unchanged',
  );
}

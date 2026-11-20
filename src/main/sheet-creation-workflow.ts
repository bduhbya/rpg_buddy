import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { INSTANCE_ROLES } from '../domain/definitions/document-models';
import { NONBLANK_TEXT_PATTERN } from '../domain/definitions/definition-patterns';
import { createInstance } from '../domain/instances/create-instance';
import { isSystemId } from '../shared/library-selection';
import type { Logger } from '../shared/logging-contract';
import type {
  SheetCreationOptions,
  SheetCreationRequest,
  SheetCreationResult,
} from '../shared/sheet-creation-contract';
import { inspectLibraryEntry, isPortableSlug } from './library-entries';
import { savedInstancePath } from './library-paths';
import type { LibrarySelection } from './library-selection';
import { createMainWorkflowLog } from './workflow-log';

const REQUEST_DOCUMENT = 'sheet creation request';
type Failure = Extract<SheetCreationResult, { ok: false }>;

/** Main-process operations for creating in-memory sheets from the active library. */
export interface SheetCreationWorkflow {
  /**
   * List the exact template choices for the current selection.
   * @returns The available choices and selection revision, or null when no system is active.
   */
  getSheetCreationOptions(): SheetCreationOptions | null;

  /**
   * Create a sheet for any supported role in memory after checking the selected template and ID availability.
   * @param request Sheet details and the selection revision from the template choices.
   * @returns A complete sheet snapshot or an actionable failure.
   */
  createCharacterSheet(request: SheetCreationRequest): Promise<SheetCreationResult>;
}

// Compare actual entry names to catch case variants and preserve recoverable sheets.
async function inspectDestination(root: string, document: string) {
  const filename = path.posix.basename(document);
  const directory = path.posix.dirname(document);
  const role = path.posix.basename(directory);
  const systemDirectory = path.posix.dirname(directory);
  // Verify each parent before inspecting entries beneath it.
  for (const parent of [path.posix.dirname(systemDirectory), systemDirectory]) {
    if ((await inspectLibraryEntry(root, parent, 'directory')) !== 'present') return 'unsafe';
  }

  const roleState = await inspectLibraryEntry(root, directory, 'directory');
  if (roleState === 'unsafe') return 'unsafe';

  // Check directory spelling even on case-sensitive hosts.
  const siblings = await readdir(path.join(root, systemDirectory));
  if (siblings.some((name) => name !== role && name.toLowerCase() === role)) return 'unsafe';
  if (roleState === 'missing') {
    // A role folder can be absent until the first save. An entry that appeared during inspection needs a retry.
    return siblings.includes(role) ? 'unsafe' : 'available';
  }

  const entries = await readdir(path.join(root, directory));
  // A backup can be the only recoverable revision, and a lock can indicate an ongoing save.
  const occupied = [filename, filename + '.bak', filename + '.lock'];
  return entries.some((entry) => occupied.includes(entry.toLowerCase())) ? 'occupied' : 'available';
}

/**
 * Bind sheet creation to the current library selection and this application's launch.
 * @param selection Supplies the authoritative root, system and revision.
 * @param logger Shared main-process logger for creation outcomes.
 * @returns Methods for listing exact template choices and creating complete in-memory sheets.
 */
export function createSheetWorkflow(
  selection: Pick<LibrarySelection, 'getCreationContext'>,
  logger: Logger,
): SheetCreationWorkflow {
  // Remember successful in-memory creations by library destination for this launch.
  const createdDestinations = new Set<string>();

  // List only exact templates declared by the active manifest.
  function getSheetCreationOptions(): SheetCreationOptions | null {
    const active = selection.getCreationContext();
    if (!active) return null;
    const { manifest, catalog } = active.system;
    return {
      selectionRevision: active.revision,
      templates: manifest.templates.flatMap((reference) => {
        const template = catalog.getTemplate(manifest.id, reference, {
          document: REQUEST_DOCUMENT,
          pointer: '/template',
        });
        return template.success
          ? [{ reference: { ...reference }, label: template.value.value.label }]
          : [];
      }),
    };
  }

  // Build a snapshot only after the request and destination match the current selection.
  async function createCharacterSheet(request: SheetCreationRequest): Promise<SheetCreationResult> {
    const log = createMainWorkflowLog(logger, 'instance.create');
    let step = 'request.validate';

    // Return actionable feedback while keeping input and filesystem details out of the log.
    function reject(code: Failure['code'], message: string, field?: Failure['field']): Failure {
      return log.failure<Failure>(
        { ok: false, code, message, ...(field === undefined ? {} : { field }) },
        { step, level: 'warn', outcome: 'rejected', reason: code },
      );
    }

    // Use the same feedback whether the selection was already stale or changed during I/O.
    function stale(): Failure {
      return reject(
        'STALE_SELECTION',
        'The active library or system changed. Choose a template again.',
      );
    }

    log.record({ step: 'sheet.create', level: 'info', outcome: 'started' });
    try {
      const active = selection.getCreationContext();
      if (!active || request.selectionRevision !== active.revision) return stale();
      const { manifest, catalog } = active.system;
      const template = manifest.templates.find(
        ({ id, version }) => id === request.template.id && version === request.template.version,
      );
      if (!template) {
        return reject(
          'DEFINITION_NOT_FOUND',
          'Choose a template from the active system.',
          'template',
        );
      }
      if (!INSTANCE_ROLES.includes(request.role)) {
        const choices = new Intl.ListFormat('en', { type: 'disjunction' }).format(
          INSTANCE_ROLES.map((role) => role.charAt(0).toUpperCase() + role.slice(1)),
        );
        return reject('INVALID_VALUE', `Choose ${choices}.`, 'role');
      }
      if (!NONBLANK_TEXT_PATTERN.test(request.displayName)) {
        return reject('INVALID_VALUE', 'Enter a display name.', 'displayName');
      }
      if (!isSystemId(request.id) || !isPortableSlug(request.id)) {
        return reject(
          'INVALID_VALUE',
          'Enter a portable ID of up to 64 characters using lowercase letters, digits and single hyphens between parts.',
          'id',
        );
      }

      step = 'destination.inspect';
      if (!isPortableSlug(manifest.id)) {
        return reject(
          'LIBRARY_UNAVAILABLE',
          'The active system ID cannot be used as a portable folder name.',
        );
      }
      const document = savedInstancePath(manifest.id, request.role, request.id);
      const destination = await inspectDestination(active.root, document);

      // The selected library or system may have changed while the filesystem was being inspected.
      step = 'selection.confirm';
      if (selection.getCreationContext()?.revision !== active.revision) return stale();
      step = 'destination.inspect';
      if (destination === 'unsafe') {
        return reject(
          'LIBRARY_UNAVAILABLE',
          'Check that the library has ordinary system and role folders.',
        );
      }
      const destinationKey = path.join(active.root, document);
      if (destination === 'occupied' || createdDestinations.has(destinationKey)) {
        return reject(
          'ID_OCCUPIED',
          'That ID is already in use for this role. Choose another ID.',
          'id',
        );
      }

      // Keep the collision check, snapshot creation, and ID registration in one synchronous turn.
      step = 'sheet.build';
      const result = createInstance(
        catalog,
        { system: { id: manifest.id, version: manifest.version }, template, role: request.role },
        { newId: () => request.id, now: () => new Date().toISOString() },
        REQUEST_DOCUMENT,
      );
      if (!result.success) {
        const { code, message } = result.diagnostics[0];
        return reject(code, message);
      }
      const sheet = { ...result.value, displayName: request.displayName.trim() };
      createdDestinations.add(destinationKey);
      log.outcome({ step, level: 'info', outcome: 'succeeded' });
      return { ok: true, sheet };
    } catch (error) {
      if (
        step === 'destination.inspect' &&
        ['ENOENT', 'EACCES', 'EPERM', 'ENOTDIR'].includes(
          (error as NodeJS.ErrnoException)?.code ?? '',
        )
      ) {
        return reject(
          'LIBRARY_UNAVAILABLE',
          'The library could not be inspected. Check access and try again.',
        );
      }
      return log.failure<Failure>(
        { ok: false, code: 'UNAVAILABLE', message: 'The sheet could not be created. Try again.' },
        { step, level: 'error', outcome: 'failed', reason: 'UNAVAILABLE' },
      );
    }
  }

  return { getSheetCreationOptions, createCharacterSheet };
}

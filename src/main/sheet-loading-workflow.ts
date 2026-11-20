import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { isRecord } from '../shared/logging-contract';
import type { Logger } from '../shared/logging-contract';
import { isSystemId } from '../shared/library-selection';
import type {
  SavedSheetChoice,
  SheetLoadingRequest,
  SheetLoadingResult,
  SheetLoadingWorkflow,
} from '../shared/sheet-loading-contract';
import { loadSavedInstance } from './instance-loader';
import { inspectLibraryEntry, isPortableSlug } from './library-entries';
import { readLibraryJson } from './library-json';
import { savedInstanceDirectory } from './library-paths';
import type { LibrarySelection } from './library-selection';
import { createMainWorkflowLog } from './workflow-log';

const PRIMARY_EXTENSION = '.json';

// Inspect the canonical role directory and read labels from ordinary primary files.
async function listSheets(
  root: string,
  directory: string,
): Promise<SavedSheetChoice[] | undefined> {
  const segments = directory.split('/');
  for (let count = 1; count <= segments.length; count++) {
    const entry = await inspectLibraryEntry(root, segments.slice(0, count).join('/'), 'directory');
    if (entry === 'unsafe') return undefined;
    if (entry === 'missing') return count === segments.length ? [] : undefined;
  }

  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const ids = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(PRIMARY_EXTENSION))
    .map((entry) => entry.name.slice(0, -PRIMARY_EXTENSION.length))
    .filter((id) => isSystemId(id) && isPortableSlug(id))
    .sort();

  // An unreadable or malformed file stays selectable by ID for diagnostics on open.
  const sheets: SavedSheetChoice[] = [];
  for (const id of ids) {
    const result = await readLibraryJson(
      root,
      `${directory}/${id}${PRIMARY_EXTENSION}`,
      'saved sheet',
    );
    const value = result.success ? result.value : undefined;
    const displayName =
      isRecord(value) && value.id === id && typeof value.displayName === 'string'
        ? value.displayName.trim()
        : '';
    sheets.push(displayName ? { id, displayName } : { id });
  }
  return sheets;
}

/**
 * Bind sheet discovery and opening to the authoritative library selection.
 * @param selection Supplies the current root, system, and selection revision.
 * @param logger Shared main-process workflow logger.
 * @returns A handler for validated sheet loading requests.
 */
export function createSheetLoadingWorkflow(
  selection: Pick<LibrarySelection, 'getCreationContext' | 'tryLockSheetOpen'>,
  logger: Logger,
): SheetLoadingWorkflow {
  // Check the selection before and after asynchronous filesystem operations.
  return async function requestSheet(request: SheetLoadingRequest): Promise<SheetLoadingResult> {
    const log = createMainWorkflowLog(logger, 'instance.load');
    const active = selection.getCreationContext();
    const step = request.action === 'list' ? 'sheets.list' : 'selection.check';

    // Report failures owned by the interface workflow. The loader logs its own outcomes.
    function reject(
      code: 'STALE_SELECTION' | 'INVALID_REQUEST' | 'LIBRARY_UNAVAILABLE' | 'BUSY',
    ): SheetLoadingResult {
      const failure: SheetLoadingResult = { ok: false, code };
      return log.failure(failure, {
        step,
        outcome: 'rejected',
        reason: code,
        level: 'warn',
      });
    }

    // An open request must use the revision issued with its list of sheet IDs.
    if (!active || (request.action === 'open' && request.selectionRevision !== active.revision)) {
      return reject('STALE_SELECTION');
    }

    const systemId = active.system.manifest.id;
    if (!isPortableSlug(systemId)) return reject('LIBRARY_UNAVAILABLE');
    try {
      switch (request.action) {
        case 'list': {
          const directory = savedInstanceDirectory(systemId, request.role);
          const sheets = await listSheets(active.root, directory);
          if (selection.getCreationContext()?.revision !== active.revision)
            return reject('STALE_SELECTION');
          if (!sheets) return reject('LIBRARY_UNAVAILABLE');
          log.outcome({ step, outcome: 'succeeded', level: 'info' });
          return { ok: true, action: 'list', sheets, selectionRevision: active.revision };
        }

        case 'open': {
          if (!isPortableSlug(request.id)) return reject('INVALID_REQUEST');
          const release = selection.tryLockSheetOpen();
          if (!release) return reject('BUSY');
          try {
            const result = await loadSavedInstance(
              active.root,
              { systemId, role: request.role, instanceId: request.id },
              logger,
              log.operationId,
            );
            // A selection change during loading invalidates even a successfully opened sheet.
            if (selection.getCreationContext()?.revision !== active.revision)
              return reject('STALE_SELECTION');
            if (!result.success) {
              return {
                ok: false,
                code: result.diagnostics[0].code,
                diagnostics: result.diagnostics,
              };
            }
            // The bridge sends the snapshot and any read-only diagnostics. Definitions stay in main.
            const { mode, sheet } = result.value;
            return mode === 'read-only'
              ? { ok: true, action: 'open', mode, sheet, diagnostics: result.value.diagnostics }
              : { ok: true, action: 'open', mode, sheet };
          } finally {
            release();
          }
        }
      }
    } catch (error) {
      if (request.action === 'list') {
        log.outcome({ step, outcome: 'failed', reason: 'UNAVAILABLE', level: 'error' }, error);
      }
      return { ok: false, code: 'UNAVAILABLE' };
    }
  };
}

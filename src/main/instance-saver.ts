import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { DiagnosticCode } from '../domain/definitions/diagnostics';
import type { Instance } from '../domain/definitions/document-models';
import { parseStrictJson } from '../domain/definitions/strict-json';
import { checkInstanceTemplate } from '../domain/instances/check-instance-template';
import type { ValidationResult } from '../domain/instances/structural-validation';
import { sameInstanceContent } from '../domain/instances/same-instance-content';
import { validateInstanceSnapshot } from '../domain/instances/validate-instance-snapshot';
import type { Logger } from '../shared/logging-contract';
import { loadExactDefinitions } from './definition-loader';
import { inspectLibraryEntry, isPortableSlug } from './library-entries';
import { readLibraryJsonWithBytes, resolveLibraryRoot } from './library-json';
import { savedInstancePath } from './library-paths';
import { createMainWorkflowLog } from './workflow-log';

// Use the shared diagnostic shape for persistence failures without leaking OS error text.
function failure(
  document: string,
  message: string,
  code: DiagnosticCode = 'INVALID_VALUE',
): Extract<ValidationResult<never>, { success: false }> {
  return {
    success: false,
    diagnostics: [{ document, code, message, pointer: '' }],
  };
}

// Require ordinary system directories and create only the role directory when absent.
async function prepareDirectory(root: string, document: string): Promise<boolean> {
  const [systems, system, role] = document.split('/');
  const systemDirectory = systems + '/' + system;
  const directory = systemDirectory + '/' + role;
  for (const parent of [systems, systemDirectory]) {
    if ((await inspectLibraryEntry(root, parent, 'directory')) !== 'present') return false;
  }
  if ((await inspectLibraryEntry(root, directory, 'directory')) === 'missing') {
    await mkdir(path.join(root, directory)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error;
    });
  }
  return (await inspectLibraryEntry(root, directory, 'directory')) === 'present';
}

// Create a private sibling, track it only after exclusive creation, then flush before publication.
async function stageFile(target: string, bytes: string | Uint8Array, owned: Set<string>) {
  const temporary = target + '.' + randomUUID() + '.tmp';
  const handle = await open(temporary, 'wx');
  owned.add(temporary);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  return temporary;
}

// Avoid overwriting a different sheet that happens to use the same canonical filename.
function isPredecessor(previous: Instance, next: Instance): boolean {
  return (
    previous.id === next.id &&
    previous.role === next.role &&
    previous.entityType === next.entityType &&
    previous.createdAt === next.createdAt &&
    previous.system.id === next.system.id &&
    previous.system.version === next.system.version &&
    previous.template.id === next.template.id &&
    previous.template.version === next.template.version
  );
}

/**
 * Save a complete sheet at its canonical path and keep the prior revision on overwrite.
 * @param libraryRootPath Absolute path to the selected library.
 * @param candidate A JSON-compatible snapshot, captured before the first asynchronous operation.
 * @param logger Shared main-process logger for checkpoints and the terminal outcome.
 * @param expectedPredecessor Saved revision the caller started from, or null for a first save. Omit for an unconditional save of the same identity.
 * @returns The persisted snapshot or actionable diagnostics. Stored statistics are never evaluated.
 */
export async function saveInstance(
  libraryRootPath: string,
  candidate: unknown,
  logger: Logger,
  expectedPredecessor?: Instance | null,
): Promise<ValidationResult<Instance>> {
  const log = createMainWorkflowLog(logger, 'instance.save');
  let document = 'sheet to save';
  let step = 'snapshot.validate';
  let lock: Awaited<ReturnType<typeof open>> | undefined;
  let lockPath: string | undefined;
  const temporaryFiles = new Set<string>();

  log.record({ step: 'sheet.save', outcome: 'started', level: 'info' });
  try {
    const snapshot = validateInstanceSnapshot(candidate, document);
    if (!snapshot.success) return log.diagnosticFailure(snapshot, step);

    // Capture the bytes before yielding to filesystem work and validate what a reader will see.
    const bytes = JSON.stringify(snapshot.value, null, 2) + '\n';
    const parsed = parseStrictJson(bytes, document);
    if (!parsed.success) return log.diagnosticFailure(parsed, step);
    const serialized = validateInstanceSnapshot(parsed.value, document);
    if (!serialized.success) return log.diagnosticFailure(serialized, step);
    const sheet = serialized.value;

    // Both IDs become path components. Apply Windows device-name rules on every platform
    // so a library can be moved to Windows with its IDs intact.
    if ([sheet.system.id, sheet.id].some((id) => !isPortableSlug(id))) {
      return log.diagnosticFailure(failure(document, 'Use a portable system and sheet ID.'), step);
    }
    document = savedInstancePath(sheet.system.id, sheet.role, sheet.id);
    log.record({ step, outcome: 'succeeded', level: 'info' });

    step = 'root.resolve';
    const root = await resolveLibraryRoot(libraryRootPath);
    if (!root.success) return log.diagnosticFailure(root, step);

    // Use the revisions recorded in the snapshot and check compatibility without evaluating formulas.
    step = 'definitions.resolve';
    const definitions = await loadExactDefinitions(
      root.value,
      { system: sheet.system, template: sheet.template },
      logger,
      log.operationId,
    );
    if (!definitions.success) return log.diagnosticFailure(definitions, step);
    step = 'template.check';
    const compatible = checkInstanceTemplate(sheet, definitions.value.template.value, document);
    if (!compatible.success) return log.diagnosticFailure(compatible, step);

    // Create a missing role directory only after the snapshot and its exact definitions agree.
    step = 'target.prepare';
    if (!(await prepareDirectory(root.value, document))) {
      return log.diagnosticFailure(
        failure(document, 'Use ordinary system and role directories with their canonical names.'),
        step,
      );
    }
    const target = path.join(root.value, document);
    const backupDocument = document + '.bak';
    const backup = path.join(root.value, backupDocument);

    // Hold the lock across inspection, staging and publication so a second save cannot race the backup.
    step = 'lock.acquire';
    lockPath = target + '.lock';
    lock = await open(lockPath, 'wx').catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error;
      return undefined;
    });
    if (!lock) {
      return log.failure(
        failure(document, 'Another save is in progress or a previous save needs recovery.'),
        { step, outcome: 'rejected', level: 'warn', reason: 'SAVE_LOCKED' },
      );
    }

    step = 'target.inspect';
    const primaryState = await inspectLibraryEntry(root.value, document, 'file');
    const backupState = await inspectLibraryEntry(root.value, backupDocument, 'file');
    if (primaryState === 'unsafe' || backupState === 'unsafe') {
      return log.diagnosticFailure(
        failure(document, 'Use ordinary files with canonical names.'),
        step,
      );
    }
    // A lone backup may be the only recoverable revision. Leave it for explicit recovery.
    if (primaryState === 'missing' && backupState === 'present') {
      return log.diagnosticFailure(
        failure(document, 'Recover the existing backup before saving to this path.'),
        step,
      );
    }

    if (primaryState === 'missing' && expectedPredecessor) {
      return log.diagnosticFailure(
        failure(
          document,
          'The saved sheet is missing. Restore it or reopen the library before retrying.',
          'SAVE_CONFLICT',
        ),
        'predecessor.validate',
      );
    }

    let priorBytes: Uint8Array | undefined;
    if (primaryState === 'present') {
      // Verify the existing file belongs to this sheet and keep its original bytes for rollback.
      step = 'predecessor.validate';
      const prior = await readLibraryJsonWithBytes(root.value, document, 'saved sheet');
      if (!prior.success) return log.diagnosticFailure(prior, step);
      const previous = validateInstanceSnapshot(prior.value.json, document);
      if (!previous.success) return log.diagnosticFailure(previous, step);
      if (!isPredecessor(previous.value, sheet)) {
        return log.diagnosticFailure(
          failure(document, 'A different sheet already occupies this path.', 'IDENTITY_MISMATCH'),
          step,
        );
      }
      // Compare the caller's baseline under the same lock used to publish the replacement.
      if (
        expectedPredecessor !== undefined &&
        !isDeepStrictEqual(previous.value, expectedPredecessor)
      ) {
        return log.diagnosticFailure(
          failure(
            document,
            'The saved sheet has changed. Reopen it before saving again.',
            'SAVE_CONFLICT',
          ),
          step,
        );
      }
      const priorCompatibility = checkInstanceTemplate(
        previous.value,
        definitions.value.template.value,
        document,
      );
      if (!priorCompatibility.success) return log.diagnosticFailure(priorCompatibility, step);
      // An unchanged save must leave both the primary and the prior recovery revision intact.
      if (sameInstanceContent(previous.value, sheet)) {
        log.outcome({ step: 'sheet.save', outcome: 'unchanged', level: 'info' });
        return { success: true, value: previous.value };
      }
      priorBytes = prior.value.bytes;
    }

    step = 'sheet.stage';
    const stagedSheet = await stageFile(target, bytes, temporaryFiles);
    if (priorBytes) {
      // Replace the backup before replacing the primary. At each point a complete prior revision exists.
      step = 'backup.stage';
      const stagedBackup = await stageFile(backup, priorBytes, temporaryFiles);
      step = 'backup.publish';
      await rename(stagedBackup, backup);
      temporaryFiles.delete(stagedBackup);
      log.record({ step, outcome: 'succeeded', level: 'info' });
    }

    // The lock keeps other RPG Buddy saves from changing the target after inspection.
    step = 'sheet.publish';
    await rename(stagedSheet, target);
    temporaryFiles.delete(stagedSheet);

    log.outcome({ step: 'sheet.save', outcome: 'succeeded', level: 'info' });
    return { success: true, value: sheet };
  } catch {
    return log.failure(
      failure(
        document,
        'The sheet could not be saved. Check library permissions and available space, then retry.',
      ),
      { step, outcome: 'failed', level: 'error', reason: 'SAVE_IO_FAILED' },
    );
  } finally {
    // Never remove another writer's lock. Leave any unremovable artifacts for explicit recovery.
    const cleanup = await Promise.allSettled([...temporaryFiles].map((file) => unlink(file)));
    if (cleanup.some((result) => result.status === 'rejected')) {
      log.record({
        step: 'temp.cleanup',
        outcome: 'degraded',
        level: 'warn',
        reason: 'SAVE_CLEANUP_FAILED',
      });
    }
    if (lock && lockPath) {
      try {
        await lock.close();
        await unlink(lockPath);
      } catch {
        log.record({
          step: 'lock.release',
          outcome: 'degraded',
          level: 'warn',
          reason: 'SAVE_CLEANUP_FAILED',
        });
      }
    }
  }
}

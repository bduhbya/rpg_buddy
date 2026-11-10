import { randomUUID } from 'node:crypto';
import { sanitizeError } from '../shared/logging-contract';
import type { LogEvent, LogInput, Logger } from '../shared/logging-contract';

type WorkflowRecord = Omit<LogInput, 'event' | 'operationId' | 'error' | 'step' | 'outcome'> & {
  step: string;
  outcome: string;
};
type FailureRecord = WorkflowRecord & { level: 'warn' | 'error'; reason: string };
type DiagnosticFailure = { success: false; diagnostics: readonly [{ code: string }, ...unknown[]] };

interface WorkflowLogOptions {
  operationId?: string;
  checkpointsOnly?: boolean;
}

/**
 * Create the main-process recorder and helpers for returning existing failure shapes.
 * @param logger Shared application logger.
 * @param event Stable name of the workflow.
 * @param options Reuse an operation ID when supplied and set checkpointsOnly when a caller owns the outcome.
 * @returns Best-effort logging for checkpoints, terminal outcomes, and bounded IPC rejections.
 */
export function createMainWorkflowLog(
  logger: Logger,
  event: LogEvent,
  { operationId = randomUUID(), checkpointsOnly = false }: WorkflowLogOptions = {},
) {
  const lastIpcReport = { warn: -Infinity, error: -Infinity };

  // Sanitize optional exception details and isolate failures of the sink.
  function write(id: string, input: WorkflowRecord, error?: unknown): void {
    try {
      logger.record({
        ...input,
        event,
        operationId: id,
        ...(error === undefined ? {} : { error: sanitizeError(error) }),
      });
    } catch {
      // Diagnostics cannot change the workflow result.
    }
  }

  // Only the boundary that owns the operation emits its terminal record.
  function outcome(input: WorkflowRecord, error?: unknown): void {
    if (!checkpointsOnly) write(operationId, input, error);
  }

  // Report a failure or degradation and preserve the original typed result.
  function failure<T>(result: T, input: FailureRecord, error?: unknown): T {
    outcome(input, error);
    return result;
  }

  return {
    operationId,
    // Record progress even when the caller owns the terminal outcome.
    record(input: WorkflowRecord, error?: unknown): void {
      write(operationId, input, error);
    },
    outcome,
    failure,
    // Derive the reason from a failed validation without changing any of its diagnostics.
    diagnosticFailure<T extends DiagnosticFailure>(result: T, step: string): T {
      return failure(result, {
        step,
        outcome: 'rejected',
        level: 'warn',
        reason: result.diagnostics[0].code,
      });
    },
    // Bound warnings and errors independently so rejected requests cannot hide dispatch failures.
    ipcFailure<Code extends string>(
      code: Code,
      step: string,
      error?: unknown,
    ): { ok: false; code: Code } {
      const now = Date.now();
      const level = code === 'UNAVAILABLE' ? 'error' : 'warn';
      if (now - lastIpcReport[level] >= 1000) {
        lastIpcReport[level] = now;
        write(
          randomUUID(),
          {
            step,
            outcome: code === 'UNAVAILABLE' ? 'failed' : 'rejected',
            level,
            reason: code,
          },
          error,
        );
      }
      return { ok: false, code };
    },
  };
}

import { isTrustedMainFrame } from './trusted-frame';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { isLogRequest, sanitizeError } from '../shared/logging-contract';
import type { LogInput, LogResult } from '../shared/logging-contract';
import type { LogService } from './logging';
import { createMainWorkflowLog } from './workflow-log';

// Authorize exact renderer workflows and keep main-owned steps off the bridge.
function isAuthorizedRendererFailure({ event, step, outcome, level, reason }: LogInput): boolean {
  if (level !== 'error' || outcome !== 'failed') return false;
  switch (event) {
    case 'diagnostic.simulation':
      return step === 'renderer.exercise' && reason === 'SIMULATED_FAILURE';
    case 'renderer.runtime':
      return (
        (step === 'error.capture' && reason === 'UNCAUGHT_ERROR') ||
        (step === 'rejection.capture' && reason === 'UNHANDLED_REJECTION')
      );
    case 'application.info':
      return step === 'bridge.invoke' && reason === 'BRIDGE_UNAVAILABLE';
    case 'library.request':
      return (
        (step === 'view.request' || step === 'folder.request' || step === 'system.request') &&
        reason === 'BRIDGE_UNAVAILABLE'
      );
    default:
      return false;
  }
}

/**
 * Receive approved renderer diagnostics from the trusted frame.
 * @param getOwner Supplies the window that owns the application bridge.
 * @param trustedDocument The exact URL of the trusted renderer document.
 * @param service Shared logging service that validates and queues records.
 * @returns A handler that reports delivery or a typed rejection.
 */

export function createLogHandler(
  getOwner: () => WebContents | undefined,
  trustedDocument: string,
  service: Pick<LogService, 'accept' | 'record'>,
) {
  let start = 0;
  let count = 0;
  const log = createMainWorkflowLog(service, 'diagnostic.request');

  return (event: IpcMainInvokeEvent, ...args: unknown[]): LogResult => {
    try {
      const owner = getOwner();
      if (!isTrustedMainFrame(event, owner, trustedDocument))
        return log.ipcFailure('FORBIDDEN', 'sender.authorize');
      if (Date.now() - start >= 1000) {
        start = Date.now();
        count = 0;
      }
      if (++count > 30) return log.ipcFailure('RATE_LIMITED', 'rate.check');
      if (args.length !== 1 || !isLogRequest(args[0]))
        return log.ipcFailure('INVALID_REQUEST', 'payload.validate');
      const input = args[0].input;
      if (!isAuthorizedRendererFailure(input))
        return log.ipcFailure('INVALID_REQUEST', 'event.authorize');
      const accepted = service.accept(input, 'renderer', owner.getOSProcessId());
      if (!accepted) return { ok: false, code: 'UNAVAILABLE' };
      if (input.event === 'diagnostic.simulation') {
        try {
          throw new Error('Simulated diagnostic failure');
        } catch (error) {
          if (
            !service.accept(
              {
                event: 'diagnostic.simulation',
                step: 'main.exercise',
                outcome: 'failed',
                reason: 'SIMULATED_FAILURE',
                level: 'error',
                operationId: input.operationId,
                error: sanitizeError(error),
              },
              'main',
              process.pid,
            )
          )
            return { ok: false, code: 'UNAVAILABLE' };
        }
      }
      return { ok: true };
    } catch {
      return { ok: false, code: 'UNAVAILABLE' };
    }
  };
}

/** Generate an operation ID for an application diagnostic. */
export function operationId(): string {
  return randomUUID();
}

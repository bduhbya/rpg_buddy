import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { isLogRequest, sanitizeError } from '../shared/logging-contract';
import type { LogResult } from '../shared/logging-contract';
import type { LogService } from './logging';

export function createLogHandler(
  getOwner: () => WebContents | undefined,
  trustedDocument: string,
  service: Pick<LogService, 'accept' | 'record'>,
) {
  let start = 0;
  let count = 0;
  let lastRejection = -Infinity;
  function reject(code: 'FORBIDDEN' | 'INVALID_REQUEST' | 'RATE_LIMITED'): LogResult {
    if (Date.now() - lastRejection >= 1000) {
      lastRejection = Date.now();
      try {
        service.record({
          event: 'diagnostic.request.rejected',
          level: 'warn',
          reason: code,
          operationId: randomUUID(),
        });
      } catch {
        /* Preserve rejection even if logging fails. */
      }
    }
    return { ok: false, code };
  }
  return (event: IpcMainInvokeEvent, ...args: unknown[]): LogResult => {
    try {
      const owner = getOwner();
      if (
        !owner ||
        owner.isDestroyed() ||
        event.sender !== owner ||
        !event.senderFrame ||
        event.senderFrame !== owner.mainFrame ||
        event.senderFrame.url !== trustedDocument ||
        owner.getURL() !== trustedDocument
      )
        return reject('FORBIDDEN');
      if (Date.now() - start >= 1000) {
        start = Date.now();
        count = 0;
      }
      if (++count > 30) return reject('RATE_LIMITED');
      if (args.length !== 1 || !isLogRequest(args[0])) return reject('INVALID_REQUEST');
      const input = args[0].input;
      if (
        !['renderer.error', 'renderer.rejection', 'diagnostic.renderer.failure'].includes(
          input.event,
        ) ||
        input.level !== 'error' ||
        (input.event === 'diagnostic.renderer.failure'
          ? input.reason !== 'SIMULATED_FAILURE'
          : input.reason !== undefined)
      )
        return reject('INVALID_REQUEST');
      const accepted = service.accept(input, 'renderer', owner.getOSProcessId());
      if (!accepted) return { ok: false, code: 'UNAVAILABLE' };
      if (input.event === 'diagnostic.renderer.failure') {
        try {
          throw new Error('Simulated diagnostic failure');
        } catch (error) {
          if (
            !service.accept(
              {
                event: 'diagnostic.main.failure',
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

export function operationId(): string {
  return randomUUID();
}

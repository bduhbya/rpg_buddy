import { sanitizeError } from '../shared/logging-contract';
import type { LogResult } from '../shared/logging-contract';

/**
 * Record errors owned by one renderer workflow through the validated bridge.
 * @param event Stable event name for the workflow.
 * @returns A recorder with delivery status and a helper that returns the supplied fallback.
 */
export function createRendererWorkflowLog(event: string) {
  // Delivery errors stay local so reporting cannot trigger another diagnostic.
  async function recordFailure(
    step: string,
    reason: string,
    error: unknown,
    operationId?: string,
  ): Promise<LogResult> {
    try {
      return await window.rpgBuddy.recordLog({
        event,
        step,
        outcome: 'failed',
        level: 'error',
        reason,
        operationId: operationId ?? crypto.randomUUID(),
        error: sanitizeError(error),
      });
    } catch {
      return { ok: false, code: 'UNAVAILABLE' };
    }
  }

  return {
    recordFailure,
    // Keep UI fallback independent of the sink's availability and response time.
    failure<T>(fallback: T, step: string, reason: string, error: unknown): T {
      void recordFailure(step, reason, error);
      return fallback;
    },
  };
}

const runtimeLog = createRendererWorkflowLog('renderer.runtime');
window.addEventListener('error', (event) => {
  void runtimeLog.recordFailure('error.capture', 'UNCAUGHT_ERROR', event.error);
});
window.addEventListener('unhandledrejection', (event) => {
  void runtimeLog.recordFailure('rejection.capture', 'UNHANDLED_REJECTION', event.reason);
});

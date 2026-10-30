import { sanitizeError } from '../shared/logging-contract';
import type { LogEvent } from '../shared/logging-contract';

export async function recordRendererError(
  event: LogEvent,
  error: unknown,
  operationId = crypto.randomUUID(),
) {
  try {
    return await window.rpgBuddy.recordLog({
      event,
      ...(event === 'diagnostic.renderer.failure' ? { reason: 'SIMULATED_FAILURE' as const } : {}),
      level: 'error',
      operationId,
      error: sanitizeError(error),
    });
  } catch {
    return { ok: false as const, code: 'UNAVAILABLE' as const };
  }
}
window.addEventListener('error', (event) => {
  void recordRendererError('renderer.error', event.error);
});
window.addEventListener('unhandledrejection', (event) => {
  void recordRendererError('renderer.rejection', event.reason);
});

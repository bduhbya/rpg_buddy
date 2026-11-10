import type { Logger } from '../shared/logging-contract';
import type { ValidationResult } from './instances/structural-validation';

export interface DomainLogging {
  logger: Logger;
  operationId: string;
}

/**
 * Record an instance workflow outcome through the caller's logger.
 * @param logging Optional logger and operation ID. Omit for a quiet call.
 * @param event Stable name of the workflow that owns the outcome.
 * @returns A recorder that preserves the original result even if logging fails.
 */
export function createDomainWorkflowLog(logging: DomainLogging | undefined, event: string) {
  // Keep diagnostic messages and document locations in the result.
  function result<T>(
    step: string,
    value: ValidationResult<T>,
    outcome = value.success ? 'succeeded' : 'rejected',
    failureLevel: 'warn' | 'error' = 'warn',
  ): ValidationResult<T> {
    if (logging) {
      try {
        const { logger, operationId } = logging;
        logger.record({
          event,
          step,
          outcome,
          level: value.success ? 'info' : failureLevel,
          operationId,
          ...(value.success ? {} : { reason: value.diagnostics[0].code }),
        });
      } catch {
        // Logging is best effort.
      }
    }
    return value;
  }

  return { result };
}

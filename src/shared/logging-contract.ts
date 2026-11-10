export const LOG_API_VERSION = 1;
export const LOG_CHANNEL = 'diagnostics:record';
export type LogEvent = string;
export type LogReason = string;
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export interface SafeError {
  name: string;
  stack: string;
}
export interface LogInput {
  event: LogEvent;
  level: LogLevel;
  operationId: string;
  error?: SafeError;
  reason?: LogReason;
  step?: string;
  outcome?: string;
}
export interface Logger {
  record(input: LogInput): void;
}
export const noopLogger: Logger = { record: () => {} };
export type LogResult =
  | { ok: true }
  | { ok: false; code: 'INVALID_REQUEST' | 'FORBIDDEN' | 'UNAVAILABLE' | 'RATE_LIMITED' };
export interface LogRequest {
  apiVersion: typeof LOG_API_VERSION;
  input: LogInput;
}
const MAX_LOG_LABEL_LENGTH = 128;
const LOG_EVENT_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/;
const LOG_OUTCOME_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/;
const LOG_REASON_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
const names = [
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
];
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isOperationId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
// Never retain messages, function names, URLs, filenames or arbitrary properties.
export function sanitizeError(error: unknown): SafeError {
  try {
    const name =
      isRecord(error) && names.includes(error.name as string) ? (error.name as string) : 'Error';
    const stack =
      isRecord(error) && typeof error.stack === 'string' ? error.stack.slice(0, 16384) : '';
    const frames = stack
      .split('\n')
      .slice(1, 17)
      .flatMap((line) => {
        const match = /:(\d{1,8}):(\d{1,8})\)?\s*$/.exec(line);
        return match ? [`at [source]:${match[1]}:${match[2]}`] : [];
      });
    return { name, stack: frames.join('\n') };
  } catch {
    return { name: 'Error', stack: '' };
  }
}
/**
 * Validate a record against the shared fields and optional workflow context.
 * @param value Candidate record from a producer or the logging bridge.
 * @returns Whether the record has the supported shape and bounded labels.
 */
export function isLogInput(value: unknown): value is LogInput {
  if (
    !isRecord(value) ||
    Object.keys(value).some(
      (key) =>
        !['event', 'level', 'operationId', 'error', 'reason', 'step', 'outcome'].includes(key),
    )
  )
    return false;
  if (
    value.reason !== undefined &&
    (typeof value.reason !== 'string' ||
      value.reason.length > MAX_LOG_LABEL_LENGTH ||
      !LOG_REASON_PATTERN.test(value.reason))
  )
    return false;
  if (
    typeof value.event !== 'string' ||
    value.event.length > MAX_LOG_LABEL_LENGTH ||
    !LOG_EVENT_PATTERN.test(value.event) ||
    !levels.includes(value.level as string) ||
    !isOperationId(value.operationId)
  )
    return false;
  // Structured records supply both fields. Existing producers can omit the pair.
  if (
    (value.step !== undefined || value.outcome !== undefined) &&
    (typeof value.step !== 'string' ||
      value.step.length > MAX_LOG_LABEL_LENGTH ||
      !LOG_EVENT_PATTERN.test(value.step) ||
      typeof value.outcome !== 'string' ||
      value.outcome.length > MAX_LOG_LABEL_LENGTH ||
      !LOG_OUTCOME_PATTERN.test(value.outcome))
  ) {
    return false;
  }
  if (value.error !== undefined) {
    if (
      !isRecord(value.error) ||
      Object.keys(value.error).length !== 2 ||
      !names.includes(value.error.name as string) ||
      typeof value.error.stack !== 'string'
    )
      return false;
    if (
      value.error.stack.length > 1024 ||
      !/^(?:at \[source\]:\d{1,8}:\d{1,8}(?:\n|$)){0,16}$/.test(value.error.stack)
    )
      return false;
  }
  return true;
}
export function isLogRequest(value: unknown): value is LogRequest {
  return (
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    value.apiVersion === LOG_API_VERSION &&
    isLogInput(value.input)
  );
}
export function isLogResult(value: unknown): value is LogResult {
  return (
    isRecord(value) &&
    (value.ok === true
      ? Object.keys(value).length === 1
      : value.ok === false &&
        Object.keys(value).length === 2 &&
        ['INVALID_REQUEST', 'FORBIDDEN', 'UNAVAILABLE', 'RATE_LIMITED'].includes(
          value.code as string,
        ))
  );
}
export async function requestLog(
  invoke: (channel: string, request: LogRequest) => Promise<unknown>,
  input: LogInput,
): Promise<LogResult> {
  try {
    if (!isLogInput(input)) return { ok: false, code: 'INVALID_REQUEST' };
    const result = await invoke(LOG_CHANNEL, { apiVersion: LOG_API_VERSION, input });
    return isLogResult(result) ? result : { ok: false, code: 'UNAVAILABLE' };
  } catch {
    return { ok: false, code: 'UNAVAILABLE' };
  }
}

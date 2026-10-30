export const LOG_CHANNEL = 'diagnostics:record';
export const LOG_EVENTS = [
  'application.started',
  'application.stopped',
  'application.startup.failed',
  'application.fatal',
  'renderer.error',
  'renderer.rejection',
  'renderer.terminated',
  'diagnostic.renderer.failure',
  'diagnostic.main.failure',
  'application.debug',
  'application.info.failed',
  'diagnostic.request.rejected',
  'diagnostic.debug.enabled',
  'diagnostic.debug.disabled',
] as const;
export type LogEvent = (typeof LOG_EVENTS)[number];
export const LOG_REASONS = [
  'SIMULATED_FAILURE',
  'INVALID_REQUEST',
  'FORBIDDEN',
  'UNAVAILABLE',
  'RATE_LIMITED',
  'WINDOW_STARTUP_FAILED',
  'UNCAUGHT_EXCEPTION',
  'UNHANDLED_REJECTION',
] as const;
export type LogReason = (typeof LOG_REASONS)[number];
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
}
export interface Logger {
  record(input: LogInput): void;
}
export const noopLogger: Logger = { record: () => {} };
export type LogResult =
  | { ok: true }
  | { ok: false; code: 'INVALID_REQUEST' | 'FORBIDDEN' | 'UNAVAILABLE' | 'RATE_LIMITED' };
export interface LogRequest {
  apiVersion: 1;
  input: LogInput;
}
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
export function isLogInput(value: unknown): value is LogInput {
  if (
    !isRecord(value) ||
    Object.keys(value).some(
      (key) => !['event', 'level', 'operationId', 'error', 'reason'].includes(key),
    )
  )
    return false;
  if (value.reason !== undefined && !LOG_REASONS.includes(value.reason as LogReason)) return false;
  if (
    !LOG_EVENTS.includes(value.event as LogEvent) ||
    !levels.includes(value.level as string) ||
    !isOperationId(value.operationId)
  )
    return false;
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
    value.apiVersion === 1 &&
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
    const result = await invoke(LOG_CHANNEL, { apiVersion: 1, input });
    return isLogResult(result) ? result : { ok: false, code: 'UNAVAILABLE' };
  } catch {
    return { ok: false, code: 'UNAVAILABLE' };
  }
}

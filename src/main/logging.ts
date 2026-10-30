import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  truncateSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isLogInput } from '../shared/logging-contract';
import type { Logger, LogInput } from '../shared/logging-contract';

export interface LogMetadata {
  buildId: string;
  appVersion: string;
  electron: string;
  chrome: string;
  node: string;
}
export interface LogOptions {
  directory: string;
  metadata: LogMetadata;
  debug?: boolean;
  development?: boolean;
  maxBytes?: number;
  queueLimit?: number;
  retryMs?: number;
  consoleWrite?: (text: string) => void;
}
export class LogService implements Logger {
  readonly sessionId = randomUUID();
  readonly stats = { dropped: 0, written: 0, failures: 0 };
  private queue: { line: string; deadline: number }[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private closed = false;
  private repaired = false;
  private debug: boolean;
  private readonly maxBytes: number;
  constructor(private readonly options: LogOptions) {
    this.maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
    this.debug = options.debug === true;
  }
  get debugEnabled(): boolean {
    return this.debug;
  }
  setDebugEnabled(enabled: boolean): void {
    if (this.closed || enabled === this.debug) return;
    this.debug = enabled;
    const operationId = randomUUID();
    this.record({
      event: enabled ? 'diagnostic.debug.enabled' : 'diagnostic.debug.disabled',
      level: 'info',
      operationId,
    });
    if (enabled) this.record({ event: 'application.debug', level: 'debug', operationId });
  }
  record(input: LogInput): void {
    this.accept(input, 'main', process.pid);
  }
  accept(input: LogInput, source: 'main' | 'renderer', pid: number): boolean {
    try {
      if (this.closed || !isLogInput(input)) return false;
      if (input.level === 'debug' && !this.debug) return true;
      // Rebuild from approved fields rather than serializing arbitrary objects.
      const record = {
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        operationId: input.operationId,
        source,
        pid,
        ...this.options.metadata,
        event: input.event,
        level: input.level,
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.error ? { stackFormat: 'compiled-js' } : {}),
        ...(input.error ? { error: { name: input.error.name, stack: input.error.stack } } : {}),
      };
      const line = JSON.stringify(record) + '\n';
      if (
        Buffer.byteLength(line) > Math.min(8192, this.maxBytes) ||
        this.queue.length >= (this.options.queueLimit ?? 128)
      ) {
        this.stats.dropped++;
        return false;
      }
      if (this.options.development) {
        try {
          (this.options.consoleWrite ?? console.log)(
            `${record.timestamp} ${record.level.toUpperCase()} ${record.source} ${record.event} build=${record.buildId} session=${record.sessionId} operation=${record.operationId}${record.reason ? ` reason=${record.reason}` : ''}${record.error ? ` stackFormat=compiled-js ${record.error.name} ${record.error.stack}` : ''}`,
          );
        } catch {
          /* console failure must not affect storage */
        }
      }
      this.queue.push({ line, deadline: Date.now() + (this.options.retryMs ?? 2000) });
      const failures = this.stats.failures;
      this.pump();
      return this.stats.failures === failures;
    } catch {
      this.stats.failures++;
      return false;
    }
  }
  private alive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code !== 'ESRCH';
    }
  }
  private acquire(): (() => void) | undefined {
    const directory = this.options.directory;
    mkdirSync(directory, { recursive: true });
    const lock = path.join(directory, '.writer.lock');
    const recovery = path.join(directory, '.recovery.lock');
    // Called only while holding the recovery guard.
    const removeDead = (file: string) => {
      try {
        const pid = Number(readFileSync(file, 'utf8'));
        if (Number.isInteger(pid) && pid > 0 && !this.alive(pid)) rmSync(file);
      } catch {
        /* contention or incomplete owner: conservative timeout */
      }
    };
    // Unknown or abandoned recovery guards fail closed. Manual removal while
    // all applications are stopped is safer than racing two stale-lock reapers.
    if (existsSync(recovery)) return undefined;
    let fd: number;
    try {
      fd = openSync(lock, 'wx');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      // Only one contender may reclaim a stale writer at a time.
      let guard: number;
      try {
        guard = openSync(recovery, 'wx');
      } catch {
        return undefined;
      }
      try {
        writeSync(guard, String(process.pid));
        removeDead(lock);
      } finally {
        closeSync(guard);
        rmSync(recovery, { force: true });
      }
      return undefined;
    }
    writeSync(fd, String(process.pid));
    if (existsSync(recovery)) {
      closeSync(fd);
      rmSync(lock, { force: true });
      return undefined;
    }
    return () => {
      closeSync(fd);
      rmSync(lock, { force: true });
    };
  }
  private files(): string[] {
    return ['application.jsonl', ...[1, 2, 3, 4].map((n) => `application.${n}.jsonl`)];
  }
  private repair(): void {
    for (const file of this.files()) {
      const full = path.join(this.options.directory, file);
      if (!existsSync(full)) continue;
      const size = statSync(full).size;
      if (size > this.maxBytes) {
        truncateSync(full, 0);
        continue;
      }
      const content = readFileSync(full, 'utf8');
      // Scan bounded content: preserve complete parseable records only.
      const lines = content.split('\n');
      lines.pop();
      const valid = lines.filter((line) => {
        try {
          JSON.parse(line);
          return true;
        } catch {
          return false;
        }
      });
      const repaired = valid.length ? valid.join('\n') + '\n' : '';
      if (repaired !== content) {
        const fd = openSync(full, 'w');
        try {
          writeSync(fd, repaired);
        } finally {
          closeSync(fd);
        }
      }
    }
  }
  private write(line: string, deadline: number): boolean {
    if (!this.repaired) {
      this.repair();
      this.repaired = true;
    }
    const files = this.files().map((file) => path.join(this.options.directory, file));
    const active = files[0]!;
    // Another process may have died during append since our initial repair.
    if (existsSync(active)) {
      const size = statSync(active).size;
      if (size) {
        const fd = openSync(active, 'r');
        const tail = Buffer.alloc(Math.min(size, 8192));
        try {
          readSync(fd, tail, 0, tail.length, size - tail.length);
        } finally {
          closeSync(fd);
        }
        if (tail[tail.length - 1] !== 10) {
          const newline = tail.lastIndexOf(10);
          truncateSync(active, newline < 0 ? 0 : size - tail.length + newline + 1);
        }
      }
    }
    if (deadline <= Date.now()) return false;
    if (existsSync(active) && statSync(active).size + Buffer.byteLength(line) > this.maxBytes) {
      rmSync(files[4]!, { force: true });
      for (let n = 3; n >= 0; n--) if (existsSync(files[n]!)) renameSync(files[n]!, files[n + 1]!);
    }
    const fd = openSync(active, 'a');
    try {
      // Preparation/rotation may have taken time after pump's deadline check.
      // Once an append starts, finish the record to preserve JSON Lines.
      if (deadline <= Date.now()) return false;
      const buffer = Buffer.from(line);
      let offset = 0;
      while (offset < buffer.length)
        offset += writeSync(fd, buffer, offset, buffer.length - offset);
      return true;
    } finally {
      closeSync(fd);
    }
  }
  private pump(): void {
    if (this.timer) return;
    this.dropExpired();
    if (!this.queue.length) return;
    let release: (() => void) | undefined;
    try {
      release = this.acquire();
      if (release) {
        while (this.queue.length) {
          if (this.queue[0]!.deadline <= Date.now()) {
            this.queue.shift();
            this.stats.dropped++;
            continue;
          }
          const entry = this.queue[0]!;
          const written = this.write(entry.line, entry.deadline);
          this.queue.shift();
          if (written) this.stats.written++;
          else this.stats.dropped++;
        }
      }
    } catch {
      this.stats.failures++;
      this.stats.dropped += this.queue.length;
      this.queue = [];
    } finally {
      try {
        release?.();
      } catch {
        this.stats.failures++;
      }
    }
    this.dropExpired();
    if (this.queue.length)
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.pump();
      }, 20);
  }
  private dropExpired(): void {
    const now = Date.now();
    this.queue = this.queue.filter((entry) => {
      if (entry.deadline > now) return true;
      this.stats.dropped++;
      return false;
    });
  }
  async flush(timeoutMs = 2200): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (this.queue.length && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 20));
  }
  async close(): Promise<void> {
    this.closed = true;
    await this.flush();
    if (this.timer) clearTimeout(this.timer);
    this.stats.dropped += this.queue.length;
    this.queue = [];
  }
}

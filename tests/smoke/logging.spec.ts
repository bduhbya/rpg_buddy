import { test, expect } from '@playwright/test';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  statSync,
  cpSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mock } from 'node:test';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { LogService } from '../../src/main/logging';
import { createLogHandler } from '../../src/main/logging-ipc';
import { createApplicationInfoHandler } from '../../src/main/application-info';
import {
  isLogInput,
  isLogRequest,
  requestLog,
  sanitizeError,
  noopLogger,
} from '../../src/shared/logging-contract';
import type { LogInput } from '../../src/shared/logging-contract';

const metadata = {
  buildId: 'test-build',
  appVersion: '0.1.0',
  electron: '45',
  chrome: '150',
  node: '26',
};
const input = (): LogInput => ({
  event: 'application.started',
  level: 'info',
  operationId: randomUUID(),
});
let temporary: string;
test.beforeEach(() => {
  temporary = mkdtempSync(path.join(os.tmpdir(), 'rpg-logging-'));
});
test.afterEach(() => {
  rmSync(temporary, { recursive: true, force: true });
});
function records(directory = temporary) {
  return readdirSync(directory)
    .filter((f) => f.endsWith('.jsonl'))
    .flatMap((file) => {
      const text = readFileSync(path.join(directory, file), 'utf8');
      expect(text === '' || text.endsWith('\n')).toBe(true);
      return text
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    });
}

test('logging privacy, exact contracts and safe transport', async () => {
  const error = new TypeError('password=secret; character=private; C:\\Users\\Alice\\sheet.json');
  error.stack =
    'TypeError: credential\n at secretFunction (C:\\Users\\Alice\\sheet.json:123:45)\n at https://host/token?secret:2:3';
  expect(sanitizeError(error)).toEqual({
    name: 'TypeError',
    stack: 'at [source]:123:45\nat [source]:2:3',
  });
  const hostile = new Proxy(
    {},
    {
      get() {
        throw Error('hostile');
      },
    },
  );
  expect(sanitizeError(hostile)).toEqual({ name: 'Error', stack: '' });
  const good = { ...input(), error: sanitizeError(error) };
  expect(isLogInput(good)).toBe(true);
  for (const bad of [
    null,
    {},
    { ...good, text: 'secret' },
    { ...good, operationId: 'secret' },
    { ...good, event: 'secret' },
    { ...good, level: 'secret' },
    { ...good, reason: 'password=secret' },
    { ...good, reason: { password: 'secret' } },
    { ...good, buildId: 'spoofed-build' },
    { ...good, stackFormat: 'repository-source' },
    { ...good, error: { name: 'Error', stack: 'C:\\Users\\Alice' } },
    { ...good, error: { name: 'Error', stack: 'x'.repeat(9000) } },
  ])
    expect(isLogInput(bad)).toBe(false);
  expect(isLogRequest({ apiVersion: 1, input: good, extra: true })).toBe(false);
  expect(isLogRequest({ apiVersion: 2, input: good })).toBe(false);
  expect(
    await requestLog(async () => {
      throw error;
    }, good),
  ).toEqual({ ok: false, code: 'UNAVAILABLE' });
  expect(await requestLog(async () => ({ ok: true, private: 'secret' }), good)).toEqual({
    ok: false,
    code: 'UNAVAILABLE',
  });
  expect(
    await requestLog(async (channel, request) => {
      expect(channel).toBe('diagnostics:record');
      expect(request).toEqual({ apiVersion: 1, input: good });
      return { ok: true };
    }, good),
  ).toEqual({ ok: true });
  noopLogger.record(good);
  const consoleLines: string[] = [];
  const service = new LogService({
    directory: temporary,
    metadata,
    development: true,
    consoleWrite: (line) => consoleLines.push(line),
  });
  service.record(good);
  service.record({ ...input(), level: 'debug' });
  await service.close();
  expect(records()).toHaveLength(1);
  expect(JSON.stringify(records()) + consoleLines.join('')).not.toMatch(
    /Alice|secret|password|private|sheet\.json/,
  );
  expect(consoleLines[0]).toContain('INFO main application.started');
  expect(consoleLines[0]).toContain('build=test-build');
  expect(records()[0]).toMatchObject({ buildId: 'test-build', stackFormat: 'compiled-js' });
  const debug = new LogService({ directory: temporary, metadata, debug: true });
  debug.record({ ...input(), level: 'debug' });
  await debug.close();
  expect(records().some((row) => row.level === 'debug')).toBe(true);
});

test('build identifiers fingerprint maintained inputs, mode and no-Git source archives', () => {
  const require = createRequire(import.meta.url);
  const { createBuildId } = require('../../build/identity.cjs') as {
    createBuildId(root: string, mode?: string): string;
  };
  const fixture = path.join(temporary, 'source-archive');
  mkdirSync(fixture);
  for (const file of [
    'package.json',
    'package-lock.json',
    'index.html',
    'tsconfig.json',
    'forge.config.cjs',
    'webpack.main.config.cjs',
    'webpack.renderer.config.cjs',
    'build',
    'src',
  ])
    cpSync(path.resolve(file), path.join(fixture, file), { recursive: true });
  const initial = createBuildId(fixture);
  expect(initial).toMatch(/^nogit-[a-f0-9]{20}-production-[a-z0-9]+-[a-z0-9]+$/);
  expect(createBuildId(fixture)).toBe(initial);
  expect(createBuildId(fixture, 'development')).not.toBe(initial);
  writeFileSync(
    path.join(fixture, 'README.md'),
    'documentation changes do not change executable inputs',
  );
  expect(createBuildId(fixture)).toBe(initial);
  for (const file of [
    'src/shared/logging-contract.ts',
    'webpack.main.config.cjs',
    'package-lock.json',
  ]) {
    const full = path.join(fixture, file);
    const original = readFileSync(full);
    writeFileSync(full, Buffer.concat([original, Buffer.from('\n')]));
    expect(createBuildId(fixture)).not.toBe(initial);
    writeFileSync(full, original);
    expect(createBuildId(fixture)).toBe(initial);
  }
  const relocated = path.join(temporary, 'relocated');
  cpSync(fixture, relocated, { recursive: true });
  expect(createBuildId(relocated)).toBe(initial);
});

test('runtime debug setting filters subsequent records and preserves other levels', async () => {
  const service = new LogService({ directory: temporary, metadata });
  expect(service.debugEnabled).toBe(false);
  const before = { ...input(), level: 'debug' as const };
  service.record(before);
  service.setDebugEnabled(true);
  expect(service.debugEnabled).toBe(true);
  service.setDebugEnabled(true); // No duplicate transition.
  const enabled = { ...input(), level: 'debug' as const };
  service.record(enabled);
  service.setDebugEnabled(false);
  service.setDebugEnabled(false);
  const after = { ...input(), level: 'debug' as const };
  service.record(after);
  for (const level of ['info', 'warn', 'error', 'fatal'] as const)
    service.record({ ...input(), level });
  await service.close();
  const rows = records();
  expect(
    rows.some(
      (row) => row.operationId === before.operationId || row.operationId === after.operationId,
    ),
  ).toBe(false);
  expect(rows.some((row) => row.operationId === enabled.operationId)).toBe(true);
  expect(rows.filter((row) => row.event === 'diagnostic.debug.enabled')).toHaveLength(1);
  expect(rows.filter((row) => row.event === 'diagnostic.debug.disabled')).toHaveLength(1);
  const transition = rows.find((row) => row.event === 'diagnostic.debug.enabled')!;
  expect(
    rows.some(
      (row) => row.event === 'application.debug' && row.operationId === transition.operationId,
    ),
  ).toBe(true);
  for (const level of ['info', 'warn', 'error', 'fatal'])
    expect(rows.some((row) => row.level === level)).toBe(true);
  const restarted = new LogService({ directory: temporary, metadata });
  expect(restarted.debugEnabled).toBe(false);
  await restarted.close();
  const optedIn = new LogService({ directory: temporary, metadata, debug: true });
  expect(optedIn.debugEnabled).toBe(true);
  optedIn.setDebugEnabled(false);
  expect(optedIn.debugEnabled).toBe(false);
  await optedIn.close();
});

test('known IPC failure reasons are searchable, bounded and cannot disrupt replies', () => {
  const url = 'file:///trusted/index.html';
  const frame = { url };
  const owner = {
    isDestroyed: () => false,
    mainFrame: frame,
    getURL: () => url,
    getOSProcessId: () => 123,
  } as unknown as WebContents;
  const trusted = { sender: owner, senderFrame: frame } as unknown as IpcMainInvokeEvent;
  const untrusted = { sender: {}, senderFrame: frame } as unknown as IpcMainInvokeEvent;
  for (const [event, args, reason] of [
    [untrusted, [], 'FORBIDDEN'],
    [trusted, [null], 'INVALID_REQUEST'],
  ] as const) {
    const reports: LogInput[] = [];
    const logger = { record: (entry: LogInput) => reports.push(entry) };
    const info = createApplicationInfoHandler(
      () => owner,
      url,
      () => {
        throw new Error('private');
      },
      logger,
    );
    for (let n = 0; n < 10; n++) expect(info(event, ...args)).toEqual({ ok: false, code: reason });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ event: 'application.info.failed', reason });
    reports.length = 0;
    const logging = createLogHandler(() => owner, url, { ...logger, accept: () => true });
    for (let n = 0; n < 10; n++)
      expect(logging(event, ...args)).toEqual({ ok: false, code: reason });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ event: 'diagnostic.request.rejected', reason });
  }
  const reports: LogInput[] = [];
  const info = createApplicationInfoHandler(
    () => owner,
    url,
    () => {
      throw new TypeError('password=private');
    },
    { record: (entry) => reports.push(entry) },
  );
  expect(info(trusted, { apiVersion: 1 })).toEqual({ ok: false, code: 'UNAVAILABLE' });
  expect(reports[0]).toMatchObject({ event: 'application.info.failed', reason: 'UNAVAILABLE' });
  expect(JSON.stringify(reports)).not.toMatch(/password|private/);
  const broken = createApplicationInfoHandler(
    () => owner,
    url,
    () => {
      throw new Error('private');
    },
    {
      record: () => {
        throw Error('backend');
      },
    },
  );
  expect(broken(trusted, { apiVersion: 1 })).toEqual({ ok: false, code: 'UNAVAILABLE' });
  const flood: LogInput[] = [];
  const handle = createLogHandler(() => owner, url, {
    accept: () => true,
    record: (entry) => flood.push(entry),
  });
  const request = { apiVersion: 1, input: { ...input(), event: 'renderer.error', level: 'error' } };
  for (let n = 0; n < 30; n++) expect(handle(trusted, request)).toEqual({ ok: true });
  expect(handle(trusted, request)).toEqual({ ok: false, code: 'RATE_LIMITED' });
  expect(flood[0]).toMatchObject({ event: 'diagnostic.request.rejected', reason: 'RATE_LIMITED' });
  expect(
    createLogHandler(() => owner, url, { accept: () => true, record: () => {} })(trusted, {
      ...request,
      input: { ...request.input, reason: 'UNCAUGHT_EXCEPTION' },
    }),
  ).toEqual({ ok: false, code: 'INVALID_REQUEST' });
});

test('rotates within five files and repairs restart corruption without losing complete records', async () => {
  const first = input();
  const service = new LogService({ directory: temporary, metadata, maxBytes: 1000 });
  service.record(first);
  await service.close();
  const active = path.join(temporary, 'application.jsonl');
  writeFileSync(active, readFileSync(active, 'utf8') + '{"interrupted":');
  const restarted = new LogService({ directory: temporary, metadata, maxBytes: 1000 });
  restarted.record(input());
  expect(records().some((row) => row.operationId === first.operationId)).toBe(true);
  for (let n = 0; n < 50; n++) restarted.record(input());
  await restarted.close();
  const files = readdirSync(temporary).filter((f) => f.endsWith('.jsonl'));
  expect(files).toHaveLength(5);
  expect(
    files.reduce((total, f) => {
      const size = statSync(path.join(temporary, f)).size;
      expect(size).toBeLessThanOrEqual(1000);
      return total + size;
    }, 0),
  ).toBeLessThanOrEqual(5000);
  expect(records().length).toBeGreaterThan(0);
  expect(new Set(records().map((row) => row.operationId)).size).toBe(records().length);
});

test('logging failures, queue saturation, live locks and oversize records stay bounded', async () => {
  const blocked = path.join(temporary, 'file');
  writeFileSync(blocked, 'not a directory');
  const failure = new LogService({ directory: blocked, metadata });
  expect(() => failure.record(input())).not.toThrow();
  await failure.close();
  expect(failure.stats.failures).toBeGreaterThan(0);
  writeFileSync(path.join(temporary, '.writer.lock'), String(process.pid));
  const service = new LogService({ directory: temporary, metadata, queueLimit: 2, retryMs: 40 });
  for (let n = 0; n < 10; n++) service.record(input());
  await service.close();
  expect(service.stats.dropped).toBe(10);
  expect(readFileSync(path.join(temporary, '.writer.lock'), 'utf8')).toBe(String(process.pid));
  rmSync(path.join(temporary, '.writer.lock'));
  const tiny = new LogService({ directory: temporary, metadata, maxBytes: 50 });
  tiny.record(input());
  await tiny.close();
  expect(tiny.stats.dropped).toBe(1);
  expect(records()).toEqual([]);
});

test('expired records are dropped when contention clears at or after their deadline', async () => {
  for (const elapsed of [40, 80]) {
    const directory = path.join(temporary, `expiry-${elapsed}`);
    mkdirSync(directory);
    const lock = path.join(directory, '.writer.lock');
    writeFileSync(lock, String(process.pid));
    let now = 1000;
    const clock = mock.method(Date, 'now', () => now);
    const service = new LogService({ directory, metadata, retryMs: 40 });
    try {
      service.record(input());
      expect(service.stats.written).toBe(0);
      now += elapsed;
      // Real retry timer has not fired yet: release contention before its next
      // callback, simulating a delayed event loop without timing-dependent sleep.
      rmSync(lock);
      await service.close();
      expect(service.stats.written).toBe(0);
      expect(service.stats.dropped).toBe(1);
      expect(records(directory)).toEqual([]);
    } finally {
      clock.mock.restore();
      await service.close();
    }
  }
});

test('expiration drops the old queued record while preserving a newer live record', async () => {
  const lock = path.join(temporary, '.writer.lock');
  writeFileSync(lock, String(process.pid));
  let now = 1000;
  const clock = mock.method(Date, 'now', () => now);
  const service = new LogService({ directory: temporary, metadata, retryMs: 40 });
  const expired = input();
  const live = input();
  try {
    service.record(expired);
    now = 1020;
    service.record(live);
    now = 1040;
    rmSync(lock);
    await service.close();
    expect(service.stats).toMatchObject({ written: 1, dropped: 1 });
    expect(records().map((row) => row.operationId)).toEqual([live.operationId]);
  } finally {
    clock.mock.restore();
    await service.close();
  }
});

test('a record expiring during restart inspection is not appended', async () => {
  const active = path.join(temporary, 'application.jsonl');
  const existing = '{"repairProbe":true}\n';
  writeFileSync(active, existing);
  let now = 1000;
  const clock = mock.method(Date, 'now', () => now);
  const parse = JSON.parse;
  const inspection = mock.method(
    JSON,
    'parse',
    (text: string, reviver?: Parameters<typeof JSON.parse>[1]) => {
      // Model time passing during valid-record inspection, after pump's initial
      // deadline check. Do not rely on how fast a filesystem happens to be.
      if (text.includes('"repairProbe"')) now = 1040;
      return parse(text, reviver);
    },
  );
  const service = new LogService({ directory: temporary, metadata, retryMs: 40 });
  try {
    service.record(input());
    await service.close();
    expect(service.stats).toMatchObject({ written: 0, dropped: 1 });
    expect(readFileSync(active, 'utf8')).toBe(existing);
  } finally {
    inspection.mock.restore();
    clock.mock.restore();
    await service.close();
  }
});

test('logging IPC validates sender, frame, payload, rate and safe results', () => {
  const url = 'file:///trusted/index.html';
  const frame = { url };
  const owner = {
    isDestroyed: () => false,
    mainFrame: frame,
    getURL: () => url,
    getOSProcessId: () => 123,
  } as unknown as WebContents;
  const event = { sender: owner, senderFrame: frame } as unknown as IpcMainInvokeEvent;
  const service = new LogService({ directory: temporary, metadata });
  const handle = createLogHandler(() => owner, url, service);
  const request = {
    apiVersion: 1,
    input: {
      ...input(),
      event: 'diagnostic.renderer.failure',
      reason: 'SIMULATED_FAILURE',
      level: 'error',
      error: sanitizeError(new Error('private')),
    },
  };
  expect(handle(event, request)).toEqual({ ok: true });
  expect(
    records()
      .map((row) => row.event)
      .sort(),
  ).toEqual(['diagnostic.main.failure', 'diagnostic.renderer.failure']);
  expect(new Set(records().map((row) => row.operationId)).size).toBe(1);
  for (const bad of [
    { sender: {}, senderFrame: frame },
    { sender: owner, senderFrame: null },
    { sender: owner, senderFrame: { url } },
  ])
    expect(handle(bad as unknown as IpcMainInvokeEvent, request)).toEqual({
      ok: false,
      code: 'FORBIDDEN',
    });
  frame.url += '?wrong';
  expect(handle(event, request)).toEqual({ ok: false, code: 'FORBIDDEN' });
  frame.url = url;
  for (const args of [
    [],
    [null],
    [{ ...request, extra: true }],
    [request, 'extra'],
    [{ ...request, input: input() }],
  ])
    expect(handle(event, ...args)).toEqual({ ok: false, code: 'INVALID_REQUEST' });
  for (let n = 0; n < 30; n++) handle(event, request);
  expect(handle(event, request)).toEqual({ ok: false, code: 'RATE_LIMITED' });
});

test('independent processes coordinate rotation and recover a dead writer', async () => {
  test.setTimeout(60000);
  const require = createRequire(import.meta.url);
  const webpack = require('webpack') as typeof import('webpack');
  const base = require('../../webpack.main.config.cjs') as import('webpack').Configuration;
  const bundle = path.join(temporary, 'bundle');
  mkdirSync(bundle);
  await new Promise<void>((resolve, reject) => {
    const compiler = webpack({
      ...base,
      mode: 'development',
      target: 'node',
      devtool: false,
      entry: path.resolve('tests/fixtures/logging-worker.ts'),
      output: { path: bundle, filename: 'worker.cjs' },
    });
    compiler.run((error, stats) => {
      compiler.close(() => {});
      if (error || stats?.hasErrors()) reject(error ?? Error(stats?.toString()));
      else resolve();
    });
  });
  async function worker(directory: string, max: number, count: number) {
    const child = spawn(
      process.execPath,
      [path.join(bundle, 'worker.cjs'), directory, String(max), String(count)],
      { windowsHide: true },
    );
    let output = '';
    let errors = '';
    child.stdout.on('data', (data) => (output += data.toString()));
    child.stderr.on('data', (data) => (errors += data.toString()));
    const pid = child.pid!;
    await new Promise<void>((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code) => (code === 0 ? resolve() : reject(Error(errors))));
    });
    return { pid, stats: JSON.parse(output) as { written: number; dropped: number } };
  }
  const directory = path.join(temporary, 'logs');
  const results = await Promise.all([
    worker(directory, 5 * 1024 * 1024, 30),
    worker(directory, 5 * 1024 * 1024, 30),
    worker(directory, 5 * 1024 * 1024, 30),
  ]);
  expect(results.map((row) => row.stats.written)).toEqual([30, 30, 30]);
  expect(records(directory)).toHaveLength(90);
  expect(new Set(records(directory).map((row) => row.operationId)).size).toBe(90);
  writeFileSync(path.join(directory, '.writer.lock'), String(results[0]!.pid));
  const recovery = new LogService({ directory, metadata });
  recovery.record(input());
  await recovery.close();
  expect(recovery.stats.written).toBe(1);
  const rotated = path.join(temporary, 'rotated');
  await Promise.all([worker(rotated, 1000, 30), worker(rotated, 1000, 30)]);
  const files = readdirSync(rotated).filter((f) => f.endsWith('.jsonl'));
  expect(files.length).toBeLessThanOrEqual(5);
  for (const file of files)
    expect(statSync(path.join(rotated, file)).size).toBeLessThanOrEqual(1000);
  expect(records(rotated).length).toBeGreaterThan(0);
});

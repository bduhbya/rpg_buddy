import { test, expect } from '@playwright/test';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { createApplicationInfoHandler } from '../../src/main/application-info';
import { isApplicationInfoResult, requestApplicationInfo } from '../../src/shared/application-info';

test('boundary validates payloads and rejects untrusted sender identities', async () => {
  const url = 'file:///trusted/index.html';
  const frame = { url };
  let destroyed = false;
  const owner = {
    isDestroyed: () => destroyed,
    mainFrame: frame,
    getURL: () => url,
  } as unknown as WebContents;
  const event = { sender: owner, senderFrame: frame } as unknown as IpcMainInvokeEvent;
  const info = { name: 'RPG Buddy', version: '0.1.0', electron: '45', chrome: '150', node: '26' };
  let reads = 0;
  const handle = createApplicationInfoHandler(
    () => owner,
    url,
    () => {
      reads++;
      return info;
    },
  );
  expect(handle(event, { apiVersion: 1 })).toEqual({ ok: true, info });
  for (const payload of [
    null,
    undefined,
    [],
    'info',
    {},
    { apiVersion: '1' },
    { apiVersion: 2 },
    { apiVersion: 1, path: 'secret' },
  ]) {
    expect(handle(event, payload)).toEqual({ ok: false, code: 'INVALID_REQUEST' });
  }
  expect(handle(event)).toEqual({ ok: false, code: 'INVALID_REQUEST' });
  expect(handle(event, { apiVersion: 1 }, 'extra')).toEqual({ ok: false, code: 'INVALID_REQUEST' });
  for (const untrusted of [
    { sender: {}, senderFrame: frame },
    { sender: owner, senderFrame: null },
    { sender: owner, senderFrame: { url } },
  ]) {
    expect(handle(untrusted as unknown as IpcMainInvokeEvent, { apiVersion: 1 })).toEqual({
      ok: false,
      code: 'FORBIDDEN',
    });
  }
  frame.url = `${url}?unexpected`;
  expect(handle(event, { apiVersion: 1 })).toEqual({ ok: false, code: 'FORBIDDEN' });
  frame.url = url;
  destroyed = true;
  expect(handle(event, { apiVersion: 1 })).toEqual({ ok: false, code: 'FORBIDDEN' });
  expect(reads).toBe(1);
  expect(
    createApplicationInfoHandler(
      () => undefined,
      url,
      () => info,
    )(event, { apiVersion: 1 }),
  ).toEqual({ ok: false, code: 'FORBIDDEN' });
  expect(
    createApplicationInfoHandler(
      () => {
        throw new Error('private path');
      },
      url,
      () => info,
    )(event, { apiVersion: 1 }),
  ).toEqual({ ok: false, code: 'UNAVAILABLE' });
});

test('preload adapter fixes request shape and sanitizes response and transport failures', async () => {
  const info = { name: 'RPG Buddy', version: '0.1.0', electron: '45', chrome: '150', node: '26' };
  expect(
    await requestApplicationInfo(async (channel, payload) => {
      expect(channel).toBe('application:get-info');
      expect(payload).toEqual({ apiVersion: 1 });
      return { ok: true, info };
    }),
  ).toEqual({ ok: true, info });
  for (const response of [
    null,
    { ok: true, info: {} },
    { ok: true, info: { ...info, path: 'secret' } },
    { ok: false, code: 'SECRET' },
    { ok: false, code: 'UNAVAILABLE', stack: 'private' },
  ]) {
    expect(isApplicationInfoResult(response)).toBe(false);
    expect(await requestApplicationInfo(async () => response)).toEqual({
      ok: false,
      code: 'UNAVAILABLE',
    });
  }
  expect(
    await requestApplicationInfo(async () => {
      throw new Error('private path');
    }),
  ).toEqual({ ok: false, code: 'UNAVAILABLE' });
});

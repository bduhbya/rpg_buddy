import { expect, test } from 'vitest';
import { validateSystemManifest } from '../../../src/domain/validate-manifest';
import { loadFixtures } from './fixtures';

const document = 'manifest-under-review';

test.each(['schemaVersion', 'id', 'version', 'label', 'source', 'templates'])(
  'rejects missing required manifest property %s',
  (key) => {
    const manifest: Record<string, unknown> = { ...loadFixtures().manifest };
    delete manifest[key];
    const result = validateSystemManifest(manifest, document);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ pointer: `/${key}`, code: 'INVALID_STRUCTURE' }),
      );
    }
  },
);

test('accepts the authored manifest without copying, coercing or mutating it', () => {
  const manifest = loadFixtures().manifest;
  const before = structuredClone(manifest);
  Object.freeze(manifest.source);
  manifest.templates.forEach(Object.freeze);
  Object.freeze(manifest.templates);
  Object.freeze(manifest);
  const result = validateSystemManifest(manifest, document);
  expect(result.success).toBe(true);
  if (result.success) expect(result.value).toBe(manifest);
  expect(manifest).toEqual(before);
});

test.each([null, false, 1, 'manifest', [], undefined])('rejects non-object roots: %s', (value) => {
  const result = validateSystemManifest(value, document);
  expect(result).toMatchObject({
    success: false,
    diagnostics: [{ document, pointer: '', code: 'INVALID_STRUCTURE' }],
  });
  expect(result).not.toHaveProperty('value');
});

test.each([
  ['id', 'Upper-case', '/id'],
  ['id', 'a'.repeat(65), '/id'],
  ['version', '01.0.0', '/version'],
  ['version', '1.0.0-beta', '/version'],
  ['label', '  \n', '/label'],
  ['source', null, '/source'],
  ['templates', [], '/templates'],
  ['templates', [null], '/templates/0'],
  ['templates', [{ id: 'valid', version: 1 }], '/templates/0/version'],
])('rejects malformed %s at %s', (key, value, pointer) => {
  const manifest = { ...loadFixtures().manifest, [key]: value };
  const before = structuredClone(manifest);
  const result = validateSystemManifest(manifest, document);
  expect(result.success).toBe(false);
  if (!result.success)
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ document, pointer }));
  expect(manifest).toEqual(before);
  expect(result).not.toHaveProperty('value');
});

test('checks required/unknown nested properties and escapes pointer segments', () => {
  const manifest: Record<string, unknown> = { ...structuredClone(loadFixtures().manifest) };
  delete manifest.label;
  manifest.source = { designation: '', isbn: false, sha256: 'a'.repeat(64), 'a~/b': true };
  manifest.templates = [{ id: 'valid', version: '1.0.0', extra: true }];
  const result = validateSystemManifest(manifest, document);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.diagnostics.map((issue) => issue.pointer)).toEqual(
      expect.arrayContaining([
        '/label',
        '/source/designation',
        '/source/isbn',
        '/source/sha256',
        '/source/a~0~1b',
        '/templates/0/extra',
      ]),
    );
    expect(
      result.diagnostics.every((issue) => issue.document === document && issue.message.length > 0),
    ).toBe(true);
  }
});

test.each([2, '1', null])('rejects unsupported schema version %s', (schemaVersion) => {
  expect(
    validateSystemManifest({ ...loadFixtures().manifest, schemaVersion }, document),
  ).toMatchObject({
    success: false,
    diagnostics: [
      expect.objectContaining({ pointer: '/schemaVersion', code: 'UNSUPPORTED_SCHEMA_VERSION' }),
    ],
  });
});

test('missing schema version is a structure error', () => {
  const manifest: Record<string, unknown> = { ...loadFixtures().manifest };
  delete manifest.schemaVersion;
  expect(validateSystemManifest(manifest, document)).toMatchObject({
    success: false,
    diagnostics: [
      expect.objectContaining({ pointer: '/schemaVersion', code: 'INVALID_STRUCTURE' }),
    ],
  });
});

test('allows distinct versions but rejects duplicate pairs with related locations', () => {
  const manifest = loadFixtures().manifest;
  const reference = manifest.templates[0];
  manifest.templates.push({ ...reference, version: '2.0.0' });
  expect(validateSystemManifest(manifest, document).success).toBe(true);
  manifest.templates.push({ ...reference });
  expect(validateSystemManifest(manifest, document)).toMatchObject({
    success: false,
    diagnostics: [
      {
        code: 'DUPLICATE_ID',
        pointer: '/templates/2',
        related: [{ document, pointer: '/templates/0' }],
      },
    ],
  });
});

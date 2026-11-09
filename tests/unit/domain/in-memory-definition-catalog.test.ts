import { expect, test } from 'vitest';
import { createInMemoryDefinitionCatalog } from '../../../src/domain/definition-processing/in-memory-definition-catalog';
import type { DefinitionReference } from '../../../src/domain/definitions/common';
import { loadFixtures } from './fixtures';

const location = { document: 'request', pointer: '/template' };

function referenceOf(value: DefinitionReference): DefinitionReference {
  return { id: value.id, version: value.version };
}

function bundle() {
  const { manifest, template } = loadFixtures();
  return {
    manifest,
    template,
    manifests: [{ document: 'manifest', value: manifest }],
    templates: [{ document: 'template', value: template }],
  };
}

test('looks up authored exact definitions and isolates inputs and returned values', () => {
  const data = bundle();
  const before = structuredClone(data);
  const result = createInMemoryDefinitionCatalog(data.manifests, data.templates);
  expect(data).toEqual(before);
  expect(result.success).toBe(true);
  if (!result.success) throw new Error('Expected source');
  data.manifest.label = 'changed';
  data.template.inputs[0].default = -100;
  const manifest = result.value.getSystem(data.template.system, location);
  const template = result.value.getTemplate(data.manifest.id, referenceOf(data.template), location);
  expect(manifest).toEqual({ success: true, value: before.manifests[0] });
  expect(template).toEqual({ success: true, value: before.templates[0] });
  if (!template.success) throw new Error('Expected template');
  template.value.value.derived[0].label = 'changed again';
  expect(result.value.getTemplate(data.manifest.id, referenceOf(data.template), location)).toEqual({
    success: true,
    value: before.templates[0],
  });
});

test('accepts identical duplicates regardless of nested object key order', () => {
  const data = bundle();
  const reverseKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(reverseKeys);
    if (value !== null && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .reverse()
          .map(([k, v]) => [k, reverseKeys(v)]),
      );
    return value;
  };
  expect(
    createInMemoryDefinitionCatalog(
      [...data.manifests, { document: 'active-copy', value: reverseKeys(data.manifest) }],
      [...data.templates, { document: 'template-copy', value: reverseKeys(data.template) }],
    ).success,
  ).toBe(true);
});

test.each(['manifest', 'template', 'array', 'metadata', 'system-version'])(
  'rejects immutable content conflict: %s',
  (change) => {
    const data = bundle();
    if (change === 'manifest')
      data.manifests.push({
        document: 'conflict',
        value: { ...data.manifest, label: 'different' },
      });
    else {
      const changed = structuredClone(data.template);
      if (change === 'template') changed.label = 'different';
      if (change === 'array') changed.sections.reverse();
      if (change === 'metadata') changed.metadata = { sourceReview: 'different' };
      if (change === 'system-version') changed.system.version = '2.0.0';
      data.templates.push({ document: 'conflict', value: changed });
    }
    const before = structuredClone(data);
    const result = createInMemoryDefinitionCatalog(data.manifests, data.templates);
    expect(result).toMatchObject({
      success: false,
      diagnostics: [
        {
          code: 'DEFINITION_CONFLICT',
          document: 'conflict',
          pointer: '',
          related: [{ document: change === 'manifest' ? 'manifest' : 'template', pointer: '' }],
        },
      ],
    });
    expect(result).not.toHaveProperty('value');
    expect(data).toEqual(before);
  },
);

test('supports distinct exact versions and system namespaces without fallback', () => {
  const data = bundle();
  const nextManifest = { ...data.manifest, version: '2.0.0' };
  const nextTemplate = { ...data.template, version: '2.0.0' };
  const otherTemplate = { ...data.template, system: { id: 'other-system', version: '1.0.0' } };
  const result = createInMemoryDefinitionCatalog(
    [...data.manifests, { document: 'next-system', value: nextManifest }],
    [
      ...data.templates,
      { document: 'next-template', value: nextTemplate },
      { document: 'other-template', value: otherTemplate },
    ],
  );
  if (!result.success) throw new Error('Expected source');
  expect(result.value.getSystem(referenceOf(nextManifest), location)).toEqual({
    success: true,
    value: { document: 'next-system', value: nextManifest },
  });
  expect(result.value.getTemplate(data.manifest.id, referenceOf(nextTemplate), location)).toEqual({
    success: true,
    value: { document: 'next-template', value: nextTemplate },
  });
  expect(result.value.getTemplate('other-system', referenceOf(data.template), location)).toEqual({
    success: true,
    value: { document: 'other-template', value: otherTemplate },
  });
  for (const lookup of [
    result.value.getSystem({ id: nextManifest.id, version: '3.0.0' }, location),
    result.value.getTemplate(data.manifest.id, { id: nextTemplate.id, version: '3.0.0' }, location),
  ])
    expect(lookup).toMatchObject({
      success: false,
      diagnostics: [{ ...location, code: 'UNSUPPORTED_DEFINITION_VERSION' }],
    });
  for (const lookup of [
    result.value.getSystem({ id: 'missing', version: '1.0.0' }, location),
    result.value.getTemplate('missing-system', referenceOf(data.template), location),
    result.value.getTemplate(data.manifest.id, { id: 'missing', version: '1.0.0' }, location),
  ]) {
    expect(lookup).toMatchObject({
      success: false,
      diagnostics: [{ ...location, code: 'DEFINITION_NOT_FOUND' }],
    });
    expect(lookup).not.toHaveProperty('value');
  }
});

test('validates every supplied document atomically with original diagnostic locations', () => {
  const data = bundle();
  const result = createInMemoryDefinitionCatalog(
    [...data.manifests, { document: 'bad-system', value: { ...data.manifest, schemaVersion: 3 } }],
    [...data.templates, { document: 'bad-template', value: { ...data.template, extra: true } }],
  );
  expect(result.success).toBe(false);
  if (result.success) throw new Error('Expected failure');
  expect(result.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        document: 'bad-system',
        pointer: '/schemaVersion',
        code: 'UNSUPPORTED_SCHEMA_VERSION',
      }),
      expect.objectContaining({
        document: 'bad-template',
        pointer: '/extra',
        code: 'INVALID_STRUCTURE',
      }),
    ]),
  );
  expect(result).not.toHaveProperty('value');
});

test('empty sources are valid; malformed lookup references do not become missing definitions', () => {
  const result = createInMemoryDefinitionCatalog([], []);
  if (!result.success) throw new Error('Expected source');
  for (const reference of [
    null,
    { id: 'Bad', version: '1.0.0' },
    { id: 'valid', version: '*' },
    { id: 'valid', version: '1.0.0', extra: true },
  ]) {
    for (const lookup of [
      result.value.getSystem(reference as DefinitionReference, location),
      result.value.getTemplate('valid-system', reference as DefinitionReference, location),
    ]) {
      expect(lookup.success).toBe(false);
      if (!lookup.success)
        expect(
          lookup.diagnostics.every(
            (d) =>
              d.code === 'INVALID_STRUCTURE' &&
              d.document === location.document &&
              d.pointer.startsWith(location.pointer),
          ),
        ).toBe(true);
      expect(lookup).not.toHaveProperty('value');
    }
  }
  expect(
    result.value.getTemplate('Bad', { id: 'valid', version: '1.0.0' }, location),
  ).toMatchObject({ success: false, diagnostics: [{ ...location, code: 'INVALID_STRUCTURE' }] });
});

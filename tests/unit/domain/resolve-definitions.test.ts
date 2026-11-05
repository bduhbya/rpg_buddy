import { expect, test } from 'vitest';
import { createInMemoryDefinitionCatalog } from '../../../src/domain/definition-processing/in-memory-definition-catalog';
import { resolveDefinitions } from '../../../src/domain/definition-processing/resolve-definitions';
import { loadFixtures } from './fixtures';

function setup() {
  const { manifest, template } = loadFixtures();
  const request = {
    system: { ...template.system },
    template: { id: template.id, version: template.version },
  };
  const catalog = () => {
    const result = createInMemoryDefinitionCatalog(
      [{ document: 'manifest', value: manifest }],
      [{ document: 'template', value: template }],
    );
    if (!result.success) throw new Error('Expected valid catalog');
    return result.value;
  };
  return { manifest, template, request, catalog };
}

test('resolves the authored pair for both instance roles without mutating requests or definitions', () => {
  const data = setup();
  const { character, monster } = loadFixtures();
  const before = structuredClone({ manifest: data.manifest, template: data.template });
  const catalog = data.catalog();
  for (const instance of [character, monster]) {
    const request = { system: instance.system, template: instance.template };
    const savedRequest = structuredClone(request);
    const result = resolveDefinitions(catalog, request, instance.id);
    expect(result).toEqual({
      success: true,
      value: {
        system: { document: 'manifest', value: before.manifest },
        template: { document: 'template', value: before.template },
      },
    });
    expect(request).toEqual(savedRequest);
    if (!result.success) throw new Error('Expected resolved pair');
    result.value.template.value.label = 'caller edit';
    result.value.system.value.templates.length = 0;
  }
  expect({ manifest: data.manifest, template: data.template }).toEqual(before);
});

test.each(['different-id', 'different-version'])(
  'rejects manifest membership mismatch: %s',
  (change) => {
    const data = setup();
    data.manifest.templates = [
      { id: change === 'different-id' ? 'another-template' : data.template.id, version: '2.0.0' },
    ];
    const result = resolveDefinitions(data.catalog(), data.request, 'request');
    expect(result).toMatchObject({
      success: false,
      diagnostics: [
        {
          code: 'IDENTITY_MISMATCH',
          document: 'request',
          pointer: '/template',
          related: [
            { document: 'manifest', pointer: '/templates' },
            { document: 'template', pointer: '' },
          ],
        },
      ],
    });
    expect(result).not.toHaveProperty('value');
  },
);

test('rejects a template pointing to another exact system version', () => {
  const data = setup();
  data.template.system.version = '2.0.0';
  expect(resolveDefinitions(data.catalog(), data.request, 'request')).toMatchObject({
    success: false,
    diagnostics: [
      {
        code: 'IDENTITY_MISMATCH',
        document: 'template',
        pointer: '/system',
        related: [
          { document: 'request', pointer: '/system' },
          { document: 'manifest', pointer: '' },
        ],
      },
    ],
  });
});

test('templates in a different system namespace cannot satisfy a request', () => {
  const data = setup();
  data.template.system.id = 'other-system';
  expect(resolveDefinitions(data.catalog(), data.request, 'request')).toMatchObject({
    success: false,
    diagnostics: [{ code: 'DEFINITION_NOT_FOUND', document: 'request', pointer: '/template' }],
  });
});

test.each([
  ['system', 'id', 'missing', 'DEFINITION_NOT_FOUND'],
  ['system', 'version', '2.0.0', 'UNSUPPORTED_DEFINITION_VERSION'],
  ['template', 'id', 'missing', 'DEFINITION_NOT_FOUND'],
  ['template', 'version', '2.0.0', 'UNSUPPORTED_DEFINITION_VERSION'],
] as const)('rejects unavailable %s %s without fallback', (kind, key, value, code) => {
  const data = setup();
  data.request[kind][key] = value;
  const before = structuredClone(data.request);
  const result = resolveDefinitions(data.catalog(), data.request, 'request');
  expect(result).toMatchObject({
    success: false,
    diagnostics: [{ code, document: 'request', pointer: `/${kind}` }],
  });
  expect(result).not.toHaveProperty('value');
  expect(data.request).toEqual(before);
});

test.each([
  null,
  {},
  { system: null, template: false },
  { system: { id: 'valid', version: '*' }, template: { id: 'valid', version: '1.0.0' } },
])('rejects malformed requests before lookup: %j', (request) => {
  const data = setup();
  const result = resolveDefinitions(data.catalog(), request, 'request');
  expect(result.success).toBe(false);
  if (!result.success)
    expect(
      result.diagnostics.every((d) => d.code === 'INVALID_STRUCTURE' && d.document === 'request'),
    ).toBe(true);
  expect(result).not.toHaveProperty('value');
});

test('does not resolve documentary metadata or unrelated manifest members', () => {
  const data = setup();
  data.manifest.templates.push({ id: 'unavailable-template', version: '9.0.0' });
  data.template.metadata = {
    sourceReview: 'unavailable-review',
    requirementRefs: ['unavailable-requirement'],
  };
  expect(resolveDefinitions(data.catalog(), data.request, 'request').success).toBe(true);
});

test('rejects unknown request properties with escaped pointers and preserves input', () => {
  const data = setup();
  const request = { ...data.request, 'extra~/property': true };
  const before = structuredClone(request);
  expect(resolveDefinitions(data.catalog(), request, 'request')).toMatchObject({
    success: false,
    diagnostics: [{ code: 'INVALID_STRUCTURE', pointer: '/extra~0~1property' }],
  });
  expect(request).toEqual(before);
});

test('accepts an archived exact system even when another system version is present', () => {
  const data = setup();
  const next = {
    ...data.manifest,
    version: '2.0.0',
    templates: [{ id: 'next-template', version: '2.0.0' }],
  };
  const catalog = createInMemoryDefinitionCatalog(
    [
      { document: 'old-manifest', value: data.manifest },
      { document: 'new-manifest', value: next },
    ],
    [{ document: 'template', value: data.template }],
  );
  if (!catalog.success) throw new Error('Expected catalog');
  const result = resolveDefinitions(catalog.value, data.request, 'request');
  expect(result.success).toBe(true);
  if (result.success) expect(result.value.system.document).toBe('old-manifest');
});

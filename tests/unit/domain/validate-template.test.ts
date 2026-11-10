import { expect, test } from 'vitest';
import { validateTemplate } from '../../../src/domain/definition-processing/validate-template';
import type { Template } from '../../../src/domain/definitions/document-models';
import { loadFixtures } from './fixtures';

const document = 'template-under-review';
function reject(value: unknown, pointer: string, code?: string) {
  const before = structuredClone(value);
  const result = validateTemplate(value, document);
  expect(result.success).toBe(false);
  expect(result).not.toHaveProperty('value');
  if (!result.success)
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ document, pointer, ...(code ? { code } : {}) }),
    );
  expect(value).toEqual(before);
}
function freezeDeep(value: unknown): void {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
}

test('accepts the complete authored template without mutation or copying', () => {
  const value = loadFixtures().template;
  freezeDeep(value);
  const result = validateTemplate(value, document);
  expect(result.success).toBe(true);
  if (result.success) expect(result.value).toBe(value);
});

test.each([null, [], 'template', 1, false, undefined])('rejects non-object root %s', (value) =>
  reject(value, ''),
);

test.each([
  'schemaVersion',
  'id',
  'version',
  'system',
  'entityType',
  'label',
  'defaultDisplayName',
  'sections',
  'inputs',
  'derived',
  'modifierTargets',
])('requires root property %s', (key) => {
  const value: Record<string, unknown> = { ...loadFixtures().template };
  delete value[key];
  reject(value, `/${key}`);
});

const malformed: [string, unknown][] = [
  ['schemaVersion', 1],
  ['schemaVersion', '1'],
  ['id', 'Invalid'],
  ['version', '1.0'],
  ['system', { id: 'valid', version: '01.0.0' }],
  ['entityType', 'has space'],
  ['label', ' '],
  ['defaultDisplayName', ''],
  ['sections', []],
  ['inputs', []],
  ['derived', []],
  ['modifierTargets', null],
  ['metadata', null],
  ['a~/b', true],
];
test.each(malformed)('rejects invalid root %s', (key, bad) => {
  const value = { ...loadFixtures().template, [key]: bad };
  reject(
    value,
    key === 'system' ? '/system/version' : `/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`,
  );
});

test.each(['inputs', 'derived'] as const)(
  'checks every required %s field property and closed shape',
  (kind) => {
    const keys =
      kind === 'inputs'
        ? ['id', 'label', 'sourceRefs', 'type', 'default', 'minimum', 'maximum']
        : ['id', 'label', 'sourceRefs', 'type', 'expression'];
    for (const key of [...keys, 'extra']) {
      const value = loadFixtures().template;
      const field = value[kind][0] as unknown as Record<string, unknown>;
      if (key === 'extra') field.extra = true;
      else delete field[key];
      reject(value, `/${kind}/0/${key}`);
    }
  },
);

test.each([
  NaN,
  Infinity,
  -Infinity,
  Number.MAX_SAFE_INTEGER + 1,
  -(Number.MAX_SAFE_INTEGER + 1),
  0.5,
  '0',
  true,
  null,
])('rejects unsafe/noninteger input constraint %s', (bad) => {
  for (const key of ['minimum', 'maximum', 'default']) {
    const value = loadFixtures().template;
    Object.assign(value.inputs[0], { [key]: bad });
    reject(value, `/inputs/0/${key}`);
  }
});

test('bounds are inclusive and must contain the default', () => {
  const value = loadFixtures().template;
  Object.assign(value.inputs[0], {
    minimum: -Number.MAX_SAFE_INTEGER,
    maximum: Number.MAX_SAFE_INTEGER,
    default: Number.MAX_SAFE_INTEGER,
  });
  expect(validateTemplate(value, document).success).toBe(true);
  Object.assign(value.inputs[0], { minimum: 10, maximum: 1, default: 2 });
  reject(value, '/inputs/0/minimum', 'INVALID_VALUE');
  Object.assign(value.inputs[0], { minimum: 0, maximum: 1, default: 2 });
  reject(value, '/inputs/0/default', 'INVALID_VALUE');
});

test('rejects duplicate field IDs across arrays, duplicate sections and invalid membership', () => {
  let value = loadFixtures().template;
  value.derived[0].id = value.inputs[0].id;
  reject(value, '/derived/0/id', 'DUPLICATE_ID');
  value = loadFixtures().template;
  value.sections[1].id = value.sections[0].id;
  reject(value, '/sections/1/id', 'DUPLICATE_ID');
  value = loadFixtures().template;
  value.sections[0].fields.push(value.sections[0].fields[0]);
  reject(value, '/sections/0/fields/9', 'INVALID_SECTION');
  value = loadFixtures().template;
  value.sections[1].fields.push(value.sections[0].fields[0]);
  reject(value, '/sections/1/fields/3', 'INVALID_SECTION');
  value = loadFixtures().template;
  value.sections[0].fields.shift();
  reject(value, '/inputs/0/id', 'INVALID_SECTION');
  value.sections[0].fields[0] = 'notDeclared';
  reject(value, '/sections/0/fields/0', 'INVALID_SECTION');
});

test.each(['weaponSkill', 'unknown', 'strengthBonus'])(
  'rejects input/unknown/repeated modifier target %s',
  (target) => {
    const value = loadFixtures().template;
    value.modifierTargets.push(target);
    reject(value, '/modifierTargets/2', 'INVALID_MODIFIER');
  },
);

test('metadata is optional/documentary, supports empty arrays and stays closed at every location', () => {
  const value = loadFixtures().template;
  delete value.metadata;
  for (const field of [...value.inputs, ...value.derived]) delete field.metadata;
  value.modifierTargets = [];
  expect(validateTemplate(value, document).success).toBe(true);
  const locations: [Record<string, unknown>, string][] = [
    [value as unknown as Record<string, unknown>, ''],
    [value.inputs[0] as unknown as Record<string, unknown>, '/inputs/0'],
    [value.derived[0] as unknown as Record<string, unknown>, '/derived/0'],
  ];
  for (const [owner, pointer] of locations) {
    for (const metadata of [
      {},
      { sourceReview: 'review', requirementRefs: [], sourceRegisterRefs: ['S1'] },
    ]) {
      owner.metadata = metadata;
      expect(validateTemplate(value, document).success).toBe(true);
    }
    for (const [metadata, suffix] of [
      [{ sourceReview: ' ' }, '/sourceReview'],
      [{ requirementRefs: [''] }, '/requirementRefs/0'],
      [{ sourceRegisterRefs: false }, '/sourceRegisterRefs'],
      [{ extra: true }, '/extra'],
    ] as const) {
      owner.metadata = metadata;
      reject(value, `${pointer}/metadata${suffix}`);
    }
    delete owner.metadata;
  }
});

const constant = { op: 'constant', value: 0.5 };
const expressions = [
  constant,
  { op: 'field', id: 'missingField' },
  { op: 'floor', value: constant },
  ...['divide', 'multiply', 'equal'].map((op) => ({ op, left: constant, right: constant })),
  {
    op: 'if',
    condition: { op: 'equal', left: constant, right: constant },
    then: constant,
    else: constant,
  },
];
test.each(expressions)('accepts expression shape $op without evaluating it', (expression) => {
  const value = loadFixtures().template;
  value.derived[0].expression = expression as Template['derived'][number]['expression'];
  expect(validateTemplate(value, document).success).toBe(true);
});

test.each([
  [null, ''],
  [{ op: 'script' }, '/op'],
  [{ op: 'constant' }, '/value'],
  [{ op: 'constant', value: true }, '/value'],
  [{ op: 'constant', value: Infinity }, '/value'],
  [{ op: 'constant', value: Number.MAX_SAFE_INTEGER + 1 }, '/value'],
  [{ op: 'field', id: 'bad-id' }, '/id'],
  [{ op: 'floor' }, '/value'],
  [{ op: 'divide', left: constant }, '/right'],
  [{ op: 'multiply', left: constant, right: constant, extra: 1 }, '/extra'],
  [{ op: 'equal', left: false, right: constant }, '/left'],
  [
    { op: 'if', condition: constant, then: constant, else: { op: 'constant', value: NaN } },
    '/else/value',
  ],
])('rejects malformed expression %s', (expression, suffix) => {
  const value = loadFixtures().template;
  Object.assign(value.derived[0], { expression });
  reject(value, `/derived/0/expression${suffix}`);
});

test('defers references, cycles, operand types and division-by-zero evaluation', () => {
  const value = loadFixtures().template;
  value.derived[0].expression = {
    op: 'divide',
    left: { op: 'field', id: value.derived[0].id },
    right: { op: 'constant', value: 0 },
  };
  value.derived[1].expression = {
    op: 'if',
    condition: { op: 'constant', value: 1 },
    then: { op: 'field', id: 'missing' },
    else: constant as { op: 'constant'; value: number },
  };
  expect(validateTemplate(value, document).success).toBe(true);
});

test('rejects malformed field labels, IDs, citations, units and section shapes', () => {
  for (const kind of ['inputs', 'derived'] as const) {
    for (const [key, bad, suffix] of [
      ['id', 'a'.repeat(65), 'id'],
      ['id', 'bad-id', 'id'],
      ['label', '', 'label'],
      ['type', kind === 'inputs' ? 'number' : 'integer', 'type'],
      ['sourceRefs', [], 'sourceRefs'],
      ['sourceRefs', [' '], 'sourceRefs/0'],
      ['sourceRefs', 'citation', 'sourceRefs'],
    ] as const) {
      const value = loadFixtures().template;
      Object.assign(value[kind][0], { [key]: bad });
      reject(value, `/${kind}/0/${suffix}`);
    }
    const value = loadFixtures().template;
    Object.assign(value, { [kind]: [null] });
    reject(value, `/${kind}/0`);
  }
  let value = loadFixtures().template;
  value.derived[0].unit = ' ';
  reject(value, '/derived/0/unit');
  for (const key of ['id', 'label', 'fields']) {
    value = loadFixtures().template;
    const section = value.sections[0] as unknown as Record<string, unknown>;
    delete section[key];
    reject(value, `/sections/0/${key}`);
  }
  for (const [bad, suffix] of [
    [null, ''],
    [{ id: 'Bad', label: 'section', fields: ['weaponSkill'] }, '/id'],
    [{ id: 'section', label: '', fields: [] }, '/label'],
    [{ id: 'section', label: 'section', fields: [] }, '/fields'],
    [{ id: 'section', label: 'section', fields: [false] }, '/fields/0'],
    [{ id: 'section', label: 'section', fields: ['weaponSkill'], extra: true }, '/extra'],
  ] as const) {
    value = loadFixtures().template;
    Object.assign(value, { sections: [bad] });
    reject(value, `/sections/0${suffix}`);
  }
});

test('preserves section duplicate and missing-field diagnostic locations', () => {
  const value = loadFixtures().template;
  value.sections[1].id = value.sections[0].id;
  value.sections[0].fields.shift();
  expect(validateTemplate(value, document)).toEqual({
    success: false,
    diagnostics: [
      {
        document,
        code: 'DUPLICATE_ID',
        pointer: '/sections/1/id',
        message: 'ID must be unique within its declaration scope.',
        related: [{ document, pointer: '/sections/0/id' }],
      },
      {
        document,
        code: 'INVALID_SECTION',
        pointer: '/inputs/0/id',
        message: 'Declared field is missing from sections.',
      },
    ],
  });
});

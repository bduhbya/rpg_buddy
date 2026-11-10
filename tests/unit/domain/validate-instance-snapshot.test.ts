import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { Instance } from '../../../src/domain/definitions/document-models';
import { validateInstanceSnapshot } from '../../../src/domain/instances/validate-instance-snapshot';

const document = 'saved-sheet.json';

// Read a fresh copy so each validation case owns its mutations.
function fixture(name = 'ork-freebooter'): Instance {
  const file = new URL(
    `../../../data_contracts/examples/v2/${name}.instance.json`,
    import.meta.url,
  );
  return JSON.parse(readFileSync(file, 'utf8')) as Instance;
}

test.each(['explorator', 'ork-freebooter'])('accepts the complete %s sheet as recorded', (name) => {
  const sheet = fixture(name);
  sheet.derived.toughnessBonus = 123.5;
  const before = structuredClone(sheet);
  const result = validateInstanceSnapshot(sheet, document);
  expect(result).toEqual({ success: true, value: before });
  if (result.success) expect(result.value).toBe(sheet);
});

test('rejects source-only v1 with recovery guidance before applying the v2 shape', () => {
  expect(validateInstanceSnapshot({ schemaVersion: 1 }, document)).toEqual({
    success: false,
    diagnostics: [
      {
        document,
        pointer: '/schemaVersion',
        code: 'UNSUPPORTED_SCHEMA_VERSION',
        message: expect.stringMatching(/lack stored final results.*Keep the original.*recreate/i),
      },
    ],
  });
});

test.each([
  [null, '', 'INVALID_STRUCTURE'],
  [{}, '/schemaVersion', 'INVALID_STRUCTURE'],
  [{ schemaVersion: 3 }, '/schemaVersion', 'UNSUPPORTED_SCHEMA_VERSION'],
])('rejects invalid document shape or version (%j)', (value, pointer, code) => {
  expect(validateInstanceSnapshot(value, document)).toMatchObject({
    success: false,
    diagnostics: expect.arrayContaining([
      expect.objectContaining({ document, pointer, code, message: expect.any(String) }),
    ]),
  });
});

interface InvalidCase {
  name: string;
  patch(sheet: Instance): void;
  pointer: string;
  code: string;
}

const invalidCases: InvalidCase[] = [
  {
    name: 'unknown root property with pointer escapes',
    patch: (sheet) => {
      Object.assign(sheet, { 'extra~/key': true });
    },
    pointer: '/extra~0~1key',
    code: 'INVALID_STRUCTURE',
  },
  {
    name: 'unsupported role',
    patch: (sheet) => {
      Object.assign(sheet, { role: 'npc' });
    },
    pointer: '/role',
    code: 'INVALID_STRUCTURE',
  },
  {
    name: 'invalid definition reference',
    patch: (sheet) => {
      sheet.template.version = 'latest';
    },
    pointer: '/template/version',
    code: 'INVALID_STRUCTURE',
  },
  {
    name: 'empty value map',
    patch: (sheet) => {
      sheet.values = {};
    },
    pointer: '/values',
    code: 'INVALID_STRUCTURE',
  },
  {
    name: 'non-integer editable value',
    patch: (sheet) => {
      sheet.values.toughness = 12.5;
    },
    pointer: '/values/toughness',
    code: 'INVALID_VALUE',
  },
  {
    name: 'nonfinite derived value',
    patch: (sheet) => {
      sheet.derived.toughnessBonus = Infinity;
    },
    pointer: '/derived/toughnessBonus',
    code: 'INVALID_VALUE',
  },
  {
    name: 'unsafe integer',
    patch: (sheet) => {
      sheet.derived.toughnessBonus = Number.MAX_SAFE_INTEGER + 1;
    },
    pointer: '/derived/toughnessBonus',
    code: 'INVALID_VALUE',
  },
  {
    name: 'field in both value maps',
    patch: (sheet) => {
      sheet.derived.toughness = 1;
    },
    pointer: '/derived/toughness',
    code: 'DUPLICATE_ID',
  },
  {
    name: 'impossible calendar date',
    patch: (sheet) => {
      sheet.createdAt = '2026-02-29T18:00:00Z';
    },
    pointer: '/createdAt',
    code: 'INVALID_VALUE',
  },
  {
    name: 'modification earlier by a sub-millisecond fraction',
    patch: (sheet) => {
      sheet.createdAt = '2026-10-28T18:00:00.123456789Z';
      sheet.modifiedAt = '2026-10-28T18:00:00.123456788Z';
    },
    pointer: '/modifiedAt',
    code: 'INVALID_VALUE',
  },
  {
    name: 'missing field label',
    patch: (sheet) => {
      delete sheet.presentation.fields.toughnessBonus;
    },
    pointer: '/presentation/fields/toughnessBonus',
    code: 'MISSING_FIELD',
  },
  {
    name: 'label for an unknown field',
    patch: (sheet) => {
      sheet.presentation.fields.unknown = { label: 'Unknown' };
    },
    pointer: '/presentation/fields/unknown',
    code: 'UNKNOWN_FIELD',
  },
  {
    name: 'unit on an editable field',
    patch: (sheet) => {
      sheet.presentation.fields.toughness.unit = 'metres';
    },
    pointer: '/presentation/fields/toughness/unit',
    code: 'INVALID_VALUE',
  },
  {
    name: 'stored field missing from the sections',
    patch: (sheet) => {
      sheet.presentation.sections[0].fields.pop();
    },
    pointer: '/presentation/sections',
    code: 'INVALID_SECTION',
  },
  {
    name: 'duplicate section membership',
    patch: (sheet) => {
      sheet.presentation.sections[1].fields.unshift('toughness');
    },
    pointer: '/presentation/sections/1/fields/0',
    code: 'INVALID_SECTION',
  },
  {
    name: 'duplicate section ID',
    patch: (sheet) => {
      sheet.presentation.sections[1].id = sheet.presentation.sections[0].id;
    },
    pointer: '/presentation/sections/1/id',
    code: 'DUPLICATE_ID',
  },
  {
    name: 'duplicate entry ID',
    patch: (sheet) => {
      sheet.entries.push({ ...sheet.entries[0], effects: [] });
    },
    pointer: '/entries/1/id',
    code: 'DUPLICATE_ID',
  },
  {
    name: 'effect on an editable field',
    patch: (sheet) => {
      sheet.entries[0].effects[0].target = 'toughness';
    },
    pointer: '/entries/0/effects/0/target',
    code: 'INVALID_MODIFIER',
  },
  {
    name: 'nonpositive factor',
    patch: (sheet) => {
      sheet.entries[0].effects[0].factor = 0;
    },
    pointer: '/entries/0/effects/0/factor',
    code: 'INVALID_MODIFIER',
  },
];

test.each(invalidCases)('rejects $name', ({ patch, pointer, code }) => {
  const sheet = fixture();
  patch(sheet);
  expect(validateInstanceSnapshot(sheet, document)).toMatchObject({
    success: false,
    diagnostics: expect.arrayContaining([
      expect.objectContaining({ document, pointer, code, message: expect.any(String) }),
    ]),
  });
});

test('reports both conflicting effect locations within the saved sheet', () => {
  const sheet = fixture();
  const effect = sheet.entries[0].effects[0];
  sheet.entries.push({ ...sheet.entries[0], id: 'second-entry', effects: [effect] });
  expect(validateInstanceSnapshot(sheet, document)).toMatchObject({
    success: false,
    diagnostics: [
      {
        document,
        pointer: '/entries/1/effects/0/target',
        code: 'MODIFIER_CONFLICT',
        related: [{ document, pointer: '/entries/0/effects/0/target' }],
      },
    ],
  });
});

test('preserves saved-sheet section duplicate and missing-field diagnostics', () => {
  const sheet = fixture();
  sheet.presentation.sections[1].id = sheet.presentation.sections[0].id;
  sheet.presentation.sections[0].fields.shift();
  expect(validateInstanceSnapshot(sheet, document)).toEqual({
    success: false,
    diagnostics: [
      {
        document,
        code: 'DUPLICATE_ID',
        pointer: '/presentation/sections/1/id',
        message: 'Section ID must be unique.',
      },
      {
        document,
        code: 'INVALID_SECTION',
        pointer: '/presentation/sections',
        message: 'Stored field "weaponSkill" is missing from the sections.',
      },
    ],
  });
});

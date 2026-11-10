import { readFileSync } from 'node:fs';
import { expect, expectTypeOf, test } from 'vitest';
import { DOCUMENT_SCHEMA_VERSION } from '../../../src/domain/definitions/schema-version';
import type { Metadata } from '../../../src/domain/definitions/common';
import type { Diagnostic, DiagnosticCode } from '../../../src/domain/definitions/diagnostics';
import type {
  Instance,
  InstanceRole,
  MultiplyEffect,
  Template,
} from '../../../src/domain/definitions/document-models';
import type { Expression } from '../../../src/domain/definitions/expressions';

test('document versions and optional documentary metadata remain explicit', () => {
  expectTypeOf<InstanceRole>().toEqualTypeOf<'character' | 'monster'>();
  expectTypeOf<Template['schemaVersion']>().toEqualTypeOf<2>();
  expectTypeOf<Instance['schemaVersion']>().toEqualTypeOf<2>();
  expectTypeOf<Instance['metadata']>().toEqualTypeOf<Metadata | undefined>();
  expectTypeOf<Expression['op']>().toEqualTypeOf<
    'constant' | 'field' | 'floor' | 'divide' | 'multiply' | 'equal' | 'if'
  >();
  expectTypeOf<MultiplyEffect['op']>().toEqualTypeOf<'multiply'>();
  expectTypeOf<Diagnostic['code']>().toEqualTypeOf<DiagnosticCode>();

  // Checked by npm run typecheck; Vitest's transpilation does not typecheck.
  // @ts-expect-error Unsupported roles are outside the instance contract.
  const unsupportedRole: InstanceRole = 'npc';
  // @ts-expect-error Binary operations require both operands.
  const missingOperand: Expression = { op: 'divide', left: { op: 'constant', value: 1 } };
  // @ts-expect-error No executable expression nodes exist.
  const executable: Expression = { op: 'script', code: 'return 1' };
  // @ts-expect-error Effects support multiplication only.
  const additive: MultiplyEffect = { op: 'add', target: 'strengthBonus', factor: 2 };
  // @ts-expect-error Diagnostic consumers use the closed normative code vocabulary.
  const unknownCode: DiagnosticCode = 'UNKNOWN_ERROR';
  void [unsupportedRole, missingOperand, executable, additive, unknownCode];
});

// The versioned schema files are wire artifacts shared with the Python verifier.
test.each(['system', 'template', 'instance'])(
  'the %s schema matches the runtime version',
  (name) => {
    const schemaFile = new URL(
      `../../../data_contracts/v${DOCUMENT_SCHEMA_VERSION}/${name}.schema.json`,
      import.meta.url,
    );
    const schema = JSON.parse(readFileSync(schemaFile, 'utf8'));
    expect(schema.properties.schemaVersion.const).toBe(DOCUMENT_SCHEMA_VERSION);
  },
);

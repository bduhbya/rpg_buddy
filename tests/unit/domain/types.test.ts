import { expectTypeOf, test } from 'vitest';
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

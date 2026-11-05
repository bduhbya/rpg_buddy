/**
 * The v1 document syntax, not a proof of operand types or valid dependencies.
 * Later validation checks every branch; evaluation will select an if branch lazily.
 */
export type Expression =
  | { op: 'constant'; value: number }
  | { op: 'field'; id: string }
  | { op: 'floor'; value: Expression }
  | { op: 'divide' | 'multiply' | 'equal'; left: Expression; right: Expression }
  | { op: 'if'; condition: Expression; then: Expression; else: Expression };

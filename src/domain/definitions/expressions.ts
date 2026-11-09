/**
 * Expression syntax. Operand types and dependencies are validated separately.
 * Later validation checks every branch; evaluation will select an if branch lazily.
 */
export type Expression =
  | { op: 'constant'; value: number }
  | { op: 'field'; id: string }
  | { op: 'floor'; value: Expression }
  | { op: 'divide' | 'multiply' | 'equal'; left: Expression; right: Expression }
  | { op: 'if'; condition: Expression; then: Expression; else: Expression };

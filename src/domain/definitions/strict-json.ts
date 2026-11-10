import { DefinitionChecks } from '../instances/structural-validation';
import type { ValidationResult } from '../instances/structural-validation';

// Capture object keys and match other strings whole so braces in values are skipped.
const JSON_DUPLICATE_KEY_SCAN_PATTERN = /("(?:[^"\\]|\\.)*")\s*:|"(?:[^"\\]|\\.)*"|[{}[\]]/g;

// Find the first repeated property name in syntactically valid JSON text.
function findDuplicateKey(json: string): string | undefined {
  // Each object has its own key set. Arrays occupy a stack frame so nested scopes stay aligned.
  const containers: (Set<string> | null)[] = [];
  for (const [token, name] of json.matchAll(JSON_DUPLICATE_KEY_SCAN_PATTERN)) {
    if (name !== undefined) {
      const keys = containers.at(-1);
      const key: string = JSON.parse(name);
      if (keys?.has(key)) return key;
      keys?.add(key);
    } else if (token === '{') containers.push(new Set());
    else if (token === '[') containers.push(null);
    else if (token === '}' || token === ']') containers.pop();
  }
  return undefined;
}

/**
 * Parse decoded JSON under the document contract's unique-property rule.
 * @param json Decoded JSON text.
 * @param document Logical document label used to locate parsing diagnostics.
 * @returns An unvalidated JSON value, or a diagnostic for invalid JSON or duplicate keys.
 */
export function parseStrictJson(json: string, document: string): ValidationResult<unknown> {
  const checks = new DefinitionChecks(document);
  try {
    const value: unknown = JSON.parse(json);
    const duplicateKey = findDuplicateKey(json);
    if (duplicateKey !== undefined) {
      checks.issue(
        '',
        `This file is malformed. The property ${JSON.stringify(duplicateKey)} appears more than once in the same JSON object. Keep only one entry for that property and try again.`,
        'INVALID_JSON',
      );
    }
    return checks.result(value);
  } catch {
    checks.issue('', 'Provide a file containing valid JSON.', 'INVALID_JSON');
    return checks.result(undefined);
  }
}

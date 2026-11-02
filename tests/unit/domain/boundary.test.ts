import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, isAbsolute } from 'node:path';
import { parseSync } from '@babel/core';
import { expect, test } from 'vitest';
import { fileURLToPath } from 'node:url';

test('domain static and dynamic dependencies stay within the domain', () => {
  const root = fileURLToPath(new URL('../../../src/domain/', import.meta.url));
  const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter((file) =>
    file.endsWith('.ts'),
  );
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const path = resolve(root, file);
    const source = parseSync(readFileSync(path, 'utf8'), {
      filename: path,
      configFile: false,
      babelrc: false,
      presets: ['@babel/preset-typescript'],
    });
    expect(source).not.toBeNull();
    function inspect(value: unknown): void {
      if (!value || typeof value !== 'object') return;
      const node = value as Record<string, unknown>;
      if (
        node.type === 'ImportDeclaration' ||
        node.type === 'ExportNamedDeclaration' ||
        node.type === 'ExportAllDeclaration'
      ) {
        const specifier = (node.source as { value?: string } | undefined)?.value;
        if (specifier !== undefined) {
          expect(specifier.startsWith('.'), `${file}: external dependency ${specifier}`).toBe(true);
          const target = relative(root, resolve(dirname(path), specifier));
          expect(
            target.startsWith('..') || isAbsolute(target),
            `${file}: import leaves domain`,
          ).toBe(false);
        }
      }
      expect(node.type, `${file}: dynamic imports are forbidden`).not.toBe('ImportExpression');
      const callee = node.callee as { type?: string; name?: string } | undefined;
      if (node.type === 'CallExpression' || node.type === 'NewExpression') {
        expect(callee?.type, `${file}: dynamic imports are forbidden`).not.toBe('Import');
        expect([
          'require',
          'eval',
          'Function',
          'fetch',
          'WebSocket',
          'XMLHttpRequest',
        ]).not.toContain(callee?.name);
      }
      for (const child of Object.values(node)) {
        if (Array.isArray(child)) child.forEach(inspect);
        else inspect(child);
      }
    }
    inspect(source);
  }
});

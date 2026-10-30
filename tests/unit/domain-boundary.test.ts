import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseSync } from '@babel/core';
import { expect, test } from 'vitest';
import { fileURLToPath } from 'node:url';

test('domain contains declarations and type-only imports confined to the domain', () => {
  const root = fileURLToPath(new URL('../../src/domain/', import.meta.url));
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
    for (const statement of source!.program.body) {
      if (statement.type === 'ImportDeclaration') {
        expect(statement.importKind, `${file}: imports must be type-only`).toBe('type');
        const specifier = statement.source.value;
        expect(specifier.startsWith('.'), `${file}: external dependency ${specifier}`).toBe(true);
        const target = resolve(dirname(path), specifier);
        expect(target.startsWith(root), `${file}: import leaves domain`).toBe(true);
      } else {
        expect(
          statement.type === 'ExportNamedDeclaration' &&
            (statement.declaration?.type === 'TSInterfaceDeclaration' ||
              statement.declaration?.type === 'TSTypeAliasDeclaration'),
          `${file}: domain foundation must contain declarations only`,
        ).toBe(true);
      }
    }
  }
});

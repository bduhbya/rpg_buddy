const { createHash } = require('node:crypto');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { DefinePlugin } = require('webpack');

// Intentionally exclude specs, tests, generated output and local user data.
function createBuildId(root, mode = 'production') {
  const files = [
    'package.json',
    'package-lock.json',
    'index.html',
    'tsconfig.json',
    'forge.config.cjs',
    'webpack.main.config.cjs',
    'webpack.renderer.config.cjs',
    'build/identity.cjs',
  ];
  function walk(relative) {
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) files.push(child);
    }
  }
  walk('src');
  const hash = createHash('sha256');
  for (const file of files.sort()) {
    const bytes = readFileSync(path.join(root, file));
    hash.update(`${file}\0${bytes.length}\0`);
    hash.update(bytes);
  }
  const result = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 2000,
    maxBuffer: 4096,
  });
  const revision =
    result.status === 0 && /^[0-9a-f]{40,64}$/.test(result.stdout.trim())
      ? result.stdout.trim().slice(0, 12)
      : 'nogit';
  return `${revision}-${hash.digest('hex').slice(0, 20)}-${mode}-${process.platform}-${process.arch}`;
}
class BuildIdentityPlugin {
  apply(compiler) {
    const identifier = createBuildId(path.resolve(__dirname, '..'), compiler.options.mode);
    new DefinePlugin({ RPG_BUDDY_BUILD_ID: JSON.stringify(identifier) }).apply(compiler);
  }
}
module.exports = { createBuildId, BuildIdentityPlugin };

# RPG Buddy

A desktop RPG companion for players and game masters. The current application is a minimal runnable shell; character sheets, rules and local libraries arrive in later phases.

## Development setup

Use Node.js **26.13.0 or newer** and npm **12.2.1 or newer**. These were the latest stable versions checked on 2026-10-29. Node's bundled npm may be older; after installing current Node, update npm with `npm install --global npm@12.2.1` if needed. Check `node --version` and `npm --version` before installing. Development and packaging have been verified on Windows x64 only.

From the repository root:

```powershell
npm ci
npm run typecheck
npm start
```

Forge builds the main process, serves the React renderer locally on `127.0.0.1:5173`, and launches Electron. Keep that port free; an occupied port fails rather than selecting another silently. Renderer edits rebuild through Webpack. Forge uses a localhost renderer URL backed by the loopback development server. Close the application window to stop development. Do not set `ELECTRON_RUN_AS_NODE` when launching the desktop application.

## Production build and launch

```powershell
npm run package
& '.\out\RPG Buddy-win32-x64\RPG Buddy.exe'
```

The output is a runnable application directory, not an installer. Keep the complete directory together. It bundles renderer assets and runs without a development server or installed Node. Build output is ignored by Git. Installer generation, signing and distribution are deferred.

## Verification

```powershell
npm run typecheck
npm run package
npm run test:smoke
```

The two Playwright Electron smoke cases launch the actual Forge development command and the packaged executable. They check startup content, title, language/landmark/heading, unavailable renderer Node globals, reload without renderer/asset errors, a narrow viewport with doubled text, and clean window-close exit. The development case uses a temporary localhost debugging port and closes its own process tree on failure. No separate Playwright browser download is needed: the tests use Electron's Chromium.

Run only one mode with `npm run test:smoke:dev` or `npm run test:smoke:package` (package first for the latter). Do not run development, packaging and smoke commands concurrently: Forge shares `.webpack/` build output. Test screenshots and diagnostic JSON are written under `test-results/`, replaced by the next run. Successful phase evidence and a human walkthrough are recorded in [Phase 3 validation](specs/2026-10-29_desktop-shell/validation.md).

## Source layout and boundaries

- `src/main/`: Electron window lifecycle and document loading.
- `src/renderer/`: React screen and styles; no filesystem or Electron imports.
- `tests/smoke/`: development and packaged launch checks.
- `data_contracts/`: existing language-neutral contracts, examples and Python verification tooling; see its [README](data_contracts/README.md).
- `specs/`: constitution, roadmap and phase specifications.

Context isolation, disabled renderer Node integration and sandboxing are explicit startup defaults. There is no preload or IPC API yet. Forge uses its supported Webpack plugin. Playwright's Electron support are experimental upstream; exact dependency versions and `package-lock.json` preserve the verified combination. Upgrade intentionally and rerun both modes.

Build configuration lives in webpack.main.config.cjs and webpack.renderer.config.cjs. Babel strips TypeScript syntax and transforms JSX; `npm run typecheck` performs strict checking separately, so packaging alone is not a type check. Vitest remains the planned domain unit-test framework in the constitution; unit-test installation and fixtures arrive with the domain phase.

Dependency audit: the supported Forge Webpack plugin currently brings four moderate development-only audit findings through webpack-dev-server -> sockjs -> uuid (GHSA-w5hq-g745-h8pq). These tools are not application runtime dependencies. The server is restricted to loopback. No force downgrade or unverified major dependency override was applied. Track upstream remediation and rerun the smoke checks when upgrading.

## Formatting

Run `npm run format` to format supported source, configuration, JSON fixtures and Markdown files, or `npm run format:check` to check without writing. Prettier is pinned locally and configured for two spaces, single quotes in JavaScript/TypeScript, semicolons, trailing commas, a 100-column print width and LF line endings. Markdown prose wrapping is preserved. Generated output, environments, caches and the npm-maintained lockfile are excluded by .prettierignore. Python files are outside Prettier's supported languages.

VS Code recommends the Prettier extension and enables format-on-save only for supported languages using this repository's config. Install the recommended extension to enable editor formatting; CLI commands work independently. Existing Python debugger/tasks remain in place.

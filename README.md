# RPG Buddy

RPG Buddy is a desktop companion for tabletop RPG players and game masters. It aims to provide editable character and monster sheets, data-defined rule calculations, and portable local libraries, starting with a supported subset of **Warhammer 40,000: Rogue Trader**.

The project is in early development. The Electron/React application launches, displays application information through an isolated process bridge, and supports local diagnostic logging. Data contracts, TypeScript domain types, example character/monster data, and a unit-test harness are in place. Character sheets, runtime rule validation and calculations, and library save/load workflows are still under development.

See the [roadmap](specs/roadmap.md) for planned work and [technology and architecture](specs/tech-stack.md) for the project's technical direction. Contract documentation and Python verification setup are in [data_contracts/README.md](data_contracts/README.md).

## Setup and development

Use **Node.js 26.13.0 or newer** and **npm 12.2.1 or newer**, as required by `package.json`. Development and packaging are currently verified on Windows x64.

From the repository root:

```powershell
node --version
npm --version
npm ci
npm run typecheck
npm start
```

If npm is older than the required version, update it with `npm install --global npm@12.2.1` before installing project dependencies.

The development command builds the application and launches Electron, serving the renderer on `127.0.0.1:5173`. Keep that port free. Renderer changes rebuild automatically; reload the window to see them. Restart development after main-process or preload changes. Close the application window to stop development. Leave `ELECTRON_RUN_AS_NODE` unset when launching the application.

## Build and run

```powershell
npm run package
& '.\out\RPG Buddy-win32-x64\RPG Buddy.exe'
```

The build produces a runnable application directory under `out/`. Keep the complete directory together. It includes the renderer assets and runs without a development server or installed Node.js. Installer generation, signing, and distribution are not yet configured.

## Important commands

| Command                      | Purpose                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `npm ci`                     | Install the exact dependencies recorded in the lockfile.                                    |
| `npm start`                  | Build and launch the development application.                                               |
| `npm run package`            | Build the runnable desktop application under `out/`.                                        |
| `npm run typecheck`          | Run strict TypeScript checking for source, tests, and test configuration.                   |
| `npm run test:unit`          | Run focused domain fixture, type-contract, and dependency-boundary tests with Vitest.       |
| `npm run test:smoke`         | Run both development and packaged Electron checks with Playwright. Build the package first. |
| `npm run test:smoke:dev`     | Run only the development Electron checks.                                                   |
| `npm run test:smoke:package` | Run only the packaged Electron checks. Build the package first.                             |
| `npm run format:check`       | Check formatting without changing files.                                                    |
| `npm run format`             | Format supported source, configuration, JSON, and Markdown files.                           |

Run `npm run typecheck` alongside unit tests and packaging: those commands transpile TypeScript without checking its types. Do not run development, packaging, and smoke tests concurrently because they share `.webpack/` output. Electron checks use its bundled Chromium; no separate Playwright browser download is needed. Test artifacts are written under `test-results/` and replaced on subsequent runs.

For independent JSON contract and fixture verification, follow the Python environment setup in [data_contracts/README.md](data_contracts/README.md), then run:

```powershell
.\.venv-contracts\Scripts\python.exe data_contracts\verify_contracts.py
```

## Pull requests and merge checks

Open a pull request into `main` for changes. GitHub Actions runs **Windows validation**: formatting, TypeScript checks, unit tests, Python contract and type checks, packaging, and development/packaged Electron tests. The workflow also runs after pushes to `main`. Failed test diagnostics are available as a workflow artifact for seven days.

The merge policy requires a passing **Windows validation** check and a branch up to date with `main`, including for administrators. Update your branch when the base changes and let validation run again. No GitHub approving-review count is required; repository access is managed by the owner. Automated agents must wait for the owner's explicit approval before merging. The protection settings live in GitHub and must be configured separately from the workflow file.

## Diagnostics

The application writes local rotating logs to `%APPDATA%\RPG Buddy\logs` on Windows. No logs are uploaded automatically. Use **Diagnostics > Enable debug tracing** for additional logging during the current launch, or set `RPG_BUDDY_LOG_LEVEL=debug` before starting the application.

The **Simulate diagnostic failure** button records a correlated diagnostic without crashing the app. For support, close all application windows, copy the log files, and include the operation ID and a description of the problem. Review logs before sharing them.

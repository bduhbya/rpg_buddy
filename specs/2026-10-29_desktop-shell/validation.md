# Phase 3: Runnable desktop shell - Validation

Defined before implementation on 2026-10-29.

| ID  | Requirements      | Method, preconditions and expected result                                                                                                                                                                                | Status | Actual result / evidence     |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------------------------- |
| V1  | DS-1              | From checkout with documented Node/npm, run npm ci and npm run typecheck. Locked installation succeeds; strict compiler reports no errors.                                                                               | Passed | See executed evidence below. |
| V2  | DS-1, DS-2        | Run npm run package. Forge creates a launchable Windows application with bundled renderer assets.                                                                                                                        | Passed | See executed evidence below. |
| V3  | DS-2, DS-3, DS-4  | Run npm run test:smoke:dev. Start Webpack development server/build via Forge; launch Electron through Playwright; verify heading, message, title, isolation and no startup/page/console/asset failures; close processes. | Passed | See executed evidence below. |
| V4  | DS-2, DS-3, DS-4  | After V2, run npm run test:smoke:package. Launch actual packaged executable; perform matching screen/error/isolation checks.                                                                                             | Passed | See executed evidence below. |
| V5  | DS-5              | Inspect semantics and styling; smoke-check narrow viewport and increased text size for clipping and readable content. Supply human keyboard/scaling walkthrough.                                                         | Passed | See executed evidence below. |
| V6  | DS-1 through DS-5 | Inspect instructions, lockfile, scope, unchanged contract artifacts, phase folder containing exactly three Markdown documents, and git diff --check.                                                                     | Passed | See executed evidence below. |

## Human walkthrough

Preconditions: Windows checkout and documented Node/npm; run npm ci.

1. Run npm start. Confirm RPG Buddy opens with a readable heading and startup message, and no error dialog. Close the window and confirm the command exits.
2. Run npm run package, then launch out/RPG Buddy-win32-x64/RPG Buddy.exe. Confirm the same screen without a development server. Close and relaunch it.
3. Resize to the minimum window size and inspect text at 200% zoom (View menu or keyboard zoom controls). Confirm content stays readable, scrolls if needed and is not clipped horizontally.
4. Use keyboard navigation: no unavailable actions or focus traps. Inspect the document's main landmark and heading through accessibility tooling if available.

User walkthrough: Not run; not a completion gate. No application functionality beyond the shell is claimed.

## Initial Vite evidence - 2026-10-29 (historical; superseded below)

Environment: Windows x64; isolated verification Node 26.13.0 and npm 12.2.1. The user's global Node 24.19.0/npm 10.4.0 were not replaced. README documents the required upgrade for normal terminal commands. Exact dependencies are in package.json and package-lock.json; the lockfile contains registry URLs and integrity hashes.

- **V1 Passed:** `npm ci` installed 156 packages from the lockfile; audit reported 0 vulnerabilities. `npm run typecheck` completed successfully with strict TypeScript 7.0.2, including source, Vite config and smoke tests.
- **V2 Passed:** `npm run package` completed Forge's system, production Vite bundle, copy, native-dependency and finalization stages. Created `out/RPG Buddy-win32-x64/RPG Buddy.exe` and supporting packaged assets with ASAR enabled.
- **V3 Passed:** `npm run test:smoke` development project passed in 7.0 seconds after the clean install. The real Forge start command launched Electron at the expected local Vite URL. Content/title/semantics and absent renderer Node globals passed before/after reload; renderer and asset error arrays were empty. Closing the window ended Forge with exit code 0. Port 5173 had no remaining listener afterward.
- **V4 Passed:** the same command's packaged project passed in 644 ms. Playwright launched the actual packaged executable, confirmed `app.isPackaged === true` and a file URL, verified screen content and unavailable renderer Node globals, then closed its window and observed exit code 0. No development server is needed. Renderer and asset error arrays were empty. Overall runner result: `2 passed (8.3s)`.
- **V5 Passed:** both projects checked English language, document title, main landmark and heading. At a 360 by 320 viewport with root text size doubled, there was no horizontal overflow and the startup message scrolled into view. The full-page screenshot was visually inspected: readable dark text on a light background, with wrapped content and no clipping. Main source inspection confirms explicit context isolation, disabled Node integration and sandboxing. No controls or focus traps are introduced. User keyboard/screen-reader/OS scaling inspection remains unperformed, as distinct from automated DOM/text-scale checks. CSS foreground/background inspection gives approximately 12.6:1 text contrast and 6.9:1 secondary text contrast (WCAG relative-luminance calculation).
- **V6 Passed:** reviewed README setup/build/test instructions, current pinned dependency list, lockfile, source boundaries, clean baseline and exact three-document phase folder. Contract artifacts and VS Code configuration are unchanged. `git diff --check` passed. Phase 3 is marked complete in the roadmap.

Generated per-mode screenshots and diagnostic JSON are under ignored `test-results/`; the next test run replaces them. The durable evidence is this result record and reproducible tests, not a committed screenshot. No package distribution, macOS/Linux launch, IPC validation, character sheet functionality, persistence or user-executed walkthrough is claimed.

Nonblocking output: the host supplies both NO_COLOR and FORCE_COLOR, so Node prints a color-environment warning. The packaged automation prints a debugger-disconnect message during shutdown. Neither produced renderer/asset errors or a nonzero exit. Forge Vite and Playwright Electron support are experimental upstream; exact versions and both smoke modes bound this phase's evidence.

Sources used for toolchain decisions: [official Node release index](https://nodejs.org/dist/index.json), [Forge Vite configuration](https://www.electronforge.io/config/plugins/vite), [Playwright Electron API](https://playwright.dev/docs/api/class-electron), plus npm registry latest/version metadata. Future latest releases may differ; upgrading requires rerunning the checks.

## Webpack revision checks - defined before implementation

The earlier Vite execution results are historical and do not validate this revision. Rerun V1 (clean npm ci and typecheck), V2 (Webpack production package), V3/V4 (both smoke modes with Webpack development URL), V5 (existing semantics/narrow/doubled-text assertions and screenshot inspection) and V6 (documentation, three-file phase folder, retired Vite runtime references and whitespace). Preserve unavailable human/other-platform checks as unperformed. Status: Not run.

## Webpack revision results - 2026-10-29

Current status: Passed for V1 through V6. This record supersedes the earlier Vite-specific completion evidence.

- V1: clean npm ci installed 534 packages from the lockfile. Strict TypeScript 7.0.2 checking passed, using Node 26.13.0/npm 12.2.1.
- V2: npm run package completed Forge Webpack compilation and Windows x64 packaging. Executable: out/RPG Buddy-win32-x64/RPG Buddy.exe. Main entry is .webpack/main/index.cjs, matching Forge 8 output. Webpack injects renderer HTML scripts.
- V3/V4: npm run test:smoke reports `2 passed (6.9s)` after clean install. Development passed in 5.4 seconds; packaged passed in 885 ms. Both checked content/title/semantics, reload, absent renderer Node globals, no renderer or asset errors, narrow viewport with doubled text and clean window-close exits. Packaged loading uses a file URL with app.isPackaged true; development uses the Webpack localhost URL.
- V5: visually inspected the new packaged screenshot at 360px with doubled text: readable wrapping without horizontal clipping. Contrast, markup and isolation/sandbox settings are unchanged. Human keyboard/screen-reader/OS zoom checks remain unperformed.
- V6: README describes Webpack and .webpack output. Removed Vite plugin, React plugin, direct dependency, configuration files, runtime constants and client typings. Vitest remains the constitutional unit-test choice, to be installed with the domain harness; no new unit tests are claimed. Phase folder retains exactly three documents. Existing contracts and VS Code configuration are unchanged. Whitespace checks passed.

Pinned new dependencies: Forge Webpack plugin 8.0.1, webpack 5.112.2, babel-loader 10.1.1, Babel core 8.0.9, Babel TypeScript preset 8.0.7, Babel React preset 8.0.1, css-loader 7.1.5 and style-loader 4.0.0. Other direct versions are unchanged. Reference: https://www.electronforge.io/config/plugins/webpack.

Resolved findings: ts-loader cannot use TypeScript 7's compiler API, so Babel handles transpilation and tsc remains the separate strict checker. Explicit development:false in Babel's React preset fixes a packaged jsxDEV/runtime mismatch caught by smoke testing. Forge 8 requires explicit index.cjs rather than the documented directory shorthand. No validation assertions were removed. Source maps avoid requiring unsafe-eval in the script CSP.

Audit limitation: four moderate development-only findings remain through plugin-webpack -> webpack-dev-server 5.2.7 -> sockjs -> uuid 8.3.2, based on GHSA-w5hq-g745-h8pq (uuid v3/v5/v6 buffer handling). npm's force fix downgrades the Forge plugin to 0.0.2 and was not applied. No unverified major dependency override was introduced. The server binds to loopback. These tools are not production runtime dependencies. Upstream remediation or a separately validated dependency update is needed. Earlier Vite zero-vulnerability audit results do not apply.

## Global toolchain verification - 2026-10-29

User authorized upgrading the global Node installation and verifying the repository. Windows Package Manager upgraded OpenJS.NodeJS.LTS from 24.19.0 to 26.13.0; installer hash verification and installation succeeded. Fresh command invocation reports node v26.13.0 from C:\Program Files\nodejs\node.exe and npm 12.2.1. No temporary toolchain PATH override was used for this run.

Passed with normal repository commands: npm ci (534 packages installed), npm run typecheck, npm run package, and npm run test:smoke (`2 passed (7.0s)`: development 5.4 seconds, packaged 908 ms). The previously documented four moderate development-dependency audit findings remain. Global installation now satisfies the repository engine requirements. No application code or dependency versions changed in this verification.

## Prettier checks - defined before configuration

Verify DS-6 through npm run format, npm run format:check, a negative drift check on stdin, strict type checking, production packaging, both launch smoke modes and existing Python contract verification. Inspect ignored generated artifacts, VS Code language settings and whitespace. Status: Not run.

## Prettier results - 2026-10-29

DS-6 Passed. Installed exact Prettier 3.9.10; added .prettierrc.json, .prettierignore, npm format/format:check scripts and VS Code language-scoped formatter settings plus extension recommendation. README documents commands, style and exclusions. Existing supported source/configuration/Markdown/fixture files were formatted. Python source is not formatted by Prettier.

Passed: npm run format, npm run format:check and npm run typecheck. An intentionally unformatted TypeScript stdin sample returned check exit code 1. Prettier's file-info API confirmed ignored build, old build, test output, Python environment and lockfile paths. Compared all seven modified preexisting JSON documents against HEAD after parsing: values are identical, including existing VS Code task/launch settings and contract schemas/examples. Those files have formatting changes only.

Passed: existing Python contract verifier ran all 22 tests successfully. Production packaging passed. Both Playwright launch smoke cases passed (`2 passed (3.8s)`, development 2.3 seconds and packaged 887 ms). git diff --check passed. The existing four moderate development-dependency findings are unchanged. No formatter UI save interaction was performed; editor configuration was inspected and CLI behavior verified.

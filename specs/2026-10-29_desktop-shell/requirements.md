# Phase 3: Runnable desktop shell - Requirements

## 1. Context

Roadmap Phase 3 introduces the first runnable desktop application. Authoritative decisions are in ../mission.md, ../tech-stack.md and ../roadmap.md. Earlier phase contracts remain unchanged. The user accepted scope and validation on 2026-10-29 and requested current toolchains.

## 2. Scope

Include Electron main-process lifecycle, React renderer, TypeScript, Forge/Webpack development launch and packaged Windows output, developer instructions and smoke verification. Exclude IPC features, rules, domain implementation, character sheets, persistence, installers and signing.

## 3. Product decisions

The window and document title are RPG Buddy. Display a heading and a clear startup message describing the companion. No controls for unavailable features. Use the latest stable direct toolchain releases available at implementation, with exact versions and lockfile. Do not globally replace installed Node/npm. No open product questions.

## 4. Technical requirements

- DS-1: npm scripts support development launch, strict TypeScript checks and a production package. Pin direct dependencies and provide a reproducible lockfile plus Node/npm requirements.
- DS-2: Development and packaged launch render the same React screen without startup failures, renderer exceptions, failed local assets or console errors. Closing all windows exits on Windows/Linux; macOS activation recreates the window.
- DS-3: Explicitly enable context isolation and disable renderer Node integration. No renderer filesystem access, preload bridge or IPC features in this phase. Keep main and renderer source separate.
- DS-4: Automated Playwright smoke checks exercise development and the actual packaged executable, inspect content/title and baseline isolation, capture failures, and close test-owned processes. Do not add game-rule tests or duplicate the Python verifier.

## 5. Accessibility requirements

- DS-5: Declare English language, document title, one main landmark and one descriptive level-one heading. Use readable contrast, responsive text and layout without clipping at a narrow window or 200% text scale. No color-only status or unnecessary focusable controls. Human walkthrough includes keyboard and scaling inspection.

## 6. Completion requirements

DS-1 through DS-5 are met when strict checks and production packaging pass, both automated launch modes pass, and maintained instructions explain setup, launch, verification and limitations. Record actual evidence separately from planned checks. The user-executed walkthrough is supplied for review and is not a completion gate. Mark roadmap Phase 3 complete only after required automated validation passes.

## Authorized build-tool revision - 2026-10-29

The user replaces the original Vite choice with Electron Forge's supported Webpack plugin. DS-1 now requires Forge/Webpack configuration and locked current stable dependencies; Vite integration, configuration, entry constants and client typings must be removed. Vitest remains the constitution's unit-test framework; this shell adds no domain unit-test suite. Preserve DS-2 through DS-5 and the same application behavior. Earlier Vite-specific tooling decisions are superseded.

## Formatting tooling addition - 2026-10-29

DS-6: npm run format writes consistent Prettier formatting and npm run format:check detects drift without writing. Use exact current stable Prettier with a repository config; ignore generated builds, dependencies, Python environments/caches and test output. VS Code defaults apply only to supported languages and require a config. Formatting must preserve contract fixture values and application behavior.

# Required CI checks - Requirements

## 1. Context

The project has local validation commands but no GitHub workflow or protection for main. The constitution in `../mission.md`, `../tech-stack.md` and `../roadmap.md` governs this supporting infrastructure phase; Phase 7 domain validation remains next in the product roadmap. The user approved the plan, full-suite validation, and committing/pushing a topic branch and opening a PR on 2026-10-30.

## 2. Scope

- CI-1: Run the existing formatting, TypeScript, Vitest, Python contract/static checks, production packaging and both Electron smoke projects in GitHub Actions on Windows.
- CI-2: Require passing checks and an up-to-date pull request before merging into main, including administrators.
- CI-3: Document commands and remote enforcement; provide local and actual remote evidence.

Exclude application behavior changes, contributor-access management, dependency upgrades, deployment and merging the verification PR.

## 3. Product decisions

After clarification that authors cannot approve their own GitHub PRs, the user accepted the original suggestion: no mandatory approving-review count. The user will control contributor access. The assistant must still wait for explicit user approval before merging this PR. Run on PRs targeting main and pushes to main, without path-based skips; retain manual dispatch. Do not enable auto-merge.

## 4. Technical requirements

Use one consistently named required job, `Windows validation`, on Windows x64. Use the Node version in `.node-version`, the npm version declared by package.json and Python 3.12. Install locked Node dependencies with npm ci and pinned Python verification/typecheck requirements. Package before running smoke tests; run commands sequentially because Forge shares build output. Nonzero commands fail the job; no continue-on-error. Upload smoke diagnostics on failure without making upload success a substitute for validation. Pin actions to reviewed commit identities, grant read-only repository contents permission, and run PR code with pull_request rather than pull_request_target.

Configure main protection only after the real check is registered. Require strict up-to-date checks from GitHub Actions and pull requests, enforce administrators, and disallow force pushes and branch deletion. Inspect existing settings first and preserve unrelated rules. Verify enforcement through the GitHub API; do not attempt a destructive push merely to demonstrate rejection.

Keep text checkout line endings consistent with the existing Prettier LF policy, including on Windows hosted runners, through repository attributes.

## 5. Accessibility requirements

No application interface changes. Use descriptive workflow/step names and plain-language contributor instructions so failures can be located without relying on color.

## 6. Completion requirements

- CI-1: Full local validation passes and the actual PR Windows validation check succeeds.
- CI-2: Read-back of main protection confirms required PRs, strict check matching the registered GitHub Actions source, administrator enforcement and disabled force pushes/deletion.
- CI-3: Workflow and contributor guidance are checked for formatting, trigger coverage, sequencing and failure behavior; phase evidence identifies the PR and run. Leave the PR open for user review.

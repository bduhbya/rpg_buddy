# Required CI checks - Plan

Topic branch: `phase/2026-10-30-required-ci-checks`, verified before documentation. Base: main at `bf3d9bf85d6715a28f6e90ee470a41ec1e9b1607`. Initial working tree clean. GitHub repository public; account has admin permission; main has no protection or rulesets.

## One reviewable step: CI and main protection

The change is one small workflow plus contributor guidance and repository settings. No application code changes are planned, so a single implementation step is appropriate. User approved this cadence and publishing a verification PR; merging still requires user approval.

- [x] P1 (CI-1): Add the Windows validation workflow covering the existing checks and build; complete when workflow inspection and full local validation pass.
- [x] P2 (CI-3): Add concise contributor instructions and record verification; complete when formatting and whitespace checks pass.
- [x] P3 (CI-1, CI-2): Commit, push and open the PR, observe its actual check, then configure and read back main protection. Complete when remote validation and protection satisfy requirements.

Dependencies: P3 follows local verification and registration of the GitHub Actions check. If hosted execution reveals a portability problem, fix only the demonstrated blocker and rerun affected checks. Do not change the next product phase or automatically merge the PR.

Local and hosted verification passed; main protection is active and verified. Phase complete. PR #1 remains open for explicit user merge approval. See validation.md for run/configuration evidence.

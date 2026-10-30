# Required CI checks - Validation

Defined before implementation on 2026-10-30.

| ID  | Requirement | Method and expected result                                                                                                                                              | Status  | Evidence                  |
| --- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------- |
| V1  | CI-1        | Run npm run format:check, npm run typecheck, npm run test:unit, Python contract verifier and strict mypy; all succeed.                                                  | Passed  | See local evidence below. |
| V2  | CI-1        | Run npm run package then npm run test:smoke sequentially; build and both projects succeed, with only existing explicit development skips.                               | Passed  | See local evidence below. |
| V3  | CI-1, CI-3  | Inspect YAML triggers, read-only permissions, pinned actions, tool versions, command exit handling and diagnostic retention. Run formatting and git diff --check.       | Passed  | See local evidence below. |
| V4  | CI-1        | Observe the actual PR Windows validation job and its steps; conclusion success on the current PR head.                                                                  | Not run | Pending remote run.       |
| V5  | CI-2        | Read main protection through GitHub API; strict Actions-sourced check, PR required with zero review count, administrators enforced, force pushes and deletion disabled. | Not run | Pending registered check. |

## Human verification

Open the PR Checks tab and inspect Windows validation. Confirm branch protection in repository Settings > Branches, including required status checks and up-to-date requirement. Review the PR before authorizing merge. API read-back supplies configuration evidence without bypassing protection or attempting a destructive test. Human execution: Not run.

## Local execution evidence - 2026-10-30

- V1 Passed: formatting, strict TypeScript, six Vitest tests, all 22 Python contract verifier groups and strict mypy over 12 files succeeded.
- V2 Passed: npm run package succeeded, followed by npm run test:smoke: 43 passed, seven explicit existing development skips. Commands ran sequentially; application runtime/test code is unchanged.
- V3 Passed: actionlint 1.7.12 accepted the workflow without diagnostics. Inspected PR-to-main, push-to-main and manual triggers, lack of path skips, read-only contents permissions, action commit pins, tool versions and sequential build/test commands. Native command failures propagate through GitHub's PowerShell shell; no continue-on-error or success-forcing commands. Diagnostic upload runs on failure, cannot erase an earlier failing result, and retains artifacts for seven days. Prettier and git diff --check passed.

Action commit pins were resolved from official actions repositories' release metadata. Local environment: Windows x64, Node 26.13.0, npm 12.2.1 and Python 3.12. Local dependency environments already existed; hosted verification will test fresh installation.

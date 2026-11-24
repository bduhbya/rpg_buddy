# Phase 22 validation

## V1 Source and component (RT-1, RT-2, RT-4)

- Inspect the Core Rulebook PDF pages 401–402 and compare supported identity, characteristics and paired bonuses, entries, and ordered movement with the component.
- Run `npm run test:unit -- rogue-trader-sheet` and `npm run typecheck`. Expect both role fixtures to render ordered characteristics and recorded results, including units, optional career, and entries. A modified stored result must render as supplied.
- Status: Passed. Compared PDF pages 401–402 with the component. Identity comes first, the nine characteristics follow in order with the three supported bonuses paired, entries are grouped, and the four supported movement values appear in order. All three focused tests and typecheck passed. Responsive layout and focus transitions remain part of the integrated desktop check.

## V2 Integrated desktop and layout (RT-1 through RT-5)

- Run the packaged Electron smoke tests in an isolated profile with both Rogue Trader roles. Create and open each role, verify the View sheet and Back keyboard flow and focus, and confirm the main-page state is restored. Remove the exact system definition and reopen the saved sheets. Expect the same layout and values with an explanation and unchanged files. Verify representative navigation records and confirm existing handled failures still have their diagnostics.
- Inspect screenshots at regular and narrow viewport widths. Expect readable labels and values, no horizontal overflow, and distinct characteristics, entries, and movement.
- Status: Passed. Packaged Electron created both roles and opened both roles with and without the exact definitions. The walkthrough verified keyboard focus on View sheet, the sheet heading and Back, then focus restoration and retained form or picker values. Read-only mode showed the dependency explanation and recorded statistics. The files were byte-for-byte unchanged. The log contained four correlated enter and return pairs with no sheet IDs or display names, and handled open failures retained their diagnostics. Reviewed both screenshots and verified no horizontal overflow at 360 CSS pixels.

## V3 Repository checks (RT-5)

- Run `npm run format:check`, `npm run typecheck`, `npm run test:unit`, `npm run test:smoke`, and `git diff --check`. Expect all to pass.
- Status: Passed. Windows packaging, formatting, typecheck and diff whitespace checks passed. Vitest passed 496 tests. Playwright passed 56 tests, with 16 packaged-only tests skipped in the development project.

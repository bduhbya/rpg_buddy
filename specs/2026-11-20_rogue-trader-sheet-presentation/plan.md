# Phase 22 Rogue Trader sheet presentation

- Branch `phase/2026-11-20-rogue-trader-sheet-presentation`
- Starting base `05521473e7a5e9b2c9a7ae18d2c13daa1ac436a1` on `main`
- The user approved a review after the shared layout and added full-window navigation.

## Step 1 Shared sheet layout

- [x] Build the [Rogue Trader component](../../src/renderer/rogue-trader-sheet.tsx) and responsive styling with fixture-based checks (RT-1, RT-2, RT-4).
- Step 1 was handed off for review. See the [source mapping and test results](validation.md#v1-source-and-component-rt-1-rt-2-rt-4). The user directed us to continue to Step 2.

## Step 2 Full-window navigation and verification

- [x] Replace both workflow previews with View sheet buttons and connect them to a single full-window view. Verify Back restores the invoking control and main-page state (RT-3, RT-4).
- [x] Verify the integrated flows and responsive layout, record evidence, and update the roadmap when acceptance passes (RT-5).

The [app shell](../../src/renderer/main.tsx) keeps the main page mounted while the full-window sheet is displayed, then restores focus to the invoking button. The [logging bridge](../../src/main/logging-ipc.ts) accepts the two navigation outcomes. Phase 22 is complete. See the [validation record](validation.md).

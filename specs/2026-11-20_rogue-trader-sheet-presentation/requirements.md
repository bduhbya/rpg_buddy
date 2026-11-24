# Phase 22 requirements

## Context

The [roadmap](../roadmap.md) follows the Phase 20 creation and Phase 21 opening workflows. Use the 2009 Rogue Trader Core Rulebook (RT01, Print ID 01), PDF pages 401–402, as the visual reference for supported fields. The [source review](../2026-10-28_source-review-scope/source-review.md) identifies the supported game data.

## Scope

Provide a shared Rogue Trader sheet for new, reopened, and read-only characters and monsters. Editing, saving, a configurable presentation format, and unsupported rulebook fields belong to later work.

## Product decisions

- **RT-1.** Present identity and optional career first, then characteristics in rulebook order with stored bonuses beside their corresponding scores. Use Skills and Talents & Traits groups for relevant entries and a Movement row ordered Half Move, Full Move, Charge, Run. Show other entries and validated fields where present. Use RPG Buddy styling and omit unsupported rulebook sections.
- **RT-3.** After successful creation or opening, show a View sheet button in place of the preview. Open the sheet as a full-window view in the existing RPG Buddy window. Back returns to the main page with the workflow state intact. Show the existing read-only explanation with the sheet when exact definitions are unavailable.

## Technical requirements

- **RT-2.** Render the existing validated snapshot, including its field labels and units, source values, stored final statistics, and instance-owned entry content. The Rogue Trader component owns the layout. Rendering uses no definitions, calculations, or persistence. The renderer navigation boundary uses the shared logger for the `sheet.view` event. Record `view.enter` and `view.return` at info with outcome `succeeded` and one operation ID per visit. Keep sheet data out of both records.

## Accessibility requirements

- **RT-4.** Use meaningful headings and label/value semantics. Reflow at narrow widths without horizontal scrolling. Support keyboard activation and visible focus. On entry focus the sheet heading, and on Back restore focus to the View sheet button.

## Completion requirements

- **RT-5.** Pass the [validation activities](validation.md) for both roles across creation, normal opening, and read-only opening. Verify Back, state preservation, stored values and workflow logging.

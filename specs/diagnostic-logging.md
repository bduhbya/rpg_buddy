# Diagnostic logging conventions

Use the shared logger to help diagnose workflow outcomes. The contract defines record fields, validation, storage, and privacy. [Logging contract](tech-stack.md#diagnostic-logging)

## What to record

- Record one terminal outcome at the boundary that owns the result. Add checkpoints when they help explain progress or isolate a failure. Reuse the operation ID across those checkpoints and pass it to nested work that records its own progress.
- Choose one stable event name for the workflow. Name the action that ran in `step` and describe what happened in `outcome`. Define those labels at the call site. Use an existing diagnostic code as the reason when it describes the failure.
- Use info for meaningful progress and success, warn for expected rejection or degraded results, error for unexpected failures, and debug for detail. Use fatal for failures that terminate the process.
- Keep user data out of records, including paths, identifiers, document labels, pointers, and diagnostic messages. Sanitize exceptions through the shared helper when stack evidence is useful.
- Use best-effort recording. A sink failure must preserve the workflow's result, state changes, exception behavior, and cleanup. Call the area wrapper directly where it can record a failure and return the existing result.

The development console prints the event, step, and outcome directly. JSON Lines stores them as separate fields.

## Where to record

- **Domain.** Use the injected logger and operation ID when the caller supplies them. Record the result at a domain workflow boundary that owns it. Leave reporting to the caller when validation, calculation, or catalog code runs as a helper. Keep dependencies limited to the shared logger type. [Domain wrapper](../src/domain/workflow-log.ts)
- **Main process.** Reuse the application's logger. Establish the operation ID at the owning boundary and pass it to nested checkpoints. Record filesystem, application lifecycle, and service outcomes at their owning boundaries. Keep low-level helpers quiet. [Main wrapper](../src/main/workflow-log.ts)
- **Renderer.** Use the validated logging bridge. Generate an operation ID for renderer-owned work or reuse the caller's ID when supplied. Record failures owned by the renderer, such as an exception before receiving an IPC reply. Opt in to a sanitized transport exception when the workflow needs to distinguish it from a valid main-process failure reply. Display main-owned results through the existing UI feedback. Preserve the renderer fallback if logging fails. [Renderer logging](../src/renderer/renderer-logger.ts)
- **Preload and IPC.** Keep preload focused on transport. Main owns sender and frame checks, event authorization, and rate limits. Record bounded boundary rejections and let the service report accepted operations. Return the diagnostic transport's unavailable result directly if delivery fails. [Diagnostic IPC](../src/main/logging-ipc.ts)
- **Shared.** Define record types, runtime validation, and sanitization here. Keep shared types and transport helpers free of recording side effects. [Shared logging contract](../src/shared/logging-contract.ts)

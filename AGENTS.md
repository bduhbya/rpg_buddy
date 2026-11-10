# Repository instructions

## Diagnostic logging

- When adding or changing an application workflow, use the existing shared logger at the operation boundary. Reuse the logger already supplied to that process or service. Keep pure validators, calculations and small helpers quiet when their caller can record the outcome.
- Use direct `logger.record` calls or an existing helper. Record meaningful checkpoints and useful successful workflow outcomes at `info`, expected failures or degraded outcomes at `warn`, and unexpected failures at `error`. Reserve `debug` for detailed diagnostic traces. Log an outcome once at the boundary that owns it.
- Name events with stable, workflow-specific dotted names such as `instance.load.started` and `instance.load.failed`. Use a stable diagnostic or reason code for failures and reuse the operation ID across checkpoints when available. Keep paths, IDs from user data, and document contents out of records. Logging is best effort and must preserve the operation's result.
- For a new phase, specify the workflow events and verify representative success and failure records. Follow the [logging contract](specs/tech-stack.md#diagnostic-logging) and the [definition loader example](src/main/definition-loader.ts).

## Code comments

Refer to the current supported schema version generically in comments and JSDoc. Use explicit version numbers when describing behavior specific to a fixed historical version.

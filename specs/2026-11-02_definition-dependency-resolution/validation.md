# Phase 8: Definition dependency resolution - Validation

Defined before implementation on 2026-11-02. Run step-relevant checks at each checkpoint.

| ID  | Requirements     | Method, preconditions, expected result                                                                                                                                                                                              | Status | Evidence |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- |
| V1  | DR-1, DR-2, DR-4 | `npm run test:unit`: fixture lookups, distinct namespaces/versions, identical reordered objects, meaningful content conflicts, malformed documents/requests, missing IDs/versions, atomic failure and source/result isolation pass. | Passed |          |
| V2  | DR-3             | Unit tests: resolve authored pair; reject membership/system mismatch and missing dependencies at precise logical locations, without partial results or fallback.                                                                    | Passed | Step 2   |
| V3  | DR-4             | `npm run typecheck` and unit domain boundary test: strict compilation and domain-only dependencies pass.                                                                                                                            | Passed |          |
| V4  | DR-4             | `.venv-contracts/Scripts/python.exe data_contracts/verify_contracts.py`: existing contract fixtures and 22 verifier tests remain valid.                                                                                             | Passed |          |
| V5  | DR-4             | `npm run format:check`, `git diff --check`; inspect contract parity and exactly three phase Markdown files. All checks pass.                                                                                                        | Passed |          |

## Supplementary human walkthrough

Run unit tests from the repository root. Inspect source construction and trace an exact fixture lookup. Compare a missing ID with a known ID at an unavailable version. Inspect conflict diagnostics for both source locations; confirm object key reordering is permitted while array/content changes conflict. Mutate input and returned copies and verify subsequent lookups remain unchanged. After step 2, trace manifest membership and template.system checks and rejection locations.

Status: Not run. Supplementary, not a completion gate. UI accessibility, packaging and Electron smoke checks do not apply because application wiring is unchanged. No persistence/recovery checks apply; source isolation is covered by unit tests.

## Step 1 evidence - 2026-11-02

- V1 Passed: `npm run test:unit` reports 6 files and 113 tests passed, including 10 new source tests. Cases cover authored exact lookups, input/result isolation, reordered nested object keys, conflicting manifest/template labels, array order, metadata and template system-version contents, distinct versions and system namespaces, unavailable versions versus missing IDs, atomic malformed-bundle failure and malformed lookup references. Failure results expose no value. The first run caught two test calls supplying whole documents instead of closed references; corrected tests supply explicit id/version pairs and the final suite passes.
- V2 Not run: cross-document resolution is step 2 and remains unimplemented. Successful source lookups do not prove manifest membership, template.system agreement or calculation readiness.
- V3 Passed: `npm run typecheck` exited 0; domain AST dependency guard passed in the unit suite. Inspection confirms domain-only imports and synchronous in-memory operations with no concrete logger or infrastructure access.
- V4 Passed: existing Python contract verifier reported 22 tests, OK. No schema, fixture or Python code changed.
- V5 Passed: `npm run format:check` and `git diff --check` exited 0; folder inspection lists only plan.md, requirements.md and validation.md. Inspected exact-reference, immutable-content and namespace behavior against the normative v1 contract. No new packages or application wiring changes.

Code flow: createInMemoryDefinitionCatalog validates all entries with the Phase 7 validators, snapshots valid data and registers immutable pairs in private maps. register compares all JSON content recursively while ignoring object property order. The public getSystem/getTemplate methods validate closed references before lookup; lookup returns a fresh located copy or a diagnostic at the requesting reference. Nothing is exposed when construction fails. Source containers and logical labels are typed caller API inputs; document values and lookup reference formats undergo runtime validation. Parsed JSON assumptions remain as specified.

README documents the source API, copy ownership, namespaces and deferred cross-document checks. Human walkthrough remains Not run and supplementary. Phase remains incomplete; stop here for the agreed human checkpoint before step 2.

## Step 2 and phase completion evidence - 2026-11-02

The user requested InMemoryDefinitionCatalog naming and explicitly authorized step 2 after the first checkpoint. Renamed the interface, constructor, source module and mirrored test; README and phase references use the new API. No old API names remain in source or tests. Earlier step evidence above describes the historical checkpoint.

- V1/V2 Passed: `npm run test:unit` reports 7 files and 129 tests passed, including the 10 catalog cases and 16 resolver cases. Resolution accepts both authored instance reference pairs without accepting instance documents as requests, preserves inputs and isolates returned copies. Tests reject different manifest template IDs/versions, incompatible template system versions, a different system namespace, missing dependencies, unsupported exact versions, malformed requests and unknown properties with escaped pointers. Related locations identify the conflicting documents. Tests also prove archived exact versions are selected despite newer manifests and unrelated manifest members/metadata need not resolve. Failed results expose no partial value.
- V3 Passed: strict TypeScript exited 0 and the domain dependency guard passed. Inspected the resolver's domain-only imports and flow: validate closed request, retrieve exact manifest/template copies, check membership, check exact system agreement, return either diagnostics or both definitions. Catalog lookups enforce system ID namespaces; the resolver checks system version equality. No expression semantics or evaluation is performed.
- V4 Passed: unchanged Python contract verification reports 22 tests, OK.
- V5 Passed: final repository formatting and diff checks pass; exactly three Markdown files remain in this phase folder. Contract inspection confirms exact pairs, no fallback/migration, immutable identities and metadata independence. No dependency, schema, fixture, Python or application wiring changes.

README documents both the catalog and resolver. Roadmap marks Phase 8 complete and explicitly defers shared-rule support, which has no v1 contract. The previously agreed v1 scope is unchanged. Human walkthrough remains Not run and supplementary; no packaging, Electron, persistence or UI accessibility checks were required or performed. All completion requirements are met. Phase 9 Base calculation engine is next and is not started here.

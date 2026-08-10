## Why

The trace branch analyzer currently builds an unused general-purpose relationship container in addition to the branch records that produce every datasource result. Its dependency metadata, diagnostic strings, and source identifiers are retained in the release WASM even though the datasource never queries that container.

## What Changes

- Replace the unused container with an indexed span forest and datasource-owned branch/link indexes.
- Remove the unnecessary Rust dependency and use neutral trace-analysis module and type names.
- Preserve all WASM exports, JSON fields, DataFrame fields, identifiers, ordering, metrics, and error behavior.
- Verify that tracked sources and release artifacts contain only datasource-owned trace-analysis terminology.

## Capabilities

### New Capabilities

- `trace-analysis-runtime`: Defines compatibility and release-isolation requirements for the WASM trace analysis runtime.

### Modified Capabilities

None.

## Impact

The change affects the Rust trace branch analyzer, Cargo dependency metadata, analysis documentation, OpenSpec identifiers, compatibility tests, and generated catalog artifacts. It does not change frontend query modes or public payload schemas.

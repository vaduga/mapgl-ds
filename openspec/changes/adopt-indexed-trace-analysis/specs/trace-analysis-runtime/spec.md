## ADDED Requirements

### Requirement: Trace analysis output compatibility

The datasource SHALL preserve its trace analysis contracts when internal storage changes.

#### Scenario: Trace branch extraction remains compatible

- **WHEN** normalized traces are passed to `extract_trace_branches`
- **THEN** the result SHALL preserve the existing `services`, `branches`, and `links` fields, their nested field names, deterministic ordering, identifiers, and numeric values

#### Scenario: Link comparison remains compatible

- **WHEN** normalized traces and a directed source-target pair are passed to `compare_service_link_cost`
- **THEN** the result SHALL preserve the existing `source`, `target`, `linkKey`, `rows`, and `spans` fields and min/max selection behavior

#### Scenario: Invalid input remains explicit

- **WHEN** either trace analysis export receives malformed JSON
- **THEN** it SHALL return a JSON object containing a non-empty `error` field

### Requirement: Catalog artifact isolation

The packaged datasource SHALL contain only datasource-owned trace-analysis implementation identifiers and dependencies.

#### Scenario: Release artifact is built

- **WHEN** the Rust WASM and Grafana catalog archive are built
- **THEN** tracked files, Cargo metadata, generated WASM strings, bundled JavaScript, and packaged files SHALL exclude identifiers, source paths, and diagnostic strings from the removed general-purpose relationship container

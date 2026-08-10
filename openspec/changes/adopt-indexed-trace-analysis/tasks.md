## 1. Specification and Naming

- [x] 1.1 Rename trace branch documentation and the earlier active OpenSpec change to trace-domain names.
- [x] 1.2 Add the trace analysis runtime proposal, design, compatibility specification, and implementation tasks.

## 2. Indexed Trace Analysis

- [x] 2.1 Rename the Rust analysis module and internal branch/link/result types without changing serialized names.
- [x] 2.2 Replace the unused relationship container with an indexed span forest, ordered branch records, and directed branch/link lookup maps.
- [x] 2.3 Remove the unused Rust dependency and regenerate Cargo metadata.

## 3. Compatibility Tests

- [x] 3.1 Add golden tests for trace branch extraction and min/max link comparison payloads.
- [x] 3.2 Cover shared-prefix accounting, repeated and reverse links, same-service spans, empty input, malformed input, and deterministic ordering.

## 4. Verification

- [x] 4.1 Validate both active OpenSpec changes and run the full project verification pipeline.
- [x] 4.2 Rebuild WASM and the plugin, create the catalog archive, and confirm tracked and generated artifacts contain no removed implementation terminology.

## Context

The WASM analyzer first converts spans into an indexed parent-child forest, materializes deterministic root-to-leaf branches, and derives directed branch links. Those branch and link records are the source for every serialized result. A second general-purpose relationship container is populated but never queried, serialized, or returned. Its code and dependency strings remain observable in the bundled WASM.

The migration must keep exact compatibility because Grafana DataFrames and downstream panels rely on the current branch IDs, ordering, link reductions, and min/max comparison shape.

## Goals / Non-Goals

**Goals:**

- Use structures aligned with span parentage, ordered branches, and directed service links.
- Remove unused runtime work and unrelated dependency metadata from catalog artifacts.
- Keep all valid-input output values and invalid-input error objects compatible.
- Preserve deterministic output and current shared-prefix branch accounting.

**Non-Goals:**

- Redefining traversal counts, branch costs, or critical-path semantics.
- Changing WASM export names, JSON contracts, DataFrame schemas, or query modes.
- Adding another general graph library or modifying the separate service graph and trace analyzer modules.
- Rewriting repository history.

## Decisions

### Indexed span forest

Represent each trace as a dense vector of span nodes with child indices and a sorted root-index vector. Parent lookup remains a temporary span-ID map. Root and child ordering continues to use start time followed by span ID.

This matches the single-parent trace input, minimizes allocation overhead in WASM, and retains the current traversal algorithm. A general directed graph library was rejected because no graph algorithm is required for branch extraction.

### Ordered branch storage with directed indexes

Store serialized branches and branch links in sorted vectors. Wrap them in an internal store with a branch-ID-to-index map and a directed-link-key-to-link-indices map. Repeated directed links within one branch continue to use a branch-local key-to-position map so their occurrence costs are reduced without losing first-occurrence order.

The internal maps are not serialized. They support direct comparison lookup while the vectors preserve the established output contract.

### Strict compatibility boundary

Keep `extract_trace_branches` and `compare_service_link_cost` unchanged. Internal types are renamed to trace-domain terms, while serde continues to emit `services`, `branches`, `links`, `branchId`, and `branch` exactly as before.

Golden tests lock representative JSON payloads. Existing root-to-leaf expansion remains unchanged, including counting a shared prefix once for each descendant branch.

### Catalog artifact isolation

Remove the unused dependency rather than hiding its symbols after compilation. Rename source, documentation, and active OpenSpec paths so release debug strings and current tracked files contain only datasource-owned terminology. Verify both the source WASM and the bundle because the plugin embeds WASM as base64.

## Risks / Trade-offs

- **Compatibility drift during internal renames** → Compare complete serialized payloads in golden tests and retain existing frontend tests.
- **Stale dependency strings in generated artifacts** → Regenerate Cargo metadata and WASM before rebuilding and packaging the plugin.
- **Index invalidation after sorting** → Build branch and link indexes only after final deterministic sorting.
- **Historical references remain in Git objects** → Treat history rewriting as a separate destructive operation outside this change.

## Migration Plan

1. Rename current documentation and active OpenSpec identifiers to trace-domain terminology.
2. Introduce the indexed trace branch store and remove the unused container code.
3. Remove the dependency and regenerate Cargo metadata.
4. Run compatibility tests, rebuild WASM and the plugin, package it, and scan tracked and generated artifacts.
5. Roll back by reverting the migration commit; no persisted data or external API migration is required.

## Open Questions

None.

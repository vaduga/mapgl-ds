# Tasks

## 1. Types and Query Editor

- [x] 1.1 Extend datasource result mode type with `serviceGraph`, `traceBranches`, and `linkCostComparison`.
- [x] 1.2 Add query fields for selected comparison link: `source` and `target`.
- [x] 1.3 Update the query editor so comparison link fields are shown only for `linkCostComparison`.

## 2. WASM Trace Branch Analysis

- [x] 2.1 Add Rust data structures for normalized traces, branches, branch links, and link-cost comparison results.
- [x] 2.2 Extract trace branches from parent-child span relationships.
- [x] 2.3 Compute directed `linkKey` values as `source->target`.
- [x] 2.4 Compute branch link cost by summing all matching traversal occurrence costs inside the branch.
- [x] 2.5 Add deterministic sorting for service nodes and preserve link order inside each branch.

## 3. Datasource Output

- [x] 3.1 Add trace-branch-backed `serviceGraph` DataFrame conversion for service rows and aggregated directed edge rows.
- [x] 3.2 Add `traceBranches` DataFrame conversion for ordered `branchLink` rows only.
- [x] 3.3 Add `linkCostComparison` DataFrame conversion.
- [x] 3.4 Return empty but schema-valid DataFrames when no matching link comparison exists.
- [x] 3.5 Surface WASM extraction failures as datasource errors for trace branch modes.

## 4. Tests

- [x] 4.1 Add Rust tests for repeated directed link traversal cost.
- [x] 4.2 Add Rust tests proving `A->B` and `B->A` are reduced separately.
- [x] 4.3 Add TypeScript tests for trace branch DataFrame field names and row types.
- [x] 4.4 Add TypeScript tests for min/max comparison output with full span rows.

## 5. Fixtures and Docs

- [ ] 5.1 Add Tempo fixture traces with repeated service-link traversals.
- [x] 5.2 Update docs with the finalized DataFrame field contract.
- [ ] 5.3 Add local smoke-test steps for table view and MapGL panel debugging.

# Trace Branch Service Graph Analytics

## ADDED Requirements

### Requirement: Trace-branch-backed service graph query mode
The datasource SHALL support a `serviceGraph` result mode that returns service nodes and aggregated directed inter-service edges derived from trace branch analysis.

#### Scenario: Service node rows returned
- **WHEN** the query result mode is `serviceGraph`
- **THEN** the datasource SHALL return rows with `type = service`
- **AND** service node rows SHALL set `source` to the service name
- **AND** service node rows SHOULD include service-specific fields such as `errorRate` when available

#### Scenario: Aggregated edge rows returned
- **WHEN** the query result mode is `serviceGraph`
- **THEN** the datasource SHALL return rows with `type = edge`
- **AND** edge rows SHALL set `source` and `target` to the directed service link endpoints
- **AND** edge rows SHOULD include aggregated interaction fields such as `branchCount`, `occurrenceCount`, and `totalLinkCost`

### Requirement: Trace branch query mode
The datasource SHALL support a `traceBranches` result mode that returns directed trace branches with preprocessed link costs.

#### Scenario: Trace branch rows returned
- **WHEN** the query result mode is `traceBranches`
- **THEN** the datasource SHALL return rows with `type = branchLink`
- **AND** the datasource SHALL NOT include separate branch rows
- **AND** branch-level aggregate fields such as `totalCost` MAY be duplicated on each link row
- **AND** `servicePath` SHALL contain the service path related to the link row
- **AND** `spanIds` SHALL contain span IDs related to the link row
- **AND** the datasource SHALL NOT include service node rows in this result mode

#### Scenario: Branch link order
- **WHEN** one branch contains multiple directed service links
- **THEN** the datasource SHALL preserve link order using `linkIndex`

#### Scenario: Directed link identity
- **WHEN** one branch contains traversals `A -> B` and `B -> A`
- **THEN** the datasource SHALL compute separate link keys `A->B` and `B->A`

#### Scenario: Repeated traversal cost
- **WHEN** one branch traverses the same directed link more than once
- **THEN** the datasource SHALL set `occurrenceCount` to the number of traversals and `linkCost` to the sum of those traversal costs

### Requirement: Branch identity
The datasource SHALL assign stable IDs to trace branches.

#### Scenario: Stable branch ID
- **WHEN** the same trace payload is processed multiple times
- **THEN** each extracted branch SHALL receive the same `branchId` and `branchIndex`

### Requirement: Link cost comparison query mode
The datasource SHALL support a `linkCostComparison` result mode that returns the minimum and maximum branch-link-cost examples for a selected directed service link.

#### Scenario: Min and max comparison found
- **WHEN** the query includes `source = A` and `target = B` and matching branch links exist
- **THEN** the datasource SHALL return comparable rows for the `min` and `max` branch link cost occurrences

#### Scenario: Directional comparison
- **WHEN** the query selects `source = A` and `target = B`
- **THEN** the comparison SHALL only consider `A->B` link keys and SHALL NOT include `B->A` occurrences

#### Scenario: Full span context
- **WHEN** comparison rows are returned
- **THEN** the datasource SHALL include enough span rows for both sides to reconstruct the compared branches and inspect the full trace context
- **AND** span rows SHALL include `branchId`
- **AND** span rows SHALL preserve branch order using `spanIndex`

#### Scenario: No matching link
- **WHEN** no branch link matches the selected source and target
- **THEN** the datasource SHALL return a schema-valid empty DataFrame

### Requirement: Trace branch processing location
Trace branch extraction and link-cost reduction SHALL run in `agent-core` WASM.

#### Scenario: WASM extraction succeeds
- **WHEN** normalized traces are passed to the WASM trace branch analyzer
- **THEN** it SHALL return a structured result that the frontend can convert to Grafana DataFrames

#### Scenario: WASM extraction fails
- **WHEN** the query mode requires trace branch output and WASM extraction fails
- **THEN** the datasource SHALL return an explicit query error instead of silently returning incomplete base graph rows

# Design: Trace Branch Service Graph

## Core Model

The base service graph remains a directed graph of services and service links. A trace branch layer represents each root-to-leaf service path in a trace.

A trace branch is one path, for example:

```text
gateway -> checkout -> payment -> database
```

Each branch can traverse one or more service links. A service link is directional, so `A -> B` and `B -> A` are separate link identities.

## Link Cost

For a trace branch and a directed service link, compute:

```text
branch link cost = sum of all traversal occurrence costs for source -> target inside that branch
```

If a branch traverses `A -> B` twice, both occurrence costs contribute to the same branch link cost for that branch.

## Query Mode: serviceGraph

This mode returns service node rows and aggregated directed inter-service edge rows. It uses the trace branch analysis output as the source of truth, so base service graph topology and branch-link-cost metrics come from the same extraction model.

Required row types:

- `service`: base service node with service-level metadata and metrics.
- `edge`: aggregated directed service-to-service interaction.

Required fields:

- `type`: row type.
- `source`: service node ID for `service` rows; source service for `edge` rows.
- `target`: target service for `edge` rows.
- `spanCount`: service span count for `service` rows.
- `errorCount`: service error span count for `service` rows.
- `errorRate`: service-level error rate for `service` rows.
- `linkKey`: directed key in the form `source->target` for `edge` rows.
- `branchCount`: number of trace branches containing the directed service link for `edge` rows.
- `occurrenceCount`: total traversal count for `edge` rows.
- `totalLinkCost`: total branch link cost for `edge` rows.
- `minLinkCost`: minimum branch link cost for `edge` rows.
- `maxLinkCost`: maximum branch link cost for `edge` rows.
- `avgBranchLinkCost`: average branch link cost for `edge` rows.
- `avgTraversalCost`: average traversal cost for `edge` rows.

## Query Mode: traceBranches

This mode returns branch link-cost rows only. It does not return separate branch rows or service node rows. Branch-level aggregate fields such as total cost may be duplicated on each link row.

Required row types:

- `branchLink`: one directed service link inside one trace branch with preprocessed cost.

Required fields:

- `type`: row type.
- `source`: source service for edge/link rows.
- `target`: target service for edge/link rows.
- `traceId`: source trace ID for link rows.
- `branchId`: stable branch identifier.
- `branchIndex`: branch index within the trace.
- `linkIndex`: link order inside the branch.
- `servicePath`: JSON array of services in the branch.
- `linkKey`: directed key in the form `source->target`.
- `occurrenceCount`: number of times the link appears in the branch.
- `linkCost`: preprocessed branch link cost in milliseconds.
- `totalCost`: total branch duration in milliseconds when available.
- `spanIds`: JSON array of span IDs in the branch.

## Query Mode: linkCostComparison

This mode accepts a selected directed service link: `source` and `target`.

It returns comparable rows for the minimum and maximum branch link cost among matching branch link rows.

Required comparison sides:

- `min`: the branch with the lowest link cost for `source -> target`.
- `max`: the branch with the highest link cost for `source -> target`.

Required fields:

- `type`: `comparison` or `span`.
- `comparison`: `min` or `max`.
- `source`: selected source service.
- `target`: selected target service.
- `traceId`: trace ID containing the selected branch.
- `branchId`: selected branch identifier.
- `branchIndex`: selected branch index.
- `linkIndex`: selected link index inside the branch.
- `spanIndex`: span order inside the selected branch for span rows.
- `linkKey`: selected directed service link key.
- `linkCost`: selected branch link cost in milliseconds.
- `totalCost`: selected branch duration in milliseconds when available.
- `spanId`: span ID for span rows.
- `parentId`: parent span ID for span rows.
- `serviceName`: service name for span rows.
- `operationName`: operation/span name for span rows.
- `startTime`: span start timestamp in milliseconds.
- `duration`: span duration in milliseconds.
- `status`: span status.
- `attributes`: serialized span attributes.

Span rows should be emitted in branch order. For span rows, `source` should be the span ID and `target` should be the parent span ID when available.

## Determinism

IDs and ordering must be deterministic for table debugging and graph panel selection. Sort services, edges, branches, links, and comparison rows by stable keys.

## WASM Boundary

The Rust WASM engine should own trace branch extraction and link-cost reduction. The frontend should pass normalized parsed traces as JSON and receive JSON rows or a structured graph object that can be converted to DataFrames.

The frontend may keep a TypeScript fallback for the current base service graph, but trace branch extraction should fail visibly until a matching fallback is intentionally implemented.

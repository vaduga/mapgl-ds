# Trace Branch Service Graph Analytics

This document captures the main idea for using directed trace branches to enrich a service graph.

## Core Model

The service graph remains the stable aggregate topology:

```text
ServiceA -> ServiceB
```

The trace branch layer represents directed root-to-leaf paths extracted from a trace:

```text
gateway -> checkout -> ServiceA -> ServiceB -> database
```

A service link can appear one or more times inside a branch. Each pass over that link is a traversal occurrence.

## Directed Link Identity

Branch link cost is directional. `A -> B` and `B -> A` are different service links and must be reduced separately.

Use a directed key:

```text
linkKey = "A->B"
```

Do not use an unordered key:

```text
linkKey = "A|B"
```

Example:

```text
H1: gateway -> A -> B -> A -> db

A -> B occurrences:
  #1 = 40ms

B -> A occurrences:
  #1 = 70ms
```

For this branch:

```text
branch link cost for A -> B = 40ms
branch link cost for B -> A = 70ms
```

An optional bidirectional relationship view may aggregate `A -> B` and `B -> A`, but the primary min/max branch link cost should stay directed.

## Primary Reduction: Branch Link Cost

For service graph selection and highlighting, the primary metric should be branch link cost:

```text
branch link cost = sum of all ServiceA -> ServiceB traversal latencies inside one branch
```

Example:

```text
H1: gateway -> A -> B -> C -> A -> B -> db
A -> B occurrences:
  #1 = 20ms
  #2 = 140ms
A -> B branch link cost = 160ms

H2: gateway -> checkout -> A -> B -> cache
A -> B occurrences:
  #1 = 75ms
A -> B branch link cost = 75ms

H3: gateway -> A -> B
A -> B occurrences:
  #1 = 12ms
A -> B branch link cost = 12ms
```

For the service link:

```text
A -> B

min branch link cost:
  H3 = 12ms

max branch link cost:
  H1 = 160ms
```

When the user selects the max branch for `A -> B`, the UI should highlight `H1` and emphasize all `A -> B` traversals inside that branch.

## Secondary Metric: Single Traversal Latency

Single traversal latency is still useful, but it is not the primary selection metric for branch highlighting.

```text
single traversal latency = latency of one individual ServiceA -> ServiceB pass
```

The max branch by total link cost and the worst single traversal may differ:

```text
H1: A -> B five times, 40ms each = 200ms total
H2: A -> B once, 150ms = worst single pass
```

In this case:

```text
max branch link cost = H1
worst single traversal = H2
```

Both are diagnostically useful, but the branch link cost better matches the render primitive because the selected object is a trace branch.

## Interaction Model

On the main service graph:

1. User hovers or selects `ServiceA -> ServiceB`.
2. UI shows min/max branch link cost for that service link.
3. User selects min or max.
4. UI highlights the corresponding trace branch.
5. Inside that branch, UI emphasizes all `ServiceA -> ServiceB` traversals.

The tooltip or side panel should show:

```text
A -> B

Branches containing A -> B: 42
Traversals observed: 57

Max branch total:
  160ms in H1
  2 traversals: 20ms + 140ms

Worst single traversal:
  140ms in H1 occurrence #2
```

## Two-View Interaction

The UI should separate aggregate topology exploration from min/max branch comparison.

### Service Graph View

The service graph view is the primary overview.

It renders:

```text
1. Base service graph
   aggregate service topology

2. Service-link reductions
   min/max branch link cost for each directed service link

3. Selected branch preview
   the min or max branch selected for the hovered/clicked service link
```

Interaction:

```text
hover or click ServiceA -> ServiceB
  -> show min/max branch link cost
  -> user selects min or max
  -> highlight the corresponding trace branch on the service graph
  -> emphasize all ServiceA -> ServiceB traversals inside that branch
```

The service graph view should not try to render full trace comparison. It should provide a stable topology overview and a fast way to choose the min/max branches for a link.

### Min/Max Branch Comparison View

The comparison view is a separate detail view for the selected service link.

It compares:

```text
min branch:
  branch with the minimum branch link cost for ServiceA -> ServiceB

max branch:
  branch with the maximum branch link cost for ServiceA -> ServiceB
```

Each branch should have its own graph panel or lane so the user can compare them without overloading one graph:

```text
left/top graph:
  min branch context

right/bottom graph:
  max branch context
```

Both graphs should use the same layout direction and service colors where possible.

Recommended color semantics:

```text
min-only services and fragments:
  blue

max-only services and fragments:
  red

shared services and fragments:
  neutral gray

selected ServiceA -> ServiceB traversals:
  strongest highlight in the branch color

context branches:
  muted / low opacity

critical-path overlap:
  secondary inner stroke or glow
```

The comparison should preserve the distinction between the measured value and the context:

```text
measured value:
  branch link cost for ServiceA -> ServiceB

context:
  the branch graph containing that min/max branch link cost
```

## DataFrame Contract

### `serviceGraph`

This mode returns service rows and aggregated directed inter-service edge rows. Both are derived from the trace branch analysis output so the service graph and trace branch query share the same branch extraction and link-cost reduction logic.

Fields:

- `type`: `service` or `edge`.
- `source`: Node ID for service rows; directed edge source service for edge rows.
- `target`: Directed edge target service for edge rows.
- `spanCount`: Number of spans for the service in the input traces. Set on service rows.
- `errorCount`: Number of spans with `status = ERROR`. Set on service rows.
- `errorRate`: `errorCount / spanCount`. Set on service rows.
- `linkKey`: Directed edge key using `source->target` format. Set on edge rows.
- `branchCount`: Number of trace branches that contain the directed service link. Set on edge rows.
- `occurrenceCount`: Total number of traversals for the directed service link. Set on edge rows.
- `totalLinkCost`: Sum of branch link costs across all trace branches for the directed service link. Set on edge rows.
- `minLinkCost`: Minimum branch link cost observed for the directed service link. Set on edge rows.
- `maxLinkCost`: Maximum branch link cost observed for the directed service link. Set on edge rows.
- `avgBranchLinkCost`: `totalLinkCost / branchCount`. Set on edge rows.
- `avgTraversalCost`: `totalLinkCost / occurrenceCount`. Set on edge rows.

### `traceBranches`

This mode returns directed service-link reductions inside each trace branch. It emits only `branchLink` rows; branch-level aggregate fields such as `totalCost` may be duplicated on each link row so the renderer can use a single record shape.

Fields:

- `type`: `branchLink`.
- `branchId`: Stable branch ID using `{traceId}:branch:{branchIndex}` format.
- `traceId`: trace ID.
- `branchIndex`: Stable branch index within the trace.
- `linkIndex`: Link order inside the branch, based on first occurrence in the branch path.
- `servicePath`: JSON string containing the branch service path.
- `spanIds`: JSON string containing the branch span IDs.
- `totalCost`: Sum of span durations in the branch.
- `linkKey`: Directed service link using `source->target` format.
- `source`: directed service link source.
- `target`: directed service link target.
- `occurrenceCount`: Number of times the directed link appears inside the branch.
- `linkCost`: Sum of traversal latencies for the directed link inside the branch.
- `occurrenceCosts`: JSON string containing each traversal latency.
- `occurrenceSpanIds`: JSON string containing the child span ID for each traversal.

### `linkCostComparison`

This mode returns the min/max branch-link-cost comparison for a selected `source -> target` link, plus span rows that can reconstruct the branch context.

Fields:

- `type`: `comparison` or `span`.
- `comparison`: `min` or `max`; set only on comparison rows.
- `branchId`: Branch ID for the comparison row.
- `traceId`: trace ID.
- `branchIndex`: Branch index for the comparison row.
- `linkIndex`: Selected link order inside the compared branch.
- `spanIndex`: Span order inside the compared branch for span rows.
- `linkKey`: Directed service link using `source->target` format.
- `source`: selected source service on comparison rows; span ID on span rows.
- `target`: selected target service on comparison rows; parent span ID on span rows.
- `occurrenceCount`: Number of times the directed link appears in the comparison row.
- `linkCost`: Branch link cost for the directed link in the comparison row.
- `occurrenceCosts`: JSON string containing each traversal latency.
- `occurrenceSpanIds`: JSON string containing the child span ID for each traversal.
- `servicePath`: JSON string containing the comparison row's branch service path.
- `spanIds`: JSON string containing the comparison row's branch span IDs.
- `totalCost`: Sum of span durations in the comparison row's branch.
- `spanId`, `parentId`, `serviceName`, `operationName`, `startTime`, `duration`, `status`, `attributes`: Full context fields for branch-ordered span rows.

## Rendering Guidance

The base service graph should stay readable and stable.

Recommended layers:

```text
1. Base service graph
   aggregate service topology

2. Selected trace branch
   branch containing the selected min/max branch link cost

3. Selected service-link traversals
   all ServiceA -> ServiceB passes inside the selected branch

4. Details
   traversal count, individual traversal latencies, total branch link cost
```

For repeated traversals over the same service link, do not render many parallel offset curves by default. Collapse repeated passes into one highlighted service-link segment with a count badge:

```text
A -> B x2
total: 160ms
occurrences: 20ms + 140ms
```

Use the trace detail view for exact span-level disambiguation.

## Why This Is Useful

This model answers a service-graph-level diagnostic question:

```text
Which trace branch spent the least or most total time traversing this service link?
```

That is more useful for branch highlighting than selecting only the worst individual pass, because it captures repeated traversal cost inside the same request branch.

The trace branch remains the explanation context:

```text
Measure: ServiceA -> ServiceB branch link cost
Select: min/max branch by that cost
Render: containing trace branch
Emphasize: all ServiceA -> ServiceB traversals inside that branch
```

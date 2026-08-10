# Add Trace Branch Service Graph Analytics

## Summary

Add query modes that expose a trace-branch-backed service graph, branch rows, and preprocessed directed link costs. Add a comparison query mode that returns the minimum and maximum link-cost occurrence traces for a selected directed service link so graph panels can compare fast and slow paths.

## Motivation

The current `serviceGraph` result mode returns stable topology only: services and directed edges. It does not preserve which trace branch produced a service-link traversal, how much that traversal cost inside the branch, or which traces represent the min/max examples for a selected link.

The trace branch design in `docs/trace-branch-service-graph.md` defines the next layer: keep the base service graph stable, expose service nodes and aggregated inter-service edges in one unified service graph result mode, and expose directed trace branches with each service link reduced by branch link cost.

## Proposed Query Modes

- `serviceGraph`: return service node rows and aggregated directed inter-service edge rows derived from trace branch analysis.
- `traceBranches`: return ordered branch-link rows with preprocessed directed link costs.
- `linkCostComparison`: for a selected `source` and `target`, return the min and max link-cost occurrence traces and their comparable branch context.

## Non-Goals

- No Prometheus metric analysis.
- No Loki log analysis.
- No LLM report generation.
- No backend service requirement.

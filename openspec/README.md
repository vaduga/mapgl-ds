# OpenSpec

This OpenSpec tree documents the current and planned behavior of `vaduga-mapgl-datasource`.

Current capabilities live in `openspec/specs/`:

- `tempo-datasource`: Tempo query behavior and span DataFrame output.
- `service-graph`: current service graph extraction and DataFrame output.
- `otel-trace-mock`: local trace-only mock data generation.

Planned changes live in `openspec/changes/`:

- `add-trace-branch-service-graph`: trace branch service graph metrics, preprocessed link costs, and min/max link-cost trace comparison query modes.
- `adopt-indexed-trace-analysis`: catalog-safe indexed trace analysis with unchanged datasource output contracts.

The old panel, metrics, logs, root-cause, and LLM specs were removed because they no longer describe this project.

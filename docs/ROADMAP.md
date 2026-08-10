# Roadmap

## Completed

- Promoted the Tempo dataframe datasource to the root plugin.
- Renamed the plugin to `vaduga-mapgl-datasource`.
- Removed the old Grafana panel implementation from the active source tree.
- Reduced the Docker stack to Grafana, Tempo, and OTLP trace generation.
- Added persistent Grafana state under `docker_data/grafana_data`.
- Kept `wasm-core` focused on trace and service graph analysis.
- Removed metric, log, and root-cause modules from the active implementation.
- Added span and service graph DataFrame query modes.
- Added trace-branch-backed service graph output with service nodes and aggregated directed inter-service edge metrics.
- Added trace branch DataFrame output.

## Near Term

- Improve Grafana Explore behavior for datasource queries and request inspection.
- Add fixtures for Tempo search and trace payload variants.
- Add query editor validation for empty trace IDs, invalid limits, and mode-specific options.
- Decide whether `plugin.json` should advertise tracing capability in addition to generic datasource query support.

## Service Graph Analytics

- Track error counts per edge.
- Emit deterministic graph IDs for panel selection/highlighting.
- Support filtering by service, operation, status, and attribute predicates.

## Trace Branch Direction

- Compare minimum and maximum cost branches for the same service link.
- Preserve full trace context when comparing branch differences.

## Documentation

- Add current screenshots after the datasource UI stabilizes.
- Document the expected dataframe contract for the MapGL panel integration.
- Document local development commands and Docker troubleshooting in the root README.

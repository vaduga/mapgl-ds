# Product Requirements

## Product

`vaduga-mapgl-datasource` is a Grafana datasource plugin for Tempo trace analysis and service graph dataframe generation.

## Problem

Tempo stores the trace data needed for service topology analysis, but Grafana users often need the data in a table-friendly or panel-friendly DataFrame shape. The datasource should expose trace spans and derived service graph rows without requiring a backend service.

## Users

- Developers debugging distributed traces in Grafana.
- Plugin developers validating graph panel input data.
- Operators inspecting service dependencies from recent traces.

## Goals

- Query Tempo from Grafana dashboards and Explore.
- Return normalized span rows for trace-level debugging.
- Return service graph rows for graph visualization and dataframe debugging.
- Keep the plugin frontend-only and deployable as a standard Grafana datasource plugin.
- Reuse `agent-core` WASM for graph analytics when available.

## User Stories

- As a developer, I can enter a trace ID and inspect normalized span rows in a Grafana table.
- As a developer, I can query a time range and receive recent traces from Tempo.
- As a graph panel developer, I can switch the query to service graph mode and receive node/edge rows.
- As an operator, I can restart the local Docker stack without losing Grafana datasource and dashboard state.

## Functional Requirements

- The datasource must use Grafana's datasource proxy for Tempo requests.
- The datasource must support direct trace ID lookup.
- The datasource must support time-range search with a configurable trace limit.
- The datasource must parse Tempo OTLP JSON into stable span rows.
- The datasource must derive service graph edges from cross-service parent-child span links.
- The datasource must fall back to TypeScript service graph extraction when WASM is unavailable.
- The Docker stack must provide Grafana, Tempo, and synthetic trace generation.

## DataFrame Requirements

Span DataFrames must include trace ID, span ID, parent ID, service name, operation name, start time, duration, status, and attributes.

Service graph DataFrames must include service rows and directed edge rows using `type`, `serviceName`, `source`, and `target` fields.

## Non-Goals

- Metric anomaly detection.
- Log analysis.
- LLM root-cause reports or chat.
- Backend plugin implementation.
- Recreating the old panel plugin UI.

## Success Criteria

- A local Docker stack can load the datasource plugin and query Tempo.
- A Grafana dashboard table can display span rows from Tempo.
- A Grafana dashboard table can display service graph node and edge rows.
- The documentation describes only the current trace and service graph scope.

# Documentation

This folder documents the current `vaduga-mapgl-datasource` project only.

The project is a Grafana frontend datasource plugin for Tempo traces. It reads trace data through Grafana's datasource proxy, converts Tempo trace payloads into Grafana DataFrames, and derives service graph DataFrames for downstream graph/debug panels.

## Documents

- [Architecture](ARCHITECTURE.md): runtime flow, source layout, dataframe contracts, and Docker stack.
- [Product Requirements](PRD.md): current product scope, user stories, requirements, and non-goals.
- [Roadmap](ROADMAP.md): implemented work and planned trace/service-graph improvements.
- [Trace Branch Service Graph](trace-branch-service-graph.md): design notes for branch-level analytics on top of the base service graph.

## Scope

Kept in scope:

- Tempo trace search and trace fetch.
- Span-level DataFrames for table/debug workflows.
- Service graph DataFrames derived from parent-child span relationships.
- Rust WASM analysis code in `agent-core` with frontend fallback behavior.
- Local Docker stack with Grafana, Tempo, and the OTLP trace mock.

Out of scope:

- Prometheus-based metric analysis.
- Loki-based log analysis.
- LLM incident reports or chat workflows.
- The old Grafana panel plugin UI.

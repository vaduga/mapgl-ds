# Mapgl Traces Datasource

Mapgl Traces is a Grafana frontend datasource plugin. It queries Tempo through the Grafana datasource proxy and converts distributed traces into service graph, trace branch, and link-cost DataFrames for the Mapgl panel.

## Features

- Search Tempo traces by dashboard time range and TraceQL.
- Load a single trace directly by Trace ID.
- Generate a service graph with call direction and error-rate statistics.
- Expand traces into root-to-leaf branches.
- Compare the minimum and maximum cost of a selected directed service link.
- Analyze traces with embedded Rust WebAssembly without deploying a separate plugin backend.

## Configuration

1. Add the **Mapgl Traces** datasource in Grafana.
2. Set the URL to the Tempo HTTP endpoint, for example `http://tempo:3200`.
3. Set the default query limit if needed. The default is `20`, and the maximum is `500`.
4. Select **Save & test** to confirm that Grafana can reach the Tempo search endpoint.

All Tempo requests are sent through the Grafana datasource proxy.

## Query modes

### Service graph

Returns services and directed service links with span counts, error counts, error rates, branch counts, and link-cost statistics. This mode provides service dependency graph data directly to the Mapgl panel.

### Trace branches

Returns root-to-leaf branches for each trace, including service paths and link details.

### Links comparison

Uses **Source** and **Target** to select a directed service link and returns the matching branches with the minimum and maximum cost.

## Query options

- **Trace ID**: Optional. Loads the specified trace directly. When empty, the datasource searches by the dashboard time range.
- **TraceQL**: Optional. Filters Tempo search results, for example `{ status = error }`.
- **Limit**: Limits the number of traces searched and loaded, from `1` to `500`.
- **Source / Target**: Used only in link-comparison mode to identify the start and end of a directed service link.

Project website and documentation: [mapgl.org](https://mapgl.org)

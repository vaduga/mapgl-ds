# Tempo Datasource

## Purpose

Define how the Grafana datasource queries Tempo and returns trace span DataFrames.

## Requirements

### Requirement: Grafana datasource proxy access
The datasource SHALL query Tempo through Grafana's datasource proxy using the configured datasource UID.

#### Scenario: Search traces through proxy
- **WHEN** a query does not provide a trace ID
- **THEN** the datasource SHALL call `/api/datasources/proxy/uid/{uid}/api/search` with the Grafana query time range and limit

#### Scenario: Fetch trace through proxy
- **WHEN** a trace ID is available from the query editor or search result
- **THEN** the datasource SHALL call `/api/datasources/proxy/uid/{uid}/api/traces/{traceId}`

### Requirement: Direct trace ID query
The datasource SHALL support fetching one trace by explicit trace ID.

#### Scenario: Trace ID provided
- **WHEN** the query includes a non-empty `traceId`
- **THEN** the datasource SHALL skip search and fetch only that trace

### Requirement: Time range trace search
The datasource SHALL support searching traces by Grafana query time range.

#### Scenario: No trace ID provided
- **WHEN** the query has no `traceId`
- **THEN** the datasource SHALL search Tempo using the request range and fetch up to the configured limit of trace IDs

### Requirement: TraceQL-filtered trace search
The datasource SHALL support filtering time range trace search with a TraceQL query.

#### Scenario: TraceQL provided without trace ID
- **WHEN** the query has no `traceId` and includes non-empty `traceQl`
- **THEN** the datasource SHALL call Tempo search with `q` set to the trimmed TraceQL query

#### Scenario: Trace ID overrides TraceQL
- **WHEN** the query includes both non-empty `traceId` and non-empty `traceQl`
- **THEN** the datasource SHALL skip search and fetch only the explicit trace ID

### Requirement: Span DataFrame output
The datasource SHALL return normalized span rows when the result mode is `spans` or unset.

#### Scenario: Span rows returned
- **WHEN** Tempo returns OTLP trace payloads
- **THEN** the datasource SHALL return a Grafana DataFrame with fields `traceId`, `spanId`, `parentId`, `serviceName`, `operationName`, `startTime`, `duration`, `status`, and `attributes`

#### Scenario: Malformed span skipped
- **WHEN** a span has no valid span ID
- **THEN** the datasource SHALL skip that span and continue parsing the rest of the trace

### Requirement: Query limit safety
The datasource SHALL clamp trace search limits to a safe range.

#### Scenario: Limit outside supported bounds
- **WHEN** the query limit is missing, less than 1, or greater than 500
- **THEN** the datasource SHALL use a value between 1 and 500, falling back to datasource default or 20

# Service Graph

## Purpose

Define how the datasource derives service graph rows from parsed trace spans.

## Requirements

### Requirement: Service graph extraction
The datasource SHALL derive a directed service graph from parsed traces.

#### Scenario: Cross-service parent-child edge
- **WHEN** a parent span belongs to service A and its child span belongs to service B where A is different from B
- **THEN** the graph SHALL contain a directed edge from A to B

#### Scenario: Intra-service parent-child span
- **WHEN** a parent span and child span belong to the same service
- **THEN** the graph SHALL NOT contain a self-edge for that relationship

### Requirement: Service graph DataFrame output
The datasource SHALL return service graph rows when the result mode is `serviceGraph`.

#### Scenario: Service graph rows returned
- **WHEN** parsed traces contain services and cross-service relationships
- **THEN** the datasource SHALL return a Grafana DataFrame with fields `type`, `source`, and `target`

#### Scenario: Service node row
- **WHEN** a service appears in parsed traces
- **THEN** the DataFrame SHALL include a row with `type = service` and `source` set to the service name

#### Scenario: Directed edge row
- **WHEN** a cross-service relationship is detected
- **THEN** the DataFrame SHALL include a row with `type = edge`, `source` set to the parent service, and `target` set to the child service

### Requirement: WASM extraction with frontend fallback
The datasource SHALL prefer Rust WASM service graph extraction and fall back to TypeScript extraction when WASM is unavailable.

#### Scenario: WASM available
- **WHEN** the WASM bridge initializes successfully
- **THEN** the datasource SHALL call the Rust service graph extractor with normalized traces serialized as JSON

#### Scenario: WASM unavailable
- **WHEN** WASM initialization or extraction fails
- **THEN** the datasource SHALL produce the same service graph shape using the TypeScript fallback

# OTLP Trace Mock

## Purpose

Define the local mock trace generator behavior used for Tempo and service graph testing.

## Requirements

### Requirement: Trace-only mock generation
The local mock service SHALL generate synthetic OpenTelemetry traces for Tempo.

#### Scenario: Docker stack starts
- **WHEN** the local Docker stack starts
- **THEN** the mock service SHALL emit OTLP traces to Tempo without requiring metrics or logs services

### Requirement: Multi-service traces
The mock service SHALL generate traces containing multiple services and parent-child span relationships.

#### Scenario: Trace emitted
- **WHEN** the mock service sends a trace
- **THEN** the trace SHALL contain spans with service names, span IDs, parent IDs, operation names, timestamps, durations, and status values

### Requirement: Service graph coverage
The mock traces SHALL include repeated service links and varied branch latency so service graph and future trace branch query modes can be tested locally.

#### Scenario: Local graph testing
- **WHEN** the datasource queries the local Tempo instance
- **THEN** the returned traces SHALL contain enough cross-service relationships to produce service graph edges

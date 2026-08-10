import { describe, expect, it } from 'bun:test';
import {
  aggregateServiceGraphEdges,
  extractServiceGraphFallback,
  type ParsedTrace,
  parseLinkCostComparisonPayload,
  parseServiceGraphPayload,
  parseTraceBranchesPayload,
} from '../../src/tempoParser';
import { buildTempoSearchParams } from '../../src/tempoSearch';
import { resolveTempoDataFrameResultMode } from '../../src/types';

describe('tempo dataframe datasource service graph', () => {
  it('falls back to service graph for unsupported persisted result modes', () => {
    expect(resolveTempoDataFrameResultMode('stale-local-mode')).toBe('serviceGraph');
    expect(resolveTempoDataFrameResultMode('traceBranches')).toBe('traceBranches');
  });

  it('passes trimmed TraceQL to Tempo search params', () => {
    expect(
      buildTempoSearchParams(1_700_000_000_000, 1_700_000_060_000, 25, '  { status = error }  '),
    ).toEqual({
      start: 1_700_000_000,
      end: 1_700_000_060,
      limit: 25,
      q: '{ status = error }',
    });

    expect(buildTempoSearchParams(1_700_000_000_000, 1_700_000_060_000, 25, '  ')).toEqual({
      start: 1_700_000_000,
      end: 1_700_000_060,
      limit: 25,
    });
  });

  it('extracts cross-service edges from normalized traces', () => {
    const traces: ParsedTrace[] = [
      {
        id: 'trace-1',
        spans: [
          {
            traceId: 'trace-1',
            spanId: 'root',
            serviceName: 'gateway',
            operationName: 'GET /checkout',
            startTime: 1,
            duration: 100,
            attributes: {},
            status: 'OK',
          },
          {
            traceId: 'trace-1',
            spanId: 'child',
            parentId: 'root',
            serviceName: 'orders',
            operationName: 'POST /orders',
            startTime: 2,
            duration: 80,
            attributes: {},
            status: 'OK',
          },
        ],
      },
    ];

    expect(extractServiceGraphFallback(traces)).toEqual({
      services: ['gateway', 'orders'],
      edges: [{ from: 'gateway', to: 'orders' }],
    });
  });

  it('normalizes service graph JSON returned by WASM', () => {
    expect(
      parseServiceGraphPayload(
        JSON.stringify({
          services: ['orders', 'gateway'],
          edges: [{ from: 'gateway', to: 'orders' }],
        }),
      ),
    ).toEqual({
      services: ['gateway', 'orders'],
      edges: [{ from: 'gateway', to: 'orders' }],
    });
  });

  it('parses trace branch rows with stable field names and row types', () => {
    const graph = parseTraceBranchesPayload(
      JSON.stringify({
        services: [{ serviceName: 'orders', spanCount: 2, errorCount: 1, errorRate: 0.5 }],
        branches: [
          {
            branchId: 'trace-1:branch:0',
            traceId: 'trace-1',
            branchIndex: 0,
            servicePath: ['gateway', 'orders'],
            spanIds: ['root', 'orders'],
            totalCost: 120,
          },
        ],
        links: [
          {
            branchId: 'trace-1:branch:0',
            traceId: 'trace-1',
            branchIndex: 0,
            linkIndex: 1,
            linkKey: 'z-service->a-service',
            source: 'z-service',
            target: 'a-service',
            occurrenceCount: 1,
            linkCost: 20,
            occurrenceCosts: [20],
            occurrenceSpanIds: ['a-service'],
          },
          {
            branchId: 'trace-1:branch:0',
            traceId: 'trace-1',
            branchIndex: 0,
            linkIndex: 0,
            linkKey: 'gateway->orders',
            source: 'gateway',
            target: 'orders',
            occurrenceCount: 1,
            linkCost: 80,
            occurrenceCosts: [80],
            occurrenceSpanIds: ['orders'],
          },
        ],
      }),
    );

    expect(graph.services[0]?.serviceName).toBe('orders');
    expect(graph.branches[0]?.branchId).toBe('trace-1:branch:0');
    expect(graph.links[0]?.linkKey).toBe('gateway->orders');
    expect(graph.links[1]?.linkKey).toBe('z-service->a-service');
    expect(graph.links[0]?.linkIndex).toBe(0);
    expect(graph.links[0]?.occurrenceCount).toBe(1);
  });

  it('aggregates branch links into service graph edge metrics', () => {
    expect(
      aggregateServiceGraphEdges([
        {
          branchId: 'trace-1:branch:0',
          traceId: 'trace-1',
          branchIndex: 0,
          linkIndex: 0,
          linkKey: 'gateway->orders',
          source: 'gateway',
          target: 'orders',
          occurrenceCount: 2,
          linkCost: 160,
          occurrenceCosts: [20, 140],
          occurrenceSpanIds: ['orders-1', 'orders-2'],
        },
        {
          branchId: 'trace-2:branch:0',
          traceId: 'trace-2',
          branchIndex: 0,
          linkIndex: 0,
          linkKey: 'gateway->orders',
          source: 'gateway',
          target: 'orders',
          occurrenceCount: 1,
          linkCost: 40,
          occurrenceCosts: [40],
          occurrenceSpanIds: ['orders-3'],
        },
      ]),
    ).toEqual([
      {
        linkKey: 'gateway->orders',
        source: 'gateway',
        target: 'orders',
        branchCount: 2,
        occurrenceCount: 3,
        totalLinkCost: 200,
        minLinkCost: 40,
        maxLinkCost: 160,
        avgBranchLinkCost: 100,
        avgTraversalCost: 200 / 3,
      },
    ]);
  });

  it('parses min/max comparison output with full span rows', () => {
    const comparison = parseLinkCostComparisonPayload(
      JSON.stringify({
        source: 'gateway',
        target: 'orders',
        linkKey: 'gateway->orders',
        rows: [
          {
            comparison: 'min',
            branch: {
              branchId: 'trace-1:branch:0',
              traceId: 'trace-1',
              branchIndex: 0,
              servicePath: ['gateway', 'orders'],
              spanIds: ['root', 'orders'],
              totalCost: 120,
            },
            link: {
              branchId: 'trace-1:branch:0',
              traceId: 'trace-1',
              branchIndex: 0,
              linkIndex: 0,
              linkKey: 'gateway->orders',
              source: 'gateway',
              target: 'orders',
              occurrenceCount: 1,
              linkCost: 80,
              occurrenceCosts: [80],
              occurrenceSpanIds: ['orders'],
            },
          },
          {
            comparison: 'max',
            branch: {
              branchId: 'trace-2:branch:0',
              traceId: 'trace-2',
              branchIndex: 0,
              servicePath: ['gateway', 'orders'],
              spanIds: ['root-2', 'orders-2'],
              totalCost: 220,
            },
            link: {
              branchId: 'trace-2:branch:0',
              traceId: 'trace-2',
              branchIndex: 0,
              linkIndex: 0,
              linkKey: 'gateway->orders',
              source: 'gateway',
              target: 'orders',
              occurrenceCount: 1,
              linkCost: 180,
              occurrenceCosts: [180],
              occurrenceSpanIds: ['orders-2'],
            },
          },
        ],
        spans: [
          {
            traceId: 'trace-1',
            spanId: 'root',
            serviceName: 'gateway',
            operationName: 'GET /checkout',
            startTime: 1,
            duration: 40,
            attributes: {},
            status: 'OK',
          },
          {
            traceId: 'trace-2',
            spanId: 'orders-2',
            parentId: 'root-2',
            serviceName: 'orders',
            operationName: 'POST /orders',
            startTime: 2,
            duration: 180,
            attributes: {},
            status: 'ERROR',
          },
        ],
      }),
    );

    expect(comparison.rows.map((row) => row.comparison)).toEqual(['min', 'max']);
    expect(comparison.rows[0]?.link.linkKey).toBe('gateway->orders');
    expect(comparison.spans.map((span) => span.spanId)).toEqual(['root', 'orders-2']);
  });
});

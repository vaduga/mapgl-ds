import {
  type DataQueryRequest,
  type DataQueryResponse,
  DataSourceApi,
  type DataSourceInstanceSettings,
  FieldType,
  MutableDataFrame,
  type TestDataSourceResponse,
} from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';
import {
  aggregateServiceGraphEdges,
  type LinkCostComparison,
  type ParsedTrace,
  parseLinkCostComparisonPayload,
  parseTraceBranchesPayload,
  parseTracePayload,
  type TraceBranchAnalysis,
} from './tempoParser';
import { buildTempoSearchParams } from './tempoSearch';
import {
  resolveTempoDataFrameResultMode,
  type TempoDataFrameJsonData,
  type TempoDataFrameQuery,
  type TempoDataFrameResultMode,
} from './types';
import {
  initializeWasm,
  isWasmReady,
  wasmCompareServiceLinkCost,
  wasmExtractTraceBranches,
} from './wasmBridge';

interface TempoSearchTraceRef {
  readonly traceID?: string;
  readonly traceId?: string;
}

interface TempoSearchResponse {
  readonly traces?: readonly TempoSearchTraceRef[];
}

function extractSearchTraceId(entry: TempoSearchTraceRef): string {
  const id = entry.traceID ?? entry.traceId;
  return typeof id === 'string' ? id.trim() : '';
}

function safeLimit(queryLimit: number | undefined, defaultLimit: number | undefined): number {
  const raw = queryLimit ?? defaultLimit ?? 20;
  return Math.max(1, Math.min(500, Math.floor(raw)));
}

function targetResultMode(target: TempoDataFrameQuery): TempoDataFrameResultMode {
  return resolveTempoDataFrameResultMode(target.resultMode);
}

function ensureWasmReady(): void {
  if (!initializeWasm() || !isWasmReady()) {
    throw new Error('Trace branch analyzer is unavailable');
  }
}

function attributesJson(attributes: Record<string, string>): string {
  try {
    return JSON.stringify(attributes);
  } catch {
    return '{}';
  }
}

function valuesJson(values: readonly string[] | readonly number[]): string {
  try {
    return JSON.stringify(values);
  } catch {
    return '[]';
  }
}

/** Grafana datasource that exposes Tempo trace spans or service graph data frames. */
export class DataSource extends DataSourceApi<TempoDataFrameQuery, TempoDataFrameJsonData> {
  private readonly proxyBaseUrl: string;
  private readonly defaultLimit: number | undefined;

  /** Creates a Tempo DataFrame datasource instance from Grafana settings. */
  constructor(instanceSettings: DataSourceInstanceSettings<TempoDataFrameJsonData>) {
    super(instanceSettings);
    this.proxyBaseUrl = `/api/datasources/proxy/uid/${encodeURIComponent(instanceSettings.uid)}`;
    this.defaultLimit = instanceSettings.jsonData.defaultLimit;
  }

  /** Runs either trace-id lookup or time-range search and returns span or service-graph rows. */
  async query(request: DataQueryRequest<TempoDataFrameQuery>): Promise<DataQueryResponse> {
    const frames: MutableDataFrame[] = [];

    for (const target of request.targets) {
      if (target.hide === true) {
        continue;
      }
      const limit = safeLimit(target.limit, this.defaultLimit);
      const traceIds = await this.resolveTraceIds(target, request, limit);
      const traces = await Promise.all(
        traceIds.map((traceId) => this.fetchTrace(traceId, request)),
      );

      const parsedTraces = traces.filter((trace): trace is ParsedTrace => trace !== null);
      const resultMode = targetResultMode(target);
      if (resultMode === 'traceBranches') {
        frames.push(this.traceBranchesFrame(target.refId, parsedTraces));
      } else if (resultMode === 'linkCostComparison') {
        frames.push(this.linkCostComparisonFrame(target.refId, parsedTraces, target));
      } else {
        frames.push(this.serviceGraphFrame(target.refId, parsedTraces));
      }
    }

    return { data: frames };
  }

  /** Verifies the configured Tempo URL can answer search requests through Grafana proxy. */
  async testDatasource(): Promise<TestDataSourceResponse> {
    try {
      await lastValueFrom(
        getBackendSrv().fetch<TempoSearchResponse>({
          url: `${this.proxyBaseUrl}/api/search`,
          method: 'GET',
          params: {
            start: Math.floor((Date.now() - 5 * 60_000) / 1000),
            end: Math.floor(Date.now() / 1000),
            limit: 1,
          },
          showErrorAlert: false,
        }),
      );
      return { status: 'success', message: 'Tempo search endpoint is reachable' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 'error', message: `Tempo search endpoint failed: ${message}` };
    }
  }

  private async resolveTraceIds(
    target: TempoDataFrameQuery,
    request: DataQueryRequest<TempoDataFrameQuery>,
    limit: number,
  ): Promise<string[]> {
    const traceId = target.traceId?.trim();
    if (traceId !== undefined && traceId.length > 0) {
      return [traceId];
    }

    const response = await lastValueFrom(
      getBackendSrv().fetch<TempoSearchResponse>({
        url: `${this.proxyBaseUrl}/api/search`,
        method: 'GET',
        params: buildTempoSearchParams(
          request.range.from.valueOf(),
          request.range.to.valueOf(),
          limit,
          target.traceQl,
        ),
        showErrorAlert: false,
      }),
    );

    const seen = new Set<string>();
    const ids: string[] = [];
    for (const entry of response.data.traces ?? []) {
      const id = extractSearchTraceId(entry);
      if (id.length > 0 && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
      if (ids.length >= limit) {
        break;
      }
    }
    return ids;
  }

  private async fetchTrace(
    traceId: string,
    request: DataQueryRequest<TempoDataFrameQuery>,
  ): Promise<ParsedTrace | null> {
    try {
      const response = await lastValueFrom(
        getBackendSrv().fetch<unknown>({
          url: `${this.proxyBaseUrl}/api/traces/${encodeURIComponent(traceId)}`,
          method: 'GET',
          params: {
            start: Math.floor(request.range.from.valueOf() / 1000),
            end: Math.floor(request.range.to.valueOf() / 1000),
          },
          headers: {
            Accept: 'application/json',
          },
          showErrorAlert: false,
        }),
      );
      return parseTracePayload(response.data, traceId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[TempoDataFrameDatasource] trace fetch failed:', traceId, message);
      return null;
    }
  }

  private extractTraceBranches(traces: readonly ParsedTrace[]): TraceBranchAnalysis {
    ensureWasmReady();
    return parseTraceBranchesPayload(wasmExtractTraceBranches(JSON.stringify(traces)));
  }

  private compareServiceLinkCost(
    traces: readonly ParsedTrace[],
    source: string,
    target: string,
  ): LinkCostComparison {
    ensureWasmReady();
    return parseLinkCostComparisonPayload(
      wasmCompareServiceLinkCost(JSON.stringify(traces), source, target),
    );
  }

  private serviceGraphFrame(refId: string, traces: readonly ParsedTrace[]): MutableDataFrame {
    const graph = this.extractTraceBranches(traces);
    const edges = aggregateServiceGraphEdges(graph.links);
    const frame = new MutableDataFrame({
      refId,
      name: `${refId}. SDG`,
      meta: {},
      fields: [
        { name: 'type', type: FieldType.string },
        { name: 'source', type: FieldType.string },
        { name: 'target', type: FieldType.string },
        { name: 'spanCount', type: FieldType.number },
        { name: 'errorCount', type: FieldType.number },
        { name: 'errorRate', type: FieldType.number },
        { name: 'linkKey', type: FieldType.string },
        { name: 'branchCount', type: FieldType.number },
        { name: 'occurrenceCount', type: FieldType.number },
        { name: 'totalLinkCost', type: FieldType.number },
        { name: 'minLinkCost', type: FieldType.number },
        { name: 'maxLinkCost', type: FieldType.number },
        { name: 'avgBranchLinkCost', type: FieldType.number },
        { name: 'avgTraversalCost', type: FieldType.number },
      ],
    });

    for (const service of graph.services) {
      frame.add({
        type: 'service',
        source: service.serviceName,
        target: '',
        spanCount: service.spanCount,
        errorCount: service.errorCount,
        errorRate: service.errorRate,
        linkKey: '',
        branchCount: 0,
        occurrenceCount: 0,
        totalLinkCost: 0,
        minLinkCost: 0,
        maxLinkCost: 0,
        avgBranchLinkCost: 0,
        avgTraversalCost: 0,
      });
    }

    for (const edge of edges) {
      frame.add({
        type: 'edge',
        source: edge.source,
        target: edge.target,
        spanCount: 0,
        errorCount: 0,
        errorRate: 0,
        linkKey: edge.linkKey,
        branchCount: edge.branchCount,
        occurrenceCount: edge.occurrenceCount,
        totalLinkCost: edge.totalLinkCost,
        minLinkCost: edge.minLinkCost,
        maxLinkCost: edge.maxLinkCost,
        avgBranchLinkCost: edge.avgBranchLinkCost,
        avgTraversalCost: edge.avgTraversalCost,
      });
    }

    return frame;
  }

  private traceBranchesFrame(refId: string, traces: readonly ParsedTrace[]): MutableDataFrame {
    const graph = this.extractTraceBranches(traces);
    const frame = new MutableDataFrame({
      refId,
      name: `${refId}. Traces`,
      meta: {},
      fields: [
        { name: 'type', type: FieldType.string },
        { name: 'branchId', type: FieldType.string },
        { name: 'traceId', type: FieldType.string },
        { name: 'branchIndex', type: FieldType.number },
        { name: 'linkIndex', type: FieldType.number },
        { name: 'servicePath', type: FieldType.string },
        { name: 'spanIds', type: FieldType.string },
        { name: 'totalCost', type: FieldType.number },
        { name: 'linkKey', type: FieldType.string },
        { name: 'source', type: FieldType.string },
        { name: 'target', type: FieldType.string },
        { name: 'occurrenceCount', type: FieldType.number },
        { name: 'linkCost', type: FieldType.number },
        { name: 'occurrenceCosts', type: FieldType.string },
        { name: 'occurrenceSpanIds', type: FieldType.string },
      ],
    });
    const branchById = new Map(graph.branches.map((branch) => [branch.branchId, branch]));

    for (const link of graph.links) {
      const branch = branchById.get(link.branchId);
      frame.add({
        type: 'branchLink',
        branchId: link.branchId,
        traceId: link.traceId,
        branchIndex: link.branchIndex,
        linkIndex: link.linkIndex,
        servicePath: valuesJson(branch?.servicePath ?? []),
        spanIds: valuesJson(branch?.spanIds ?? []),
        totalCost: branch?.totalCost ?? 0,
        linkKey: link.linkKey,
        source: link.source,
        target: link.target,
        occurrenceCount: link.occurrenceCount,
        linkCost: link.linkCost,
        occurrenceCosts: valuesJson(link.occurrenceCosts),
        occurrenceSpanIds: valuesJson(link.occurrenceSpanIds),
      });
    }

    return frame;
  }

  private linkCostComparisonFrame(
    refId: string,
    traces: readonly ParsedTrace[],
    target: TempoDataFrameQuery,
  ): MutableDataFrame {
    const source = target.source?.trim() ?? '';
    const comparisonTarget = target.target?.trim() ?? '';
    const comparison =
      source.length > 0 && comparisonTarget.length > 0
        ? this.compareServiceLinkCost(traces, source, comparisonTarget)
        : {
            source,
            target: comparisonTarget,
            linkKey: `${source}->${comparisonTarget}`,
            rows: [],
            spans: [],
          };
    const frame = new MutableDataFrame({
      refId,
      name: `${refId} Tempo link cost comparison`,
      meta: {},
      fields: [
        { name: 'type', type: FieldType.string },
        { name: 'comparison', type: FieldType.string },
        { name: 'branchId', type: FieldType.string },
        { name: 'traceId', type: FieldType.string },
        { name: 'branchIndex', type: FieldType.number },
        { name: 'linkIndex', type: FieldType.number },
        { name: 'spanIndex', type: FieldType.number },
        { name: 'linkKey', type: FieldType.string },
        { name: 'source', type: FieldType.string },
        { name: 'target', type: FieldType.string },
        { name: 'occurrenceCount', type: FieldType.number },
        { name: 'linkCost', type: FieldType.number },
        { name: 'occurrenceCosts', type: FieldType.string },
        { name: 'occurrenceSpanIds', type: FieldType.string },
        { name: 'servicePath', type: FieldType.string },
        { name: 'spanIds', type: FieldType.string },
        { name: 'totalCost', type: FieldType.number },
        { name: 'spanId', type: FieldType.string },
        { name: 'parentId', type: FieldType.string },
        { name: 'serviceName', type: FieldType.string },
        { name: 'operationName', type: FieldType.string },
        { name: 'startTime', type: FieldType.time },
        { name: 'duration', type: FieldType.number },
        { name: 'status', type: FieldType.string },
        { name: 'attributes', type: FieldType.string },
      ],
    });

    for (const row of comparison.rows) {
      frame.add({
        type: 'comparison',
        comparison: row.comparison,
        branchId: row.branch.branchId,
        traceId: row.branch.traceId,
        branchIndex: row.branch.branchIndex,
        linkIndex: row.link.linkIndex,
        spanIndex: -1,
        linkKey: row.link.linkKey,
        source: row.link.source,
        target: row.link.target,
        occurrenceCount: row.link.occurrenceCount,
        linkCost: row.link.linkCost,
        occurrenceCosts: valuesJson(row.link.occurrenceCosts),
        occurrenceSpanIds: valuesJson(row.link.occurrenceSpanIds),
        servicePath: valuesJson(row.branch.servicePath),
        spanIds: valuesJson(row.branch.spanIds),
        totalCost: row.branch.totalCost,
        spanId: '',
        parentId: '',
        serviceName: '',
        operationName: '',
        startTime: 0,
        duration: 0,
        status: '',
        attributes: '{}',
      });
    }

    const spansById = new Map(comparison.spans.map((span) => [span.spanId, span]));
    for (const row of comparison.rows) {
      for (const [spanIndex, spanId] of row.branch.spanIds.entries()) {
        const span = spansById.get(spanId);
        if (span === undefined) {
          continue;
        }
        frame.add({
          type: 'span',
          comparison: row.comparison,
          branchId: row.branch.branchId,
          traceId: span.traceId,
          branchIndex: row.branch.branchIndex,
          linkIndex: row.link.linkIndex,
          spanIndex,
          linkKey: row.link.linkKey,
          source: span.spanId,
          target: span.parentId ?? '',
          occurrenceCount: 0,
          linkCost: 0,
          occurrenceCosts: '[]',
          occurrenceSpanIds: '[]',
          servicePath: '[]',
          spanIds: valuesJson([span.spanId]),
          totalCost: row.branch.totalCost,
          spanId: span.spanId,
          parentId: span.parentId ?? '',
          serviceName: span.serviceName,
          operationName: span.operationName,
          startTime: span.startTime,
          duration: span.duration,
          status: span.status,
          attributes: attributesJson(span.attributes),
        });
      }
    }

    return frame;
  }
}

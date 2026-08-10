/** A normalized trace that matches the panel Tempo client shape. */
export interface ParsedTrace {
  readonly id: string;
  readonly spans: readonly ParsedSpan[];
}

/** Service graph shape returned by the shared WASM analyzer. */
export interface ServiceGraph {
  readonly services: readonly string[];
  readonly edges: readonly ServiceGraphEdge[];
}

/** Directed dependency between two services. */
export interface ServiceGraphEdge {
  readonly from: string;
  readonly to: string;
}

/** Service-level metadata returned by the trace branch analyzer. */
export interface BranchServiceNode {
  readonly serviceName: string;
  readonly spanCount: number;
  readonly errorCount: number;
  readonly errorRate: number;
}

/** Trace branch represented as an ordered service and span path. */
export interface TraceBranch {
  readonly branchId: string;
  readonly traceId: string;
  readonly branchIndex: number;
  readonly servicePath: readonly string[];
  readonly spanIds: readonly string[];
  readonly totalCost: number;
}

/** Reduced directed service-link cost for one trace branch. */
export interface TraceBranchLink {
  readonly branchId: string;
  readonly traceId: string;
  readonly branchIndex: number;
  readonly linkIndex: number;
  readonly linkKey: string;
  readonly source: string;
  readonly target: string;
  readonly occurrenceCount: number;
  readonly linkCost: number;
  readonly occurrenceCosts: readonly number[];
  readonly occurrenceSpanIds: readonly string[];
}

/** Structured trace branch analysis returned by WASM. */
export interface TraceBranchAnalysis {
  readonly services: readonly BranchServiceNode[];
  readonly branches: readonly TraceBranch[];
  readonly links: readonly TraceBranchLink[];
}

/** Aggregated interaction metrics for one directed service-to-service edge. */
export interface AggregatedServiceGraphEdge {
  readonly linkKey: string;
  readonly source: string;
  readonly target: string;
  readonly branchCount: number;
  readonly occurrenceCount: number;
  readonly totalLinkCost: number;
  readonly minLinkCost: number;
  readonly maxLinkCost: number;
  readonly avgBranchLinkCost: number;
  readonly avgTraversalCost: number;
}

interface MutableAggregatedServiceGraphEdge {
  readonly linkKey: string;
  readonly source: string;
  readonly target: string;
  readonly branchIds: Set<string>;
  occurrenceCount: number;
  totalLinkCost: number;
  minLinkCost: number;
  maxLinkCost: number;
}

/** Min/max branch-link-cost comparison result returned by WASM. */
export interface LinkCostComparison {
  readonly source: string;
  readonly target: string;
  readonly linkKey: string;
  readonly rows: readonly LinkCostComparisonRow[];
  readonly spans: readonly ParsedSpan[];
}

/** One side of a min/max link-cost comparison. */
export interface LinkCostComparisonRow {
  readonly comparison: 'min' | 'max';
  readonly branch: TraceBranch;
  readonly link: TraceBranchLink;
}

/** A normalized span row parsed from Tempo OTLP JSON. */
export interface ParsedSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentId?: string;
  readonly serviceName: string;
  readonly operationName: string;
  readonly startTime: number;
  readonly duration: number;
  readonly attributes: Record<string, string>;
  readonly status: 'OK' | 'ERROR';
}

function isServiceGraphEdge(value: unknown): value is ServiceGraphEdge {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<ServiceGraphEdge>;
  return typeof candidate.from === 'string' && typeof candidate.to === 'string';
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isNumberArray(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'number');
}

function isBranchServiceNode(value: unknown): value is BranchServiceNode {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<BranchServiceNode>;
  return (
    typeof candidate.serviceName === 'string' &&
    typeof candidate.spanCount === 'number' &&
    typeof candidate.errorCount === 'number' &&
    typeof candidate.errorRate === 'number'
  );
}

function isTraceBranch(value: unknown): value is TraceBranch {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<TraceBranch>;
  return (
    typeof candidate.branchId === 'string' &&
    typeof candidate.traceId === 'string' &&
    typeof candidate.branchIndex === 'number' &&
    isStringArray(candidate.servicePath) &&
    isStringArray(candidate.spanIds) &&
    typeof candidate.totalCost === 'number'
  );
}

function isTraceBranchLink(value: unknown): value is TraceBranchLink {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<TraceBranchLink>;
  return (
    typeof candidate.branchId === 'string' &&
    typeof candidate.traceId === 'string' &&
    typeof candidate.branchIndex === 'number' &&
    typeof candidate.linkIndex === 'number' &&
    typeof candidate.linkKey === 'string' &&
    typeof candidate.source === 'string' &&
    typeof candidate.target === 'string' &&
    typeof candidate.occurrenceCount === 'number' &&
    typeof candidate.linkCost === 'number' &&
    isNumberArray(candidate.occurrenceCosts) &&
    isStringArray(candidate.occurrenceSpanIds)
  );
}

function isParsedSpan(value: unknown): value is ParsedSpan {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<ParsedSpan>;
  return (
    typeof candidate.traceId === 'string' &&
    typeof candidate.spanId === 'string' &&
    typeof candidate.serviceName === 'string' &&
    typeof candidate.operationName === 'string' &&
    typeof candidate.startTime === 'number' &&
    typeof candidate.duration === 'number' &&
    typeof candidate.attributes === 'object' &&
    candidate.attributes !== null &&
    (candidate.status === 'OK' || candidate.status === 'ERROR')
  );
}

function parseJsonObject(payload: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(payload);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('WASM returned a non-object payload');
  }
  const object = parsed as Record<string, unknown>;
  if (typeof object.error === 'string' && object.error.length > 0) {
    throw new Error(object.error);
  }
  return object;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

interface OtlpKeyValue {
  readonly key?: string;
  readonly value?: {
    readonly stringValue?: string;
    readonly intValue?: string | number;
    readonly doubleValue?: number;
    readonly boolValue?: boolean;
  };
}

interface OtlpStatus {
  readonly code?: string | number;
  readonly message?: string;
}

interface OtlpSpan {
  readonly traceId?: string;
  readonly spanId?: string;
  readonly parentSpanId?: string;
  readonly name?: string;
  readonly startTimeUnixNano?: string;
  readonly endTimeUnixNano?: string;
  readonly attributes?: readonly OtlpKeyValue[];
  readonly status?: OtlpStatus;
}

interface OtlpScopeSpan {
  readonly spans?: readonly OtlpSpan[];
}

interface OtlpResourceSpan {
  readonly resource?: { readonly attributes?: readonly OtlpKeyValue[] };
  readonly scopeSpans?: readonly OtlpScopeSpan[];
  readonly instrumentationLibrarySpans?: readonly OtlpScopeSpan[];
}

interface OtlpTracePayload {
  readonly resourceSpans?: readonly OtlpResourceSpan[];
  readonly batches?: readonly OtlpResourceSpan[];
}

function readAttrString(kv: OtlpKeyValue | undefined): string | undefined {
  if (kv?.key === undefined) {
    return undefined;
  }
  const v = kv.value;
  if (v === undefined) {
    return undefined;
  }
  if (v.stringValue !== undefined) {
    return v.stringValue;
  }
  if (v.intValue !== undefined) {
    return String(v.intValue);
  }
  if (v.doubleValue !== undefined) {
    return String(v.doubleValue);
  }
  if (v.boolValue !== undefined) {
    return v.boolValue ? 'true' : 'false';
  }
  return undefined;
}

function serviceNameFromResource(attrs: readonly OtlpKeyValue[] | undefined): string {
  if (attrs === undefined) {
    return 'unknown';
  }
  for (const a of attrs) {
    if (a.key === 'service.name') {
      const s = readAttrString(a);
      if (s !== undefined && s.length > 0) {
        return s;
      }
    }
  }
  return 'unknown';
}

function attributesToRecord(attrs: readonly OtlpKeyValue[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (attrs === undefined) {
    return out;
  }
  for (const a of attrs) {
    if (a.key === undefined) {
      continue;
    }
    const s = readAttrString(a);
    if (s !== undefined) {
      out[a.key] = s;
    }
  }
  return out;
}

function nanoToMs(nanoStr: string | undefined): number {
  if (nanoStr === undefined || nanoStr.length === 0) {
    return 0;
  }
  try {
    return Number(BigInt(nanoStr) / 1_000_000n);
  } catch {
    return 0;
  }
}

function mapOtlpStatus(st: OtlpStatus | undefined): 'OK' | 'ERROR' {
  if (st === undefined) {
    return 'OK';
  }
  const c = st.code;
  if (c === 'STATUS_CODE_ERROR' || c === 2 || c === 'ERROR') {
    return 'ERROR';
  }
  return 'OK';
}

function normalizeId(raw: string | undefined): string {
  if (raw === undefined) {
    return '';
  }
  const t = raw.trim();
  return t.length > 0 ? t : '';
}

/** Converts Tempo OTLP JSON into normalized spans matching the panel parser. */
export function parseTracePayload(payload: unknown, fallbackTraceId: string): ParsedTrace {
  const root = payload as OtlpTracePayload;
  const blocks = root.resourceSpans ?? root.batches ?? [];
  const spans: ParsedSpan[] = [];
  const rootId = fallbackTraceId;

  for (const rs of blocks) {
    const resourceSvc = serviceNameFromResource(rs.resource?.attributes);
    const scopes = rs.scopeSpans ?? rs.instrumentationLibrarySpans ?? [];
    for (const sc of scopes) {
      const list = sc.spans ?? [];
      for (const sp of list) {
        const spanId = normalizeId(sp.spanId);
        if (spanId.length === 0) {
          continue;
        }
        const parentRaw = normalizeId(sp.parentSpanId);
        const parentId = parentRaw.length > 0 ? parentRaw : undefined;
        const startMs = nanoToMs(sp.startTimeUnixNano);
        const endMs = nanoToMs(sp.endTimeUnixNano);
        const duration = Math.max(0, endMs - startMs);
        const traceIdRaw = normalizeId(sp.traceId);
        const traceId = traceIdRaw.length > 0 ? traceIdRaw : rootId;
        const attributes = attributesToRecord(sp.attributes);
        const spanSvc = attributes['service.name'] ?? attributes['peer.service'];
        const serviceName = spanSvc !== undefined && spanSvc.length > 0 ? spanSvc : resourceSvc;

        spans.push({
          traceId,
          spanId,
          parentId,
          serviceName,
          operationName: sp.name ?? 'unknown',
          startTime: startMs,
          duration,
          attributes,
          status: mapOtlpStatus(sp.status),
        });
      }
    }
  }

  return {
    id: rootId,
    spans,
  };
}

/** Parses WASM service graph JSON and normalizes ordering for stable DataFrame rows. */
export function parseServiceGraphPayload(payload: string): ServiceGraph {
  try {
    const parsed = JSON.parse(payload) as { services?: unknown; edges?: unknown };
    const services = Array.isArray(parsed.services)
      ? uniqueSorted(
          parsed.services.filter((service): service is string => typeof service === 'string'),
        )
      : [];
    const edges = Array.isArray(parsed.edges)
      ? parsed.edges.filter(isServiceGraphEdge).sort((a, b) => {
          const from = a.from.localeCompare(b.from);
          return from === 0 ? a.to.localeCompare(b.to) : from;
        })
      : [];
    return { services, edges };
  } catch {
    return { services: [], edges: [] };
  }
}

/** Parses WASM trace branch JSON and rejects malformed or error payloads. */
export function parseTraceBranchesPayload(payload: string): TraceBranchAnalysis {
  const parsed = parseJsonObject(payload);
  const services = Array.isArray(parsed.services)
    ? parsed.services.filter(isBranchServiceNode).sort((a, b) => {
        return a.serviceName.localeCompare(b.serviceName);
      })
    : [];
  const branches = Array.isArray(parsed.branches)
    ? parsed.branches.filter(isTraceBranch).sort((a, b) => {
        return a.branchId.localeCompare(b.branchId);
      })
    : [];
  const links = Array.isArray(parsed.links)
    ? parsed.links.filter(isTraceBranchLink).sort((a, b) => {
        const branch = a.branchId.localeCompare(b.branchId);
        return branch === 0 ? a.linkIndex - b.linkIndex : branch;
      })
    : [];
  return { services, branches, links };
}

/** Parses WASM link comparison JSON and rejects malformed or error payloads. */
export function parseLinkCostComparisonPayload(payload: string): LinkCostComparison {
  const parsed = parseJsonObject(payload);
  const source = typeof parsed.source === 'string' ? parsed.source : '';
  const target = typeof parsed.target === 'string' ? parsed.target : '';
  const linkKey = typeof parsed.linkKey === 'string' ? parsed.linkKey : `${source}->${target}`;
  const rows = Array.isArray(parsed.rows)
    ? parsed.rows
        .filter((row): row is LinkCostComparisonRow => {
          if (typeof row !== 'object' || row === null) {
            return false;
          }
          const candidate = row as Partial<LinkCostComparisonRow>;
          return (
            (candidate.comparison === 'min' || candidate.comparison === 'max') &&
            isTraceBranch(candidate.branch) &&
            isTraceBranchLink(candidate.link)
          );
        })
        .sort((a, b) => {
          const rank = { min: 0, max: 1 };
          return rank[a.comparison] - rank[b.comparison];
        })
    : [];
  const spans = Array.isArray(parsed.spans) ? parsed.spans.filter(isParsedSpan) : [];

  return { source, target, linkKey, rows, spans };
}

/** Aggregates branch links into directed service-to-service graph edges. */
export function aggregateServiceGraphEdges(
  links: readonly TraceBranchLink[],
): AggregatedServiceGraphEdge[] {
  const aggregates = new Map<string, MutableAggregatedServiceGraphEdge>();

  for (const link of links) {
    const existing = aggregates.get(link.linkKey);
    if (existing === undefined) {
      aggregates.set(link.linkKey, {
        linkKey: link.linkKey,
        source: link.source,
        target: link.target,
        branchIds: new Set([link.branchId]),
        occurrenceCount: link.occurrenceCount,
        totalLinkCost: link.linkCost,
        minLinkCost: link.linkCost,
        maxLinkCost: link.linkCost,
      });
      continue;
    }

    existing.branchIds.add(link.branchId);
    existing.occurrenceCount += link.occurrenceCount;
    existing.totalLinkCost += link.linkCost;
    existing.minLinkCost = Math.min(existing.minLinkCost, link.linkCost);
    existing.maxLinkCost = Math.max(existing.maxLinkCost, link.linkCost);
  }

  return [...aggregates.values()]
    .map((aggregate) => {
      const branchCount = aggregate.branchIds.size;
      return {
        linkKey: aggregate.linkKey,
        source: aggregate.source,
        target: aggregate.target,
        branchCount,
        occurrenceCount: aggregate.occurrenceCount,
        totalLinkCost: aggregate.totalLinkCost,
        minLinkCost: aggregate.minLinkCost,
        maxLinkCost: aggregate.maxLinkCost,
        avgBranchLinkCost: branchCount > 0 ? aggregate.totalLinkCost / branchCount : 0,
        avgTraversalCost:
          aggregate.occurrenceCount > 0 ? aggregate.totalLinkCost / aggregate.occurrenceCount : 0,
      };
    })
    .sort((left, right) => {
      const source = left.source.localeCompare(right.source);
      return source === 0 ? left.target.localeCompare(right.target) : source;
    });
}

/** TypeScript fallback that mirrors the WASM core `extract_service_graph`. */
export function extractServiceGraphFallback(traces: readonly ParsedTrace[]): ServiceGraph {
  const services = new Set<string>();
  const edgeKeys = new Set<string>();
  const edges: ServiceGraphEdge[] = [];

  for (const trace of traces) {
    const spanById = new Map(trace.spans.map((span) => [span.spanId, span]));
    for (const span of trace.spans) {
      services.add(span.serviceName);
      if (span.parentId === undefined) {
        continue;
      }
      const parent = spanById.get(span.parentId);
      if (parent === undefined || parent.serviceName === span.serviceName) {
        continue;
      }
      const key = `${parent.serviceName}\u0000${span.serviceName}`;
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        edges.push({ from: parent.serviceName, to: span.serviceName });
      }
    }
  }

  return {
    services: uniqueSorted(services),
    edges: edges.sort((a, b) => {
      const from = a.from.localeCompare(b.from);
      return from === 0 ? a.to.localeCompare(b.to) : from;
    }),
  };
}

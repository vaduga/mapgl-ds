/** Parameters accepted by Tempo's trace search endpoint. */
export interface TempoSearchParams {
  readonly start: number;
  readonly end: number;
  readonly limit: number;
  readonly q?: string;
}

/** Builds Tempo search parameters, adding TraceQL only when a query is provided. */
export function buildTempoSearchParams(
  startMillis: number,
  endMillis: number,
  limit: number,
  traceQl: string | undefined,
): TempoSearchParams {
  const trimmedTraceQl = traceQl?.trim();
  const params: TempoSearchParams = {
    start: Math.floor(startMillis / 1000),
    end: Math.floor(endMillis / 1000),
    limit,
  };

  return trimmedTraceQl !== undefined && trimmedTraceQl.length > 0
    ? { ...params, q: trimmedTraceQl }
    : params;
}

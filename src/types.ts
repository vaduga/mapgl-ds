import type { DataQuery, DataSourceJsonData } from '@grafana/data';

/** Datasource query output mode. */
export type TempoDataFrameResultMode = 'serviceGraph' | 'traceBranches' | 'linkCostComparison';

/** Returns whether a runtime value is a supported query output mode. */
export function isTempoDataFrameResultMode(value: unknown): value is TempoDataFrameResultMode {
  return value === 'serviceGraph' || value === 'traceBranches' || value === 'linkCostComparison';
}

/** Resolves persisted query state to a supported query output mode. */
export function resolveTempoDataFrameResultMode(value: unknown): TempoDataFrameResultMode {
  return isTempoDataFrameResultMode(value) ? value : 'serviceGraph';
}

/** Query options for the Tempo DataFrames  datasource. */
export interface TempoDataFrameQuery extends DataQuery {
  readonly traceId?: string;
  readonly traceQl?: string;
  readonly limit?: number;
  readonly resultMode?: TempoDataFrameResultMode;
  readonly source?: string;
  readonly target?: string;
}

/** Datasource-level options stored by Grafana. */
export interface TempoDataFrameJsonData extends DataSourceJsonData {
  readonly defaultLimit?: number;
}

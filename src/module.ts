import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor, QueryEditor } from './components/QueryEditor';
import { DataSource } from './DataSource';
import type { TempoDataFrameJsonData, TempoDataFrameQuery } from './types';

/** Grafana plugin entrypoint for the Tempo DataFrames datasource. */
export const plugin = new DataSourcePlugin<DataSource, TempoDataFrameQuery, TempoDataFrameJsonData>(
  DataSource,
)
  .setQueryEditor(QueryEditor)
  .setConfigEditor(ConfigEditor);

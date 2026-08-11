import type { DataSourcePluginOptionsEditorProps, QueryEditorProps } from '@grafana/data';
import { InlineField, Input, Select, Stack } from '@grafana/ui';
import React from 'react';
import type { DataSource } from '../DataSource';
import {
  resolveTempoDataFrameResultMode,
  type TempoDataFrameJsonData,
  type TempoDataFrameQuery,
  type TempoDataFrameResultMode,
} from '../types';

interface Props extends QueryEditorProps<DataSource, TempoDataFrameQuery, TempoDataFrameJsonData> {}

const resultModeOptions: Array<{
  readonly label: string;
  readonly value: TempoDataFrameResultMode;
}> = [
  { label: 'Service graph', value: 'serviceGraph' },
  { label: 'Trace branches', value: 'traceBranches' },
  { label: 'Links comparison', value: 'linkCostComparison' },
];

/** Query editor for selecting a Tempo trace id or time-range search limit. */
export const QueryEditor: React.FC<Props> = ({ query, onChange, onRunQuery }) => {
  const onTraceIdChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    onChange({ ...query, traceId: event.currentTarget.value });
  };

  const onTraceQlChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    onChange({ ...query, traceQl: event.currentTarget.value });
  };

  const onLimitChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const parsed = Number(event.currentTarget.value);
    onChange({ ...query, limit: Number.isFinite(parsed) ? parsed : undefined });
  };

  const onResultModeChange = (
    option: { readonly value?: TempoDataFrameResultMode } | null,
  ): void => {
    onChange({ ...query, resultMode: option?.value ?? 'serviceGraph' });
    onRunQuery();
  };

  const onSourceChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    onChange({ ...query, source: event.currentTarget.value });
  };

  const onTargetChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    onChange({ ...query, target: event.currentTarget.value });
  };

  const resultMode = resolveTempoDataFrameResultMode(query.resultMode);

  return (
    <Stack gap={1} wrap="wrap">
      <InlineField label="Mode">
        <Select
          width={24}
          options={resultModeOptions}
          value={resultMode}
          onChange={onResultModeChange}
        />
      </InlineField>
      <InlineField label="Trace ID" tooltip="Leave empty to search Tempo by dashboard time range.">
        <Input
          width={48}
          value={query.traceId ?? ''}
          placeholder="optional Tempo trace id"
          onChange={onTraceIdChange}
          onBlur={onRunQuery}
        />
      </InlineField>
      <InlineField
        label="TraceQL"
        tooltip="Filters Tempo search before matching traces are fetched."
      >
        <Input
          width={64}
          value={query.traceQl ?? ''}
          placeholder="{ status = error }"
          onChange={onTraceQlChange}
          onBlur={onRunQuery}
        />
      </InlineField>
      {resultMode === 'linkCostComparison' && (
        <>
          <InlineField label="Source" tooltip="Directed service-link source.">
            <Input
              width={24}
              value={query.source ?? ''}
              placeholder="gateway"
              onChange={onSourceChange}
              onBlur={onRunQuery}
            />
          </InlineField>
          <InlineField label="Target" tooltip="Directed service-link target.">
            <Input
              width={24}
              value={query.target ?? ''}
              placeholder="orders"
              onChange={onTargetChange}
              onBlur={onRunQuery}
            />
          </InlineField>
        </>
      )}
      <InlineField label="Limit">
        <Input
          width={12}
          type="number"
          min={1}
          max={500}
          value={query.limit ?? ''}
          placeholder="20"
          onChange={onLimitChange}
          onBlur={onRunQuery}
        />
      </InlineField>
    </Stack>
  );
};

interface ConfigEditorProps extends DataSourcePluginOptionsEditorProps<TempoDataFrameJsonData> {}

/** Config editor for datasource defaults. */
export const ConfigEditor: React.FC<ConfigEditorProps> = ({ options, onOptionsChange }) => {
  const onDefaultLimitChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const parsed = Number(event.currentTarget.value);
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        defaultLimit: Number.isFinite(parsed) ? parsed : undefined,
      },
    });
  };

  return (
    <InlineField label="Default limit" tooltip="Used when a query does not specify a limit.">
      <Input
        width={12}
        type="number"
        min={1}
        max={500}
        value={options.jsonData.defaultLimit ?? ''}
        placeholder="20"
        onChange={onDefaultLimitChange}
      />
    </InlineField>
  );
};

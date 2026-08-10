import {
  initSync,
  compare_service_link_cost as wasmCompareServiceLinkCost,
  extract_service_graph as wasmExtractServiceGraph,
  extract_trace_branches as wasmExtractTraceBranches,
} from '../agent-core/pkg/agent_core';
import wasmDataUrl from '../agent-core/pkg/agent_core_bg.wasm';

let initialized = false;

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** Initializes the shared analysis WASM bundle for datasource-side graph extraction. */
export function initializeWasm(): boolean {
  if (initialized) {
    return true;
  }

  try {
    initSync({ module: dataUrlToBytes(wasmDataUrl as unknown as string) });
    initialized = true;
    return true;
  } catch (error: unknown) {
    console.error('[TempoDataFrameDatasource] WASM init failed:', error);
    return false;
  }
}

/** Returns whether the analysis WASM module is ready for calls. */
export function isWasmReady(): boolean {
  return initialized;
}

export { wasmCompareServiceLinkCost, wasmExtractServiceGraph, wasmExtractTraceBranches };

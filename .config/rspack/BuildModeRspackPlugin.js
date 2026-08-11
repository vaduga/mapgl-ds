/* This file mirrors configuration scaffolded by @grafana/create-plugin. */

import { Compilation } from '@rspack/core';

const PLUGIN_NAME = 'BuildModeRspackPlugin';

export class BuildModeRspackPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        (assets) => {
          const asset = assets['plugin.json'];
          if (!asset) {
            return;
          }

          const manifest = JSON.parse(asset.source().toString());
          compilation.updateAsset(
            'plugin.json',
            new compiler.rspack.sources.RawSource(
              JSON.stringify({ ...manifest, buildMode: compilation.options.mode }, null, 2),
            ),
          );
        },
      );
    });
  }
}

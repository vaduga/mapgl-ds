/* This file mirrors configuration scaffolded by @grafana/create-plugin. */

import webpack from 'webpack';

const PLUGIN_NAME = 'BuildModeWebpackPlugin';

export class BuildModeWebpackPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        () => {
          const asset = compilation.getAsset('plugin.json');
          if (!asset) {
            return;
          }

          const manifest = JSON.parse(asset.source.source().toString());
          compilation.updateAsset(
            'plugin.json',
            new webpack.sources.RawSource(
              JSON.stringify({ ...manifest, buildMode: compilation.options.mode }, null, 2),
            ),
          );
        },
      );
    });
  }
}

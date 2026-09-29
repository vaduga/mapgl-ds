import path from 'node:path';

import grafanaConfig from './.config/webpack/webpack.config.ts';

/** @type {(env?: Record<string, unknown>) => import('webpack').Configuration} */
export default function config(env = {}) {
  const baseConfig = grafanaConfig(env);

  return {
    ...baseConfig,
    resolve: {
      ...baseConfig.resolve,
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
      },
    },
    module: {
      ...baseConfig.module,
      rules: [
        ...(baseConfig.module?.rules ?? []),
        {
          // Keep Webpack behavior identical to the synchronous WASM Rspack bridge.
          test: /\.wasm$/,
          type: 'asset/inline',
        },
      ],
    },
  };
}

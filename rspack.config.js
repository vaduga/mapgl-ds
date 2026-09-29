import path from 'node:path';

import grafanaConfig from './.config/rspack/rspack.config.ts';

/** @type {(env?: Record<string, unknown>) => import('@rspack/core').Configuration} */
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
          // The bridge synchronously initializes wasm-bindgen from an inlined data URL.
          test: /\.wasm$/,
          type: 'asset/inline',
        },
      ],
    },
  };
}

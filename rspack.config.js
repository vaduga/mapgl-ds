import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rspack from '@rspack/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PLUGIN_ID = 'vaduga-mapgl-datasource';

/** @type {import('@rspack/core').Configuration} */
export default {
  mode: 'production',
  // Production plugin artifacts are distributed without source maps to avoid exposing internals.
  devtool: false,
  entry: {
    module: './src/module.ts',
  },
  output: {
    filename: 'module.js',
    path: path.resolve(__dirname, `dist/${PLUGIN_ID}`),
    library: {
      // Anonymous AMD — Grafana loads plugins via its own AMD loader
      type: 'amd',
    },
    clean: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                },
                transform: {
                  react: {
                    runtime: 'automatic',
                  },
                },
                target: 'es2020',
              },
            },
          },
        ],
      },
      {
        // Inline the shared analysis WASM so the frontend datasource can run graph extraction.
        test: /\.wasm$/,
        type: 'asset/inline',
      },
    ],
  },
  // Output is always AMD for Grafana's plugin loader — only the `amd` key matters.
  externals: {
    react: { amd: 'react' },
    'react-dom': { amd: 'react-dom' },
    '@grafana/data': { amd: '@grafana/data' },
    '@grafana/ui': { amd: '@grafana/ui' },
    '@grafana/runtime': { amd: '@grafana/runtime' },
    '@emotion/css': { amd: '@emotion/css' },
    rxjs: { amd: 'rxjs' },
  },
  plugins: [
    new rspack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: 'plugin.json', to: '.' },
        { from: 'README.md', to: '.' },
        { from: 'src/img', to: 'img', noErrorOnMissing: true },
      ],
    }),
    {
      apply(compiler) {
        const tag = '[TS]';
        const ts = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
        compiler.hooks.watchRun.tap('DevTimestamp', () => {
          console.log(`${ts()} ${tag} Compiling...`);
        });
        compiler.hooks.done.tap('DevTimestamp', (stats) => {
          const info = stats.toJson({ errors: true, warnings: true, timings: true });
          const ms = info.time ?? 0;
          const errs = info.errors?.length ?? 0;
          const warns = info.warnings?.length ?? 0;
          const status = errs > 0 ? `\x1b[31m${errs} error(s)\x1b[0m` : '\x1b[32mOK\x1b[0m';
          console.log(
            `${ts()} ${tag} Compiled in ${ms}ms — ${status}${warns > 0 ? `, ${warns} warning(s)` : ''}`,
          );
        });
      },
    },
  ],
  optimization: {
    minimize: true,
  },
  stats: 'errors-warnings',
};

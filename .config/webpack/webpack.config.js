/* This file mirrors configuration scaffolded by @grafana/create-plugin. */

import path from 'node:path';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';

import { DIST_DIR, SOURCE_DIR } from '../bundler/constants.js';
import { copyFilePatterns } from '../bundler/copyFiles.js';
import { externals } from '../bundler/externals.js';
import { getCreatePluginVersion, getPluginJson } from '../bundler/utils.js';
import { BuildModeWebpackPlugin } from './BuildModeWebpackPlugin.js';

const pluginJson = getPluginJson();

export default function grafanaWebpackConfig(env = {}) {
  const production = env.production !== false;

  return {
    context: path.resolve(process.cwd(), SOURCE_DIR),
    mode: production ? 'production' : 'development',
    devtool: production ? false : 'eval-source-map',
    entry: { module: './module.ts' },
    output: {
      clean: false,
      filename: '[name].js',
      path: path.resolve(process.cwd(), DIST_DIR),
      publicPath: `public/plugins/${pluginJson.id}/`,
      uniqueName: pluginJson.id,
      library: { type: 'amd' },
    },
    externals,
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.[tj]sx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'swc-loader',
            options: {
              jsc: {
                parser: { syntax: 'typescript', tsx: true },
                transform: { react: { runtime: 'automatic' } },
                target: 'es2020',
              },
            },
          },
        },
      ],
    },
    plugins: [
      new BuildModeWebpackPlugin(),
      new webpack.BannerPlugin({
        banner: `/* [create-plugin] version: ${getCreatePluginVersion()} */`,
        raw: true,
        entryOnly: true,
      }),
      new CopyWebpackPlugin({ patterns: copyFilePatterns }),
    ],
    optimization: {
      minimize: production,
      minimizer: production
        ? [
            new TerserPlugin({
              extractComments: false,
              terserOptions: {
                format: {
                  preamble: `/* [create-plugin] version: ${getCreatePluginVersion()} */`,
                },
              },
            }),
          ]
        : [],
    },
    stats: 'errors-warnings',
  };
}

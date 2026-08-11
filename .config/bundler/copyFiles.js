/* This file mirrors configuration scaffolded by @grafana/create-plugin. */

import { getPluginJson, hasSourceReadme } from './utils.js';

const pluginJson = getPluginJson();
const logoPaths = Array.from(
  new Set([pluginJson.info?.logos?.large, pluginJson.info?.logos?.small].filter(Boolean)),
);
const screenshotPaths = pluginJson.info?.screenshots?.map(({ path }) => path) ?? [];

export const copyFilePatterns = [
  { from: 'src/plugin.json', to: 'plugin.json', context: process.cwd() },
  {
    from: hasSourceReadme() ? 'src/README.md' : 'README.md',
    to: 'README.md',
    context: process.cwd(),
  },
  { from: 'LICENSE', to: '.', context: process.cwd() },
  { from: 'CHANGELOG.md', to: '.', context: process.cwd() },
  ...logoPaths.map((assetPath) => ({
    from: `src/${assetPath}`,
    to: assetPath,
    context: process.cwd(),
  })),
  ...screenshotPaths.map((assetPath) => ({
    from: `src/${assetPath}`,
    to: assetPath,
    context: process.cwd(),
  })),
];

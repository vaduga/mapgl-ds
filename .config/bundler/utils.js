/* This file mirrors configuration scaffolded by @grafana/create-plugin. */

import fs from 'node:fs';
import path from 'node:path';

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function getPackageJson() {
  return loadJson(path.resolve(process.cwd(), 'package.json'));
}

export function getPluginJson() {
  return loadJson(path.resolve(process.cwd(), 'plugin.json'));
}

export function getCreatePluginVersion() {
  const configPath = path.resolve(process.cwd(), '.config/.cprc.json');
  return fs.existsSync(configPath) ? loadJson(configPath).version : 'unknown';
}

export function hasSourceReadme() {
  return fs.existsSync(path.resolve(process.cwd(), 'src/README.md'));
}

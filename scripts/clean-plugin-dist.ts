import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve(import.meta.dirname, '../dist/vaduga-mapgl-datasource');

await mkdir(outDir, { recursive: true });
const entries = await readdir(outDir, { withFileTypes: true });
await Promise.all(
  entries.map((e) => rm(path.join(outDir, e.name), { recursive: true, force: true })),
);

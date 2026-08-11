import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve(import.meta.dirname, '../dist/vaduga-mapgl-datasource');

await mkdir(outDir, { recursive: true });
const entries = await readdir(outDir, { withFileTypes: true });
await Promise.all(
  entries.map((entry) => rm(path.join(outDir, entry.name), { recursive: true, force: true })),
);

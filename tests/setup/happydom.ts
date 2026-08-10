// DOM environment setup for bun test using happy-dom.
// Loaded via bunfig.toml [test].preload before any test files run.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

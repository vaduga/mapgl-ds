# AI Coding Standards

This file defines coding standards for assistants working in this repository.
Keep project guidance aligned with the code and the documents listed below.

## Project Context

- **Project**: Mapgl Traces, a Grafana frontend datasource for Tempo traces.
- **Plugin type**: Datasource. It queries Tempo through Grafana's datasource proxy, normalizes traces internally, and returns service graph, trace branch, and directed link comparison DataFrames.
- **Integration**: The separate Mapgl panel can visualize service graph results. This repository does not implement that panel, an AI root-cause agent, or a Grafana backend plugin.
- **Architecture**: React 18 and TypeScript use Grafana's datasource APIs. The Rust crate in `wasm-core` provides trace and graph analysis through WebAssembly; TypeScript parsing and fallback behavior live in `src/`.
- **Build**: Webpack emits the Grafana AMD bundle to `dist/` using the standard `@grafana/create-plugin` configuration. The generated WASM glue and binary are checked in, so `npm run build` does not require Rust. `npm run build:wasm` regenerates those files after Rust changes. Rspack remains available for the frontend development watcher.
- **Package manager**: npm. Rust tooling is optional for ordinary builds and is prepared with `npm run setup:rust` when needed.
- **Docs**: `docs/PRD.md` describes scope, `docs/ARCHITECTURE.md` describes runtime and data flow, and `docs/ROADMAP.md` tracks planned work.

## Repository Layout

- `src/DataSource.ts`: Tempo requests and Grafana DataFrame creation.
- `src/tempoSearch.ts` and `src/tempoParser.ts`: Tempo search parameters and trace parsing.
- `src/components/QueryEditor.tsx`: datasource query and configuration editors.
- `src/types.ts`: query and datasource settings types.
- `src/wasmBridge.ts`: TypeScript boundary to the generated WASM module.
- `wasm-core/src/`: Rust trace, branch, and service graph analysis.
- `wasm-core/pkg/`: generated WASM glue and binary used by the default build.
- `tests/unit/`: Jest unit tests; `e2e/`: Playwright tests.
- `otel-mock/`: local synthetic trace generator used by Docker Compose.
- `docs/`: current product, architecture, roadmap, and integration notes.

Add code beside the existing feature it supports. Do not assume scaffold folders such as `src/services/`, `src/utils/`, or `tests/fixtures/` exist.

## Common Commands

```bash
npm run setup          # install JavaScript dependencies
npm run build          # build with the checked-in WASM artifact; no Rust required
npm run build:wasm     # regenerate WASM after Rust changes; requires Rust and wasm-pack
npm run test           # Jest and agent-core Rust tests
npm run lint           # Biome plus Rust clippy and formatting checks
npm run typecheck      # TypeScript type check
npm run verify         # lint, typecheck, tests, and Webpack build
npm run e2e            # Playwright tests against the local Grafana stack
```

`npm run verify` and `npm run e2e` require their respective Rust and Docker/browser tooling. For a catalog reviewer, `npm ci`, `npm run build`, and the Docker stack are sufficient to build and explore the plugin.

## Language and Style

- Git commit messages, code comments, and user-facing documentation are in English.
- Comments explain why a choice exists; do not restate the code.
- Keep changes focused and follow the existing Grafana datasource patterns.
- Prefer named exports. Use `camelCase` for values and functions and `PascalCase` for types and components.

## TypeScript

- Never use `any`; accept external JSON as `unknown` and validate it before use.
- Do not use `@ts-ignore` or `@ts-expect-error` without a comment explaining the reason.
- Give exported functions and components explicit return types and document public APIs with JSDoc.
- Prefer interfaces for object shapes and type aliases for unions or composed types. Use `readonly` for immutable properties.
- React components follow the existing `React.FC<Props>` style.
- Send Tempo requests through Grafana's datasource proxy. Do not call Tempo directly from the browser.
- The current query modes are `serviceGraph`, `traceBranches`, and `linkCostComparison`. Preserve the implementation contract in `src/types.ts` and `src/DataSource.ts`, and update the docs when it changes.
- Handle request and parsing errors explicitly; do not silently discard failures.

## Rust and WASM

- The Cargo workspace contains `wasm-core` and `otel-mock`; plugin analysis changes usually belong in the `agent-core` crate under `wasm-core/`.
- Do not use `.unwrap()` in library code. Prefer `Result`, `?`, and useful error context.
- The workspace denies unsafe Rust. If unsafe code becomes necessary, include a `// SAFETY:` explanation and revisit the workspace lint policy.
- Document public Rust items with rustdoc comments. Use `pub(crate)` when an item is not part of the crate API.
- Run `cargo fmt -p agent-core` and `cargo clippy -p agent-core -- -D warnings` for Rust changes.
- The TypeScript/WASM boundary uses JSON strings. Preserve initialization handling, output parsing, and the TypeScript fallback behavior when changing it.
- After changing Rust analysis code, run `npm run build:wasm` and include the updated generated glue and `.wasm` binary.

## Tests and Verification

- Add behavior-focused tests for new functionality. Put frontend unit tests in `tests/unit/`, Playwright tests in `e2e/`, and Rust unit tests alongside their modules in `wasm-core/src/`.
- Run the relevant test for the changed area. Before creating a commit, run `npm run verify`; it includes Rust checks and requires the Rust toolchain.
- Keep the checked-in WASM output current. CI rebuilds it and checks that the generated glue in `wasm-core/pkg/agent_core.js` is current; include the generated `.wasm` binary whenever Rust analysis changes.

## Review Checklist

- The change fits a frontend Tempo datasource and its DataFrame contract; it does not introduce panel UI or backend behavior into this plugin.
- No `any`, swallowed errors, unhandled promise rejections, or hardcoded secrets.
- Rust changes pass the configured clippy and formatting checks and do not add unsafe code.
- Async datasource paths have clear failure behavior, and changes have focused tests where useful.
- Documentation describes the current Tempo trace and service graph scope.

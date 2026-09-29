# Mapgl Tempo DataFrames Datasource

Grafana frontend datasource for Tempo traces to render on a service dependency graph using Mapgl panel plugin.

For a repeatable catalog review, see [REVIEW.md](./REVIEW.md).

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer with npm
- Docker (for local Grafana)

The generated WASM module is included in the repository, so building and
reviewing the plugin does not require Rust.

## Development setup

```bash
git clone https://github.com/vaduga/mapgl-ds.git
cd mapgl-ds

# Installs JavaScript dependencies only.
npm run setup

# Build the plugin using the checked-in WASM module.
npm run build

# Start the local Grafana and Tempo stack
docker compose up -d
```

Open <http://localhost:3000> after the containers start.

To change the Rust analysis engine, install Rust stable through
[rustup](https://rustup.rs/), then add the WASM build tools and regenerate the
checked-in files:

```bash
npm run setup:rust
npm run build:wasm
```

The demo emits synthetic traces every five seconds and keeps Tempo data in the
`tempo-data` Docker volume for up to 24 hours. To reset the demo data completely:

```bash
docker compose down -v
```

## Development workflow

```bash
# Watch TypeScript and Rust sources (requires `npm run setup:rust`)
npm run dev

# Watch the frontend only
npm run dev:ts

# Watch the Rust WASM crate only (requires `npm run setup:rust`)
npm run dev:rust

# Build the production Rspack bundle using the checked-in WASM module
npm run build

# Build the frontend with Rspack only
npm run build:rspack

# Regenerate WASM after changing Rust (requires `npm run setup:rust`)
npm run build:wasm

# Run Jest and Cargo tests
npm run test

# Run the TypeScript compiler without emitting files
npm run typecheck

# Watch frontend tests
npm run test:watch

# Start the complete local demo stack
npm run server

# Run the Grafana Playwright smoke tests against the local stack
npm run e2e
```

## Code quality

```bash
# Check TypeScript and Rust
npm run lint

# Apply safe lint fixes
npm run lint:fix

# Format TypeScript and Rust
npm run format

# Check formatting without modifying files
npm run format:check

# Run lint, type checking, tests, and the production Rspack build
npm run verify
```

CI builds the frontend with Rspack through `npm run verify`, then runs the E2E
suite against Grafana 11.6 and the current demo version.

## Packaging and signing

```bash
# Build a catalog-compatible ZIP archive in dist/
npm run package

# Sign the built plugin when GRAFANA_ACCESS_POLICY_TOKEN is available
npm run sign
```

Tag releases must match the versions in `package.json` and `src/plugin.json`.
Use `npm run bump -- patch`, `minor`, `major`, or an explicit semantic version
before creating a release tag.

### TypeScript

- Biome enforces linting and formatting.
- TypeScript uses strict mode; do not introduce `any`.
- Public functions and React components require explicit return types.

### Rust

- `cargo clippy --workspace -- -D warnings` must pass without warnings.
- `cargo fmt` is required.
- Library code must propagate errors instead of using `.unwrap()` or `.expect()`.

## Pull requests

1. Create a feature branch from `main`.
2. Use English commit messages.
3. Run `npm run verify` before submitting.
4. Include a focused description of the change.
5. Review and accept the terms in [CONTRIBUTING.md](./CONTRIBUTING.md).

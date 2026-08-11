# Mapgl Tempo DataFrames Datasource

Grafana frontend datasource for querying Tempo traces and returning trace and service-graph DataFrames for the Mapgl panel.

For a repeatable catalog review, see [REVIEW.md](./REVIEW.md).

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer with npm
- [Rust toolchain](https://rustup.rs/) installed with `rustup` (the default toolchain includes `rustc` and `cargo`)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/) — installed automatically by `npm run setup`
- Docker (for local Grafana)

## Development setup

```bash
git clone https://github.com/vaduga/mapgl-ds.git
cd mapgl-ds

# Installs the wasm32 target, wasm-pack, cargo-watch, and JS dependencies,
# then builds the WASM package.
npm run setup

# Build the plugin
npm run build

# Start the local Grafana and Tempo stack
docker compose up -d
```

Open <http://localhost:3000> after the containers start.

The demo emits synthetic traces every five seconds and keeps Tempo data in the
`tempo-data` Docker volume for up to 24 hours. To reset the demo data completely:

```bash
docker compose down -v
```

## Development workflow

```bash
# Watch the TypeScript and Rust sources
npm run dev

# Watch the frontend only
npm run dev:ts

# Watch the Rust WASM crate only
npm run dev:rust

# Build the WASM package and production Rspack bundle
npm run build

# Build the frontend with Rspack only
npm run build:rspack

# Build the frontend with the validator-compatible Webpack config
npm run build:webpack

# Build the WASM package only
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

CI additionally builds the frontend through `webpack.config.js` for scaffold and
validator compatibility, then runs the E2E suite against Grafana 11.6 and the
current demo version.

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

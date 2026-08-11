# Mapgl Tempo DataFrames Datasource

Grafana frontend datasource for querying Tempo traces and returning trace and service-graph DataFrames for the Mapgl panel.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer with npm
- [Rust toolchain](https://rustup.rs/) (`rustup`, including `cargo`)
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

# Watch frontend tests
npm run test:watch
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

# Run lint, tests, and the production frontend build
npm run verify
```

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

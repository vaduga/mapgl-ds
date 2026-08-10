# Contributing to OAP

## Prerequisites

- [bun](https://bun.sh/) (latest)
- [Rust toolchain](https://rustup.rs/) (`rustup`)
- Docker (for local Grafana)

## Development Setup

```bash
git clone https://github.com/andeya/grafana-observability-agent-panel.git
cd grafana-observability-agent-panel

# One-command setup: installs wasm32 target, wasm-pack, cargo-watch, JS deps, and builds WASM
bun run setup

# Build plugin
bun run build

# Start local Grafana stack
docker compose up -d
# Open http://localhost:3000 → Create dashboard → Add Panel → Observability Agent Panel
```

## Development Workflow

```bash
# Watch mode (auto-rebuild TS + Rust on file changes)
bun run dev

# Watch frontend only
bun run dev:ts

# Watch Rust only
bun run dev:rust

# Build everything (TypeScript + WASM)
bun run build

# Build frontend only
bun run build:ts

# Build WASM only
bun run build:wasm

# Run all tests (bun test + cargo test)
bun run test

# Watch mode (frontend only)
bun run test:watch
```

## Code Quality

```bash
# Lint everything (ESLint + Clippy + fmt check)
bun run lint

# Auto-fix lint issues (TS + Rust)
bun run lint:fix

# Format everything (Prettier + cargo fmt)
bun run format

# Check formatting without modifying files
bun run format:check

# Full verification pipeline (lint → test → build:ts)
bun run verify
```

### TypeScript

- ESLint with `@typescript-eslint/strict` + type-aware rules
- Prettier for formatting
- Zero warnings policy (`--max-warnings 0`)

### Rust

- `cargo clippy --workspace -- -D warnings` (deny all warnings)
- `cargo fmt` (enforced formatting)
- Workspace-level lint config in root `Cargo.toml`

## Pull Request Process

1. Create a feature branch from `main`
2. Commit messages in English
3. Run `bun run verify` before submitting
4. Submit PR with description of changes

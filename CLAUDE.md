# Claude Code Instructions

Read and follow all rules defined in `AGENTS.md` at the project root.
That file is the single source of truth for coding standards.

## Quick Reference

- **Verify**: `bun run verify` (lint → test → build:ts) before any commit
- **Build**: `bun run build` (WASM + TypeScript)
- **Test**: `bun run test` (bun test + cargo test)
- **Lint**: `bun run lint` (ESLint + Clippy + fmt)
- **Architecture**: `docs/DESIGN.md`
- **Requirements**: `docs/PRD.md`

## Key Constraints

- TypeScript: no `any`, explicit return types, strict mode
- Rust: no `.unwrap()` in lib code, `cargo clippy -- -D warnings`
- Git commits: English messages
- Code comments: English
- User docs: Chinese (Simplified)

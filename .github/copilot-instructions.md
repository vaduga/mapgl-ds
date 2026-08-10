# GitHub Copilot Instructions

Read and follow all rules defined in `AGENTS.md` at the project root.
That file is the single source of truth for coding standards.

## Project Overview

This is a Grafana panel plugin (React 18 + TypeScript 5) with a Rust WASM
analysis engine. Built with Rspack, tested with bun test + cargo test,
managed with bun.

## Key Rules

- Run `bun run verify` before any commit
- No `any` in TypeScript — use `unknown` and type guards
- No `.unwrap()` in Rust library code — use `Result` and `?`
- Git commits in English, code comments in English
- Follow architecture in `docs/DESIGN.md`

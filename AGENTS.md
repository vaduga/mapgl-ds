# AI Coding Standards

This file defines coding standards for AI assistants working on this project.
It is the single source of truth — IDE-specific config files should reference this.

## Project Context

- **Project**: Grafana Observability Agent Panel — AI-powered root cause analysis plugin
- **Architecture**: React 18 (TypeScript) frontend + Rust WASM analysis engine
- **Docs**: `docs/DESIGN.md` (architecture), `docs/PRD.md` (product requirements)
- **Build**: Rspack (AMD output), npm (package manager), wasm-pack (Rust→WASM)
- **Test**: Jest (frontend), cargo test (Rust)

## Language & Style

- Git commit messages: **English**
- Code comments: **English**
- User-facing documentation: **English**
- Comments explain *why*, not *what* — never restate the code

## Verification Before Commit

**CRITICAL**: Before producing a commit, run the full verification pipeline:

```bash
npm run verify    # lint (TS + Rust) → test (Jest + cargo test) → build:rspack
```

If any check fails, fix the issue before committing. Never skip verification.

## Pre-Commit Self-Check

1. Does the change match the architectural patterns in `docs/DESIGN.md`?
2. Are all new public APIs documented with JSDoc / rustdoc?
3. Are types used correctly (no `any` in TS, no `.unwrap()` in Rust library code)?
4. Are error paths handled (not swallowed silently)?
5. Is the change minimal and focused on the task?

## TypeScript Rules

- **Never** use `any` — use `unknown` and type guards instead
- **Never** use `@ts-ignore` or `@ts-expect-error` without a justification comment
- All public functions and components **must** have explicit return types
- Prefer `interface` over `type` for object shapes
- Use `readonly` for properties that should not be mutated
- React components: use `React.FC<Props>` with explicit props interface
- Prefer named exports over default exports
- Consistent naming: `camelCase` for variables/functions, `PascalCase` for types/components

## Rust Rules

- **Never** use `.unwrap()` in library code — use `Result` and `?` operator
- Every `unsafe` block **must** have a `// SAFETY:` comment explaining why it's sound
- Run `cargo clippy --workspace -- -D warnings` — zero warnings tolerance
- Run `cargo fmt` before commit — formatting is non-negotiable
- Prefer iterators and combinators over manual loops
- All public items **must** have `///` doc comments
- Use `pub(crate)` instead of `pub` when item doesn't need to be in the public API

## File Organization

- Follow the directory structure in `docs/DESIGN.md` §8
- Types go in `src/types/`, components in `src/components/`, services in `src/services/`
- One component per file, file name matches component name
- Rust modules follow `module_name.rs` convention

## Testing

- Every new feature **must** have at least one test
- Test files go in `tests/unit/` (unit) or `tests/integration/` (integration)
- Use test fixtures from `tests/fixtures/` for sample data
- Use factory functions from `tests/fixtures/factories.ts` for programmatic data generation
- Test names describe the expected behavior: `should_detect_anomaly_with_z_score`

## Error Handling

TypeScript: use try/catch with typed error responses, never swallow errors.
Rust: propagate with `Result` and `?`, add context with `.map_err()`.

## WASM Bridge Pattern

TypeScript services that call Rust WASM must:
1. Handle WASM initialization failures gracefully
2. Serialize input to JSON string for WASM boundary
3. Deserialize WASM output from JSON string
4. Provide fallback behavior when WASM is unavailable

## Code Review Checklist

### Critical (must fix before commit)
- No `any` types, no unhandled promise rejections, no hardcoded secrets
- No `.unwrap()` / `.expect()` in Rust library code
- Every `unsafe` has a `// SAFETY:` comment
- `cargo clippy -- -D warnings` passes

### High (should fix)
- Components have error boundaries / error states
- Async operations have loading / error / success states
- Types match `docs/DESIGN.md` §5 data model
- No memory leaks (useEffect cleanup, event listener removal)
- Borrows used instead of unnecessary clones in Rust

### Medium (flag to reviewer)
- Single responsibility per function
- Magic numbers replaced with constants from `src/utils/constants.ts`
- Imports organized: external → internal → types

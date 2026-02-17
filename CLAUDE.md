# CLAUDE.md — Agent Rules for navi

## Development Cycle

Three steps, repeating:

### 1. IMPLEMENT
- Make the requested changes in `src/`
- Follow the architecture and rules below
- Keep changes focused — one feature or fix at a time

### 2. VERIFY
- Run `bun run check` (lint + format check + test)
- Fix anything that fails
- Run `npx tsc --noEmit` to verify types

### 3. REVIEW
- Spawn a subagent to run the `skills/REVIEW.md` checklist against all changes
- Subagent reviews correctness, consistency, simplicity, testing, performance
- Fixes any issues found
- Reports back with summary of findings and changes

After review passes:
- Commit with a clear message
- Push to main

Pre-commit hook (husky) runs oxfmt + oxlint + tests + tsc automatically.

## Rules
- No `any` types — use `unknown` and narrow
- No classes unless genuinely needed — prefer functions and plain objects
- Keep dependencies minimal — understand what you import
- Tests live next to source: `src/foo.test.ts` for `src/foo.ts`
- Format with oxfmt, lint with oxlint — don't fight them

## Project
- **Runtime:** Bun
- **Language:** TypeScript (strict)
- **Lint:** oxlint
- **Format:** oxfmt
- **Test:** bun test
- **Path:** `~/code/navi/`

## Architecture

```
src/
  main.ts              # entrypoint
```

_Architecture section will grow as the project does._

## Key Commands

| Command | What it does |
|---------|-------------|
| `bun start` | Run navi |
| `bun dev` | Run with file watching |
| `bun test` | Run tests |
| `bun run lint` | oxlint |
| `bun run fmt` | oxfmt (write) |
| `bun run fmt:check` | oxfmt (check only) |
| `bun run check` | lint + fmt check + test |
| `npx tsc --noEmit` | Type check |

## Documentation Map

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Dev cycle, rules, architecture (you are here) |
| `skills/REVIEW.md` | Code review subagent prompt |
| `README.md` | Project overview for humans / GitHub |

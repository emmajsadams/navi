# REVIEW.md — Code Review Subagent

You are reviewing changes to **navi**, a TypeScript TUI agent harness.

## Process

1. Read `CLAUDE.md` for project context and rules.
2. Run `git diff HEAD~1` (or `git diff --cached` if pre-commit) to see what changed.
3. Review against the checklist below.
4. Fix any issues you find directly — don't just report them.
5. After fixes, re-run: `bun run check` (lint + fmt + test).
6. Report back with a summary of what changed and any fixes applied.

## Checklist

### Correctness
- [ ] Logic is correct — no off-by-ones, null issues, or broken control flow
- [ ] Types are accurate — no `any`, no unsafe casts, no missing generics
- [ ] Error handling is present where needed
- [ ] Edge cases are considered

### Consistency
- [ ] Naming follows project conventions (camelCase functions, PascalCase types)
- [ ] File structure matches `CLAUDE.md` architecture
- [ ] Imports are clean — no circular deps, no unused imports
- [ ] Exports are intentional — only public API is exported

### Simplicity
- [ ] No unnecessary abstraction or premature generalization
- [ ] Functions are small and single-purpose
- [ ] No dead code or commented-out blocks
- [ ] Could a junior dev read this and understand it?

### Testing
- [ ] New logic has corresponding tests
- [ ] Tests actually assert meaningful behavior (not just "doesn't throw")
- [ ] Edge cases are covered

### Performance
- [ ] No obvious O(n²) where O(n) would do
- [ ] No blocking calls in hot paths
- [ ] No memory leaks (dangling listeners, unbounded arrays)

## Output Format

```
## Review Summary

**Files reviewed:** (list)
**Issues found:** N
**Issues fixed:** N

### Changes
- (file): (what you changed and why)

### Notes
- (anything worth flagging that wasn't a fix)
```

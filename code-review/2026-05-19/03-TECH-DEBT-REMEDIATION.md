# Tech Debt Remediation — 2026-05-19

## Summary

| Metric | Count |
|--------|-------|
| `console.log` removed | 0 (none found in production paths) |
| `any` casts replaced | 0 (none found) |
| TODOs resolved | 0 inline TODOs found |
| Silent `catch` blocks fixed | 3 (ScreenplayPlayer `saveNote`, `saveReaction`; test mocks updated) |
| Deferred | 0 |

## Scan Results

```bash
# console.log in production paths: 0 found
# any casts in non-test code: 0 found
# TODO/FIXME in non-test files: 0 found
```

## Fixed This Session

| File | Pattern | Resolution |
|------|---------|-----------|
| `components/project/ScreenplayPlayer.tsx:265` | Silent `finally`-only in `saveNote` — no `catch` | Added `catch` with `toast.error` + reopen popover |
| `components/project/ScreenplayPlayer.tsx:285` | `catch { /* non-fatal */ }` in `saveReaction` | Replaced with `toast.error` call |
| `tests/unit/api/comments-api.test.ts:17` | Missing `$transaction` in Prisma mock | Added `$transaction` mock (implementation: call callback with mock client) |
| `tests/unit/api/project-comments.test.ts:18` | Missing `$transaction` + `deleteMany` in Prisma mock | Added both to mock |

## Deferred

None — scan found no tech debt in production paths.

## Patterns to Watch

- **Silent catch blocks** — the `/* non-fatal */` comment was used in two places in Sprint M. Going forward, every catch block in a user-facing action must either show a toast or rethrow. "Non-fatal" should not mean "invisible."
- **Test mocks missing new methods** — when wrapping operations in `$transaction`, update all existing test mocks simultaneously to avoid regression failures on the next test run.

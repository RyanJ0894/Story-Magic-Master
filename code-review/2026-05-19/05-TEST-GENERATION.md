# Test Generation Report — 2026-05-19

## Coverage Delta

| Package | Before | After | New Tests |
|---------|--------|-------|-----------|
| Web | 1,061 | 1,087 | +26 |
| Orchestrator | 541 | 541 | 0 |
| **Total** | **1,602** | **1,628** | **+26** |

## Tests Written / Fixed

| File | Tests | Methods Covered | Pass/Fail |
|------|-------|-----------------|-----------|
| `tests/unit/api/project-notes.test.ts` *(new)* | 13 | `GET` (list, empty, 401, 404), `POST` (create 201, no lineId, 400 empty/missing/invalid JSON), `DELETE` (own, 403 other, 404, 400 no noteId) | 13/13 ✓ |
| `tests/unit/api/project-comments.test.ts` *(fixed mock)* | existing | Added `$transaction` + `deleteMany` to Prisma mock | all pass ✓ |
| `tests/unit/api/comments-api.test.ts` *(fixed mock)* | existing | Added `$transaction` to Prisma mock | all pass ✓ |

## Still Uncovered (Deferred)

| Module | Reason | Sprint |
|--------|--------|--------|
| `components/project/ScreenplayPlayer.tsx` | React component — requires Vitest component test setup with DOM interactions | Sprint N |
| `components/project/NotesPanel.tsx` | React component — requires component test setup | Sprint N |
| `lib/ensure-profile.ts` | Simple find-or-create; covered indirectly by invite-accept.test.ts | Backlog |
| `lib/resolve-audio-url.ts` | 6 tests already written in prior session | Done ✓ |

## Patterns Established

**`$transaction` mock pattern** for Vitest:
```typescript
const mockPrisma = {
  // ... model mocks ...
  $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
};
```

This executes the callback immediately with the mock client, allowing `deleteMany` + `create` inside transactions to use the same mocks as direct calls. The callback type uses `unknown` to avoid TypeScript complaining about the recursive self-reference.

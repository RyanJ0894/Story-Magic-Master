# Contributing

> Guidelines for contributing to Story Magic

## Development Setup

### Prerequisites

- Node.js 20+ (LTS recommended)
- pnpm 8+
- Git

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/story-magic.git
cd story-magic

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Start development servers
pnpm dev
```

### Environment Variables

Required environment variables for development:

```bash
# LLM Providers (at least one required)
OPENAI_API_KEY=sk-...

# TTS (required for audio generation)
ELEVENLABS_API_KEY=...

# Database (required)
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
```

---

## Project Structure

```
story-magic/
├── packages/
│   ├── orchestrator/          # Main TypeScript service
│   │   ├── src/
│   │   │   ├── director/      # Script parsing & audio selection
│   │   │   ├── orchestrator/  # Audio generation pipeline
│   │   │   ├── routes/        # API endpoints
│   │   │   ├── schemas/       # Zod validation schemas
│   │   │   └── lib/           # Shared utilities
│   │   ├── catalog/           # Audio assets
│   │   └── knowledge_bases/   # Embeddings & catalogs
│   └── web/                   # Next.js frontend
├── docs/                      # Documentation
└── samples/                   # Test scripts
```

---

## Code Style

### TypeScript

- Use strict TypeScript (`strict: true` in tsconfig)
- Prefer interfaces over types for object shapes
- Export types alongside implementations
- Use Zod for runtime validation at boundaries

```typescript
// Good
export interface SceneInput {
  scene_id: string;
  dialogue: DialogueLine[];
}

export const SceneInputSchema = z.object({
  scene_id: z.string(),
  dialogue: z.array(DialogueLineSchema),
});

// Validate at boundaries
const validated = SceneInputSchema.safeParse(input);
if (!validated.success) {
  throw new ValidationError(validated.error);
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `audio-director-agent.ts` |
| Classes | PascalCase | `DirectorAgent` |
| Functions | camelCase | `buildTimeline` |
| Constants | UPPER_SNAKE | `MAX_SCENES` |
| Interfaces | PascalCase | `TimelineEvent` |
| Zod Schemas | PascalCase + Schema | `SceneSchema` |

### Imports

```typescript
// 1. Node.js built-ins
import fs from 'fs';
import path from 'path';

// 2. External packages
import { z } from 'zod';
import { execa } from 'execa';

// 3. Internal absolute imports
import { SceneSchema } from '../schemas/director-json.js';
import { withRetry } from '../lib/retry.js';

// 4. Relative imports
import { buildTimeline } from './timeline.js';
```

### Error Handling

```typescript
// Use typed errors
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly details: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Log errors with context
try {
  await processScene(scene);
} catch (err) {
  console.error(`Failed to process scene ${scene.scene_id}:`, err);
  throw err;
}
```

---

## Git Workflow

### Branch Naming

| Type | Format | Example |
|------|--------|---------|
| Feature | `feature/<description>` | `feature/voice-preview` |
| Bug fix | `fix/<description>` | `fix/timeline-validation` |
| Refactor | `refactor/<description>` | `refactor/mixer-typescript` |
| Docs | `docs/<description>` | `docs/api-reference` |

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(director): add voice preview endpoint

fix(mixer): resolve ducking calculation error

refactor(workers): convert timeline to TypeScript

docs: update API reference for orchestrate endpoint
```

### Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Ensure tests pass: `pnpm test`
4. Ensure types check: `pnpm typecheck`
5. Create PR with descriptive title and body
6. Request review from maintainers
7. Address feedback
8. Squash and merge

---

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test -- path/to/test.ts

# Watch mode
pnpm test:watch
```

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { validateTimeline } from './timeline-validator';

describe('validateTimeline', () => {
  it('should detect overlapping music tracks', () => {
    const timeline = {
      scene_id: 'scene_001',
      events: [
        { type: 'music_in', cue_id: 'track1', at: 0 },
        { type: 'music_in', cue_id: 'track2', at: 5 },
        { type: 'music_out', cue_id: 'track1', at: 30 },
      ],
    };

    const result = validateTimeline(timeline);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Music overlap detected');
  });
});
```

---

## Documentation

### Code Documentation

- Add JSDoc comments for public functions
- Include parameter descriptions
- Document return types and possible errors

```typescript
/**
 * Build event timeline from alignment and cue choices.
 * Validates for overlaps and conflicts.
 *
 * @param scene - Scene definition from Director JSON
 * @param alignment - Word-level timing from Whisper
 * @param cueChoices - Selected audio cues
 * @returns Timeline with ordered events
 * @throws ValidationError if timeline cannot be auto-fixed
 */
export async function buildTimeline(
  scene: Scene,
  alignment: SceneAlignment,
  cueChoices: SceneCues
): Promise<Timeline> {
  // ...
}
```

### Documentation Files

Update documentation when making changes:

| Change Type | Update |
|-------------|--------|
| API changes | `docs/API.md` |
| Architecture changes | `docs/ARCHITECTURE.md` |
| New features | `docs/ROADMAP.md`, `README.md` |
| Configuration | `docs/DEPLOYMENT.md` |

---

## Review Checklist

Before submitting a PR, ensure:

- [ ] Code compiles without errors: `pnpm typecheck`
- [ ] Tests pass: `pnpm test`
- [ ] No `any` types in new code
- [ ] Zod validation at external boundaries
- [ ] Error messages are clear and actionable
- [ ] Documentation updated if needed
- [ ] No secrets or API keys in code
- [ ] Commit messages follow conventions

---

## Getting Help

- **Questions:** Open a GitHub Discussion
- **Bugs:** Open a GitHub Issue with reproduction steps
- **Features:** Open a GitHub Issue with use case description

---

## License

All contributions are subject to the project's proprietary license. By contributing, you agree to assign copyright to the project.

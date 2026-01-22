# Feature Flags System

**Purpose:** Protect current functionality while incrementally rolling out new features.

---

## Quick Start

### Enable a Feature (Development)

**Option 1: URL Parameter (temporary)**
```
http://localhost:22000/projects/abc123?ff_story_score=true
```

**Option 2: Environment Variable (persistent)**
```bash
# Add to packages/web/.env.local
NEXT_PUBLIC_FF_STORY_SCORE=true
```

### Enable a Feature (Production)

Set environment variables in Render/Vercel dashboard:
```
NEXT_PUBLIC_FF_STORY_SCORE=true
```

---

## Available Features

| Flag | Feature | Phase | Dependencies |
|------|---------|-------|--------------|
| `STORY_SCORE` | 12-dimension script evaluation | 1 | None |
| `STORY_ADVISER` | Inline suggestions & rewrites | 2 | STORY_SCORE |
| `REVISION_TRACKING` | Version history & score trajectory | 2 | STORY_SCORE |
| `SCRIPT_EDITOR` | In-app CodeMirror editor | 2 | STORY_ADVISER |
| `COMPARABLE_SCRIPTS` | Similar scripts from corpus | 3 | STORY_SCORE |
| `EXPORT_REPORTS` | PDF report generation | 3 | STORY_SCORE |

---

## Usage in Code

### React Components

```tsx
import { FeatureGate, isFeatureEnabled } from '@/lib/features';

// Option 1: FeatureGate component (declarative)
<FeatureGate feature="STORY_SCORE" fallback={<ComingSoon />}>
  <StoryScore projectId={id} />
</FeatureGate>

// Option 2: Conditional rendering (imperative)
{isFeatureEnabled('STORY_SCORE') && <StoryScore projectId={id} />}

// Option 3: Multiple features
<MultiFeatureGate features={['STORY_SCORE', 'STORY_ADVISER']} mode="all">
  <AdvancedEditor />
</MultiFeatureGate>
```

### API Routes

```typescript
import { isFeatureEnabled } from '@/lib/features';

export async function POST(request: Request) {
  if (!isFeatureEnabled('STORY_SCORE')) {
    return Response.json(
      { error: 'Feature not enabled' },
      { status: 403 }
    );
  }

  // ... handle request
}
```

### Server Components

For server components, use the wrapper pattern:

```tsx
// StoryScoreSection.tsx (client component with flag check)
'use client';

import { FeatureGate } from '@/lib/features';
import { StoryScore } from './StoryScore';

export function StoryScoreSection(props) {
  return (
    <FeatureGate feature="STORY_SCORE">
      <StoryScore {...props} />
    </FeatureGate>
  );
}

// page.tsx (server component)
import { StoryScoreSection } from '@/components/storyscore';

export default async function ProjectPage() {
  return <StoryScoreSection projectId={id} scriptText={text} />;
}
```

---

## Development Tools

### Log All Flag Status

```typescript
import { logFeatureFlags } from '@/lib/features';

// In development, logs to console:
// 🚩 Feature Flags
// ❌ StoryScore (Phase 1) - Set NEXT_PUBLIC_FF_STORY_SCORE=true to enable
// ❌ Story-Adviser (Phase 2)
// ...

logFeatureFlags();
```

### Admin Panel Data

```typescript
import { getFeatureFlagStatus } from '@/lib/features';

// Returns array of all flags with status:
// [
//   { key: 'STORY_SCORE', name: 'StoryScore', enabled: false, envVar: 'NEXT_PUBLIC_FF_STORY_SCORE', ... },
//   ...
// ]

const flags = getFeatureFlagStatus();
```

---

## Rollout Strategy

### Phase 1: Internal Testing
```bash
# Only in development
?ff_story_score=true
```

### Phase 2: Staging
```bash
# Render staging environment
NEXT_PUBLIC_FF_STORY_SCORE=true
```

### Phase 3: Production (Gradual)
```bash
# Enable for all users
NEXT_PUBLIC_FF_STORY_SCORE=true
```

---

## Adding New Features

1. **Define the feature** in `lib/features/flags.ts`:

```typescript
export const FEATURES = {
  // ... existing features

  MY_NEW_FEATURE: {
    key: 'MY_NEW_FEATURE',
    name: 'My New Feature',
    description: 'What this feature does',
    defaultEnabled: false,
    dependsOn: ['STORY_SCORE'], // Optional dependencies
    phase: 2,
  },
};
```

2. **Gate your component**:

```tsx
<FeatureGate feature="MY_NEW_FEATURE">
  <MyNewComponent />
</FeatureGate>
```

3. **Document** in this file and `.env.features.example`

---

## Best Practices

1. **Always default to disabled** - New features should be off by default
2. **Use fallbacks** - Show "Coming Soon" or graceful degradation
3. **Test both states** - Ensure app works with feature on AND off
4. **Clean up** - Remove flag checks after feature is stable and fully rolled out
5. **Dependencies** - Use `dependsOn` to enforce feature prerequisites

---

## Troubleshooting

### Feature not enabling?

1. Check environment variable name: `NEXT_PUBLIC_FF_<KEY>=true`
2. Verify `NEXT_PUBLIC_` prefix (required for client-side)
3. Restart dev server after changing `.env.local`
4. Check dependencies - if parent feature is disabled, child won't enable

### Feature showing when it shouldn't?

1. Check for URL parameters in development
2. Verify environment variable is not set in production
3. Check if dependency is accidentally enabled

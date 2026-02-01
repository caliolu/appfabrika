# Story 2.2: Idea Input

Status: done

## Story

As a **user**,
I want **to enter my project idea in a single sentence**,
So that **the system understands what I want to build**.

## Acceptance Criteria

1. **Given** I am in the init flow
   **When** I am prompted for my idea
   **Then** I can enter a free-text description
   **And** the idea is saved to the project state

2. **Given** the init flow is running
   **When** the idea prompt appears
   **Then** it uses @clack/prompts text() for styled input
   **And** shows a helpful placeholder example

3. **Given** I enter an empty idea
   **When** I try to proceed
   **Then** validation prevents empty submissions
   **And** shows a friendly error message

4. **Given** I enter a valid idea
   **When** the input is accepted
   **Then** the idea is stored in project state
   **And** the flow is ready for LLM selection (implemented in Story 2.3)

## Tasks / Subtasks

- [x] Task 1: Create project state interface (AC: #1, #4)
  - [x] Create `src/types/project.types.ts` with ProjectState interface
  - [x] Define idea field as required string
  - [x] Export types for use across CLI layer

- [x] Task 2: Implement idea input prompt (AC: #1, #2)
  - [x] Use @clack/prompts `text()` function for input
  - [x] Add placeholder: "örn: Restoran rezervasyon uygulaması"
  - [x] Add message: "Proje fikrinizi tek cümlede açıklayın"
  - [x] Integrate into initCommand() flow after intro()

- [x] Task 3: Add input validation (AC: #3)
  - [x] Validate idea is not empty or whitespace-only
  - [x] Return friendly Turkish error message on validation failure
  - [x] Use @clack/prompts built-in validate option

- [x] Task 4: Store idea in state (AC: #4)
  - [x] Create in-memory project state object
  - [x] Store validated idea in state.idea
  - [x] Pass state to next step in flow

- [x] Task 5: Handle user cancellation (AC: #1)
  - [x] Detect when user presses Ctrl+C or cancels
  - [x] Use @clack/prompts `isCancel()` helper
  - [x] Show cancellation message and exit gracefully

- [x] Task 6: Write unit tests
  - [x] Test idea prompt is called with correct options
  - [x] Test empty input validation
  - [x] Test valid input is stored in state
  - [x] Test cancellation handling

- [x] Task 7: Update build and verify
  - [x] Verify `npm run build` succeeds
  - [x] Test `appfabrika init` shows idea prompt after welcome
  - [x] Verify input validation works

### Review Follow-ups (AI)

- [x] [AI-Review][MEDIUM] M1: AC#4 wording clarified - "ready for" instead of "proceeds to" [2-2-idea-input.md:31]
- [x] [AI-Review][MEDIUM] M2: Dev Notes test example updated to use exact string match [2-2-idea-input.md:191-195]
- [x] [AI-Review][MEDIUM] M3: Created `src/types/index.ts` barrel file for types export [src/types/index.ts]
- [x] [AI-Review][MEDIUM] M4: Removed unused `note: vi.fn()` mock from tests [tests/cli/init.test.ts:11]
- [x] [AI-Review][LOW] L1: Skipped - minor documentation clarity (optional)

## Dev Notes

### Previous Story Learnings (Story 2.1)

From Story 2.1 Code Review:
- **Top-level imports:** Use top-level imports instead of dynamic imports in tests
- **Test isolation:** vi.clearAllMocks() in beforeEach is sufficient
- **Error handling tests:** Include tests for error scenarios
- **Commander.js tests:** Test command registration separately

### Architecture Compliance

This story extends the **CLI Layer** init command:

```
[CLI Layer]
    ├── index.ts
    └── commands/
        └── init.ts       ← EXTEND (add idea input)

[Types Layer]
    └── project.types.ts  ← NEW
```

**Location:** `src/cli/commands/init.ts` (extend), `src/types/project.types.ts` (new)

### Technical Requirements

**@clack/prompts text() Usage:**

```typescript
import * as p from '@clack/prompts';

const idea = await p.text({
  message: 'Proje fikrinizi tek cümlede açıklayın:',
  placeholder: 'örn: Restoran rezervasyon uygulaması',
  validate: (value) => {
    if (!value || !value.trim()) {
      return 'Proje fikri boş olamaz';
    }
  },
});

if (p.isCancel(idea)) {
  p.cancel('İşlem iptal edildi.');
  process.exit(0);
}
```

**ProjectState Interface:**

```typescript
// src/types/project.types.ts
export interface ProjectState {
  idea: string;
  // Future: llmProvider, automationTemplate, projectPath
}
```

**Updated initCommand:**

```typescript
export async function initCommand(): Promise<void> {
  p.intro('🏭 AppFabrika - BMAD Proje Başlatıcı');

  // Story 2.2 - Idea input
  const idea = await p.text({
    message: 'Proje fikrinizi tek cümlede açıklayın:',
    placeholder: 'örn: Restoran rezervasyon uygulaması',
    validate: (value) => {
      if (!value || !value.trim()) {
        return 'Proje fikri boş olamaz';
      }
    },
  });

  if (p.isCancel(idea)) {
    p.cancel('İşlem iptal edildi.');
    process.exit(0);
  }

  const state: ProjectState = {
    idea: idea.trim(),
  };

  // TODO: Story 2.3 - LLM provider selection
  // TODO: Story 2.4 - Automation template selection
  // TODO: Story 2.5 - Project folder creation

  p.outro('✓ Init tamamlandı. Sonraki adımlar için bekleyiniz.');
}
```

### Testing Requirements

**Test Pattern:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as p from '@clack/prompts';

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  text: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
}));

describe('initCommand - idea input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prompt for idea with correct options', async () => {
    vi.mocked(p.text).mockResolvedValueOnce('Test fikri');

    await initCommand();

    expect(p.text).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Proje fikrinizi tek cümlede açıklayın:',
      placeholder: 'örn: Restoran rezervasyon uygulaması',
      validate: expect.any(Function),
    }));
  });

  it('should handle cancellation', async () => {
    vi.mocked(p.text).mockResolvedValueOnce(Symbol.for('cancel'));
    vi.mocked(p.isCancel).mockReturnValueOnce(true);

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await initCommand();

    expect(p.cancel).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);

    mockExit.mockRestore();
  });
});
```

### Library/Framework Requirements

| Package | Version | Usage |
|---------|---------|-------|
| @clack/prompts | ^1.0.0 | text() for input, isCancel() for cancellation |

**Important:** Package already installed.

### References

- [Source: architecture.md#CLI-Layer]
- [Source: architecture.md#Starter-Template]
- [Source: prd.md#FR2] - Kullanıcı proje fikrini tek cümle olarak girebilir
- [Source: epics.md#Story-2.2]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - ProjectState Interface**
   - Created `src/types/project.types.ts` with ProjectState interface
   - Defined `idea: string` as required field
   - Added JSDoc comments and future field placeholders

2. **Task 2 - Idea Input Prompt**
   - Used @clack/prompts `text()` function
   - Turkish message: "Proje fikrinizi tek cümlede açıklayın:"
   - Placeholder with example: "örn: Restoran rezervasyon uygulaması"

3. **Task 3 - Input Validation**
   - Validates empty and whitespace-only input
   - Turkish error: "Proje fikri boş olamaz"
   - Uses @clack/prompts built-in validate option

4. **Task 4 - State Storage**
   - Creates in-memory ProjectState object
   - Stores trimmed idea in state.idea
   - Shows idea in outro message

5. **Task 5 - Cancellation Handling**
   - Uses `p.isCancel()` to detect cancellation
   - Shows "İşlem iptal edildi." message
   - Exits gracefully with process.exit(0)

6. **Task 6 - Unit Tests**
   - 5 new tests for idea input functionality
   - Tests: prompt options, validation, state storage, cancellation, outro message
   - Total: 11 init tests (6 existing + 5 new)

7. **Task 7 - Build & Verify**
   - `npm run build` succeeds
   - All 159 tests pass (152 + 7 new = 159)

### File List

- `src/types/project.types.ts` (NEW) - ProjectState interface
- `src/types/index.ts` (NEW) - Types barrel export
- `src/cli/commands/init.ts` (MODIFIED) - Added idea input flow, barrel import
- `tests/cli/init.test.ts` (MODIFIED) - Added idea input tests, removed unused mock
- `tests/types/project.types.test.ts` (NEW) - Type tests

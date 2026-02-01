# Story 2.3: LLM Provider Selection

Status: done

## Story

As a **user**,
I want **to choose which LLM provider to use**,
So that **I can use my preferred AI model**.

## Acceptance Criteria

1. **Given** I have entered my idea
   **When** I am prompted for LLM selection
   **Then** I see options: OpenAI (GPT) and Anthropic (Claude)
   **And** my selection is saved to project config

2. **Given** the LLM selection prompt appears
   **When** I view the options
   **Then** it uses @clack/prompts select() for styled selection
   **And** shows clear labels for each provider

3. **Given** I select an LLM provider
   **When** the selection is accepted
   **Then** the provider is stored in ProjectState.llmProvider
   **And** the flow proceeds to automation template selection (Story 2.4)

4. **Given** I cancel during LLM selection
   **When** I press Ctrl+C or cancel
   **Then** the system shows cancellation message
   **And** exits gracefully

## Tasks / Subtasks

- [x] Task 1: Define LLM provider types (AC: #1, #3)
  - [x] Add LLMProvider enum to `src/types/project.types.ts`
  - [x] Define values: 'openai' | 'anthropic'
  - [x] Add llmProvider field to ProjectState interface
  - [x] Export types via barrel file

- [x] Task 2: Implement LLM selection prompt (AC: #1, #2)
  - [x] Use @clack/prompts `select()` function for selection
  - [x] Add options with Turkish labels:
    - OpenAI (GPT-4) - value: 'openai'
    - Anthropic (Claude) - value: 'anthropic'
  - [x] Add message: "Hangi LLM sağlayıcısını kullanmak istersiniz?"
  - [x] Integrate into initCommand() flow after idea input

- [x] Task 3: Store selection in state (AC: #3)
  - [x] Update ProjectState with selected llmProvider
  - [x] Update outro message to show selected provider
  - [x] Ensure state is passed to next step

- [x] Task 4: Handle user cancellation (AC: #4)
  - [x] Check isCancel() after select() call
  - [x] Show "İşlem iptal edildi." message
  - [x] Exit gracefully with process.exit(0)

- [x] Task 5: Write unit tests
  - [x] Test select() is called with correct options
  - [x] Test OpenAI selection is stored in state
  - [x] Test Anthropic selection is stored in state
  - [x] Test cancellation handling
  - [x] Test state includes llmProvider after selection

- [x] Task 6: Update build and verify
  - [x] Verify `npm run build` succeeds
  - [x] Test `appfabrika init` shows LLM selection after idea
  - [x] Verify both options work correctly

## Dev Notes

### Previous Story Learnings (Story 2.2)

From Story 2.2 Implementation and Code Review:
- **Barrel exports:** Always export new types via `src/types/index.ts`
- **Exact test assertions:** Use exact string matches, not `stringContaining()`
- **Mock cleanup:** Only mock functions that are actually used
- **Cancellation pattern:** Use `throw new Error('process.exit called')` in mocked exit for test assertions
- **State passing:** Use local `state` object to accumulate user inputs

### Architecture Compliance

This story extends the **CLI Layer** init command:

```
[CLI Layer]
    ├── index.ts
    └── commands/
        └── init.ts       ← EXTEND (add LLM selection)

[Types Layer]
    ├── index.ts          ← UPDATE (export LLMProvider)
    └── project.types.ts  ← EXTEND (add LLMProvider enum)
```

**Location:** `src/cli/commands/init.ts` (extend), `src/types/project.types.ts` (extend)

### Technical Requirements

**@clack/prompts select() Usage:**

```typescript
import * as p from '@clack/prompts';

const llmProvider = await p.select({
  message: 'Hangi LLM sağlayıcısını kullanmak istersiniz?',
  options: [
    { value: 'openai', label: 'OpenAI (GPT-4)' },
    { value: 'anthropic', label: 'Anthropic (Claude)' },
  ],
});

if (p.isCancel(llmProvider)) {
  p.cancel('İşlem iptal edildi.');
  process.exit(0);
}
```

**LLMProvider Type:**

```typescript
// src/types/project.types.ts
export type LLMProvider = 'openai' | 'anthropic';

export interface ProjectState {
  idea: string;
  llmProvider?: LLMProvider;
  // Future: automationTemplate, projectPath
}
```

**Updated initCommand Flow:**

```typescript
export async function initCommand(): Promise<void> {
  p.intro('🏭 AppFabrika - BMAD Proje Başlatıcı');

  // Story 2.2 - Idea input
  const idea = await p.text({ ... });
  if (p.isCancel(idea)) { ... }

  // Story 2.3 - LLM provider selection
  const llmProvider = await p.select({
    message: 'Hangi LLM sağlayıcısını kullanmak istersiniz?',
    options: [
      { value: 'openai', label: 'OpenAI (GPT-4)' },
      { value: 'anthropic', label: 'Anthropic (Claude)' },
    ],
  });

  if (p.isCancel(llmProvider)) {
    p.cancel('İşlem iptal edildi.');
    process.exit(0);
  }

  const state: ProjectState = {
    idea: idea.trim(),
    llmProvider: llmProvider as LLMProvider,
  };

  // TODO: Story 2.4 - Automation template selection
  // TODO: Story 2.5 - Project folder creation

  p.outro(`✓ Proje yapılandırıldı: ${state.llmProvider} ile "${state.idea}"`);
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
  select: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
}));

describe('initCommand - LLM selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(p.text).mockResolvedValue('Test fikri');
    vi.mocked(p.isCancel).mockReturnValue(false);
  });

  it('should prompt for LLM provider with correct options', async () => {
    vi.mocked(p.select).mockResolvedValueOnce('openai');

    await initCommand();

    expect(p.select).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Hangi LLM sağlayıcısını kullanmak istersiniz?',
      options: [
        { value: 'openai', label: 'OpenAI (GPT-4)' },
        { value: 'anthropic', label: 'Anthropic (Claude)' },
      ],
    }));
  });

  it('should store openai selection in state', async () => {
    vi.mocked(p.select).mockResolvedValueOnce('openai');

    await initCommand();

    expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('openai'));
  });

  it('should store anthropic selection in state', async () => {
    vi.mocked(p.select).mockResolvedValueOnce('anthropic');

    await initCommand();

    expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('anthropic'));
  });

  it('should handle LLM selection cancellation', async () => {
    vi.mocked(p.text).mockResolvedValueOnce('Test fikri');
    const cancelSymbol = Symbol('cancel');
    vi.mocked(p.select).mockResolvedValueOnce(cancelSymbol as unknown as string);
    vi.mocked(p.isCancel).mockImplementation((value) => value === cancelSymbol);

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    await expect(initCommand()).rejects.toThrow('process.exit called');

    expect(p.cancel).toHaveBeenCalledWith('İşlem iptal edildi.');
    expect(mockExit).toHaveBeenCalledWith(0);

    mockExit.mockRestore();
  });
});
```

### Library/Framework Requirements

| Package | Version | Usage |
|---------|---------|-------|
| @clack/prompts | ^1.0.0 | select() for provider selection, isCancel() for cancellation |

**Important:** Package already installed.

### References

- [Source: architecture.md#Technology-Stack] - OpenAI + Anthropic SDK versions
- [Source: architecture.md#LLM-Provider-Abstraction] - Adapter pattern design
- [Source: epics.md#Story-2.3] - LLM Provider Selection requirements
- [Source: prd.md#FR3] - Kullanıcı LLM seçimi yapabilir (GPT veya Claude API)
- [Source: prd.md#FR26] - Kullanıcı farklı LLM sağlayıcıları kullanabilir

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - LLMProvider Type**
   - Added `LLMProvider` type as union: `'openai' | 'anthropic'`
   - Updated `ProjectState` interface with optional `llmProvider` field
   - Types exported via existing barrel file

2. **Task 2 - LLM Selection Prompt**
   - Used @clack/prompts `select()` function
   - Turkish message: "Hangi LLM sağlayıcısını kullanmak istersiniz?"
   - Options: OpenAI (GPT-4) and Anthropic (Claude)

3. **Task 3 - State Storage**
   - Selection stored in `state.llmProvider`
   - Outro message updated to show provider and idea

4. **Task 4 - Cancellation Handling**
   - Uses `p.isCancel()` after select() call
   - Shows "İşlem iptal edildi." message
   - Exits gracefully with process.exit(0)

5. **Task 5 - Unit Tests**
   - 5 new tests for LLM selection functionality
   - Tests: prompt options, openai selection, anthropic selection, cancellation, outro message
   - Total: 16 init tests (11 existing + 5 new)

6. **Task 6 - Build & Verify**
   - `npm run build` succeeds
   - All 164 tests pass (159 + 5 new = 164)

### File List

- `src/types/project.types.ts` (MODIFIED) - Added LLMProvider type
- `src/cli/commands/init.ts` (MODIFIED) - Added LLM selection flow
- `tests/cli/init.test.ts` (MODIFIED) - Added LLM selection tests


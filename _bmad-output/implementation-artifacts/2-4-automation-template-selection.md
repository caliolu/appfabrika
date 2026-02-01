# Story 2.4: Automation Template Selection

Status: done

## Story

As a **user**,
I want **to choose my automation level**,
So that **I can control how much manual input is required**.

## Acceptance Criteria

1. **Given** I have selected an LLM provider
   **When** I am prompted for automation template
   **Then** I see: "Hızlı Başla (Full Auto)" and "Adım Adım (Checkpoint)"
   **And** my selection determines the automation mode for all BMAD steps

2. **Given** the automation template prompt appears
   **When** I view the options
   **Then** it uses @clack/prompts select() for styled selection
   **And** shows clear labels with descriptions for each template

3. **Given** I select an automation template
   **When** the selection is accepted
   **Then** the template is stored in ProjectState.automationTemplate
   **And** the flow proceeds to project folder creation (Story 2.5)

4. **Given** I cancel during automation template selection
   **When** I press Ctrl+C or cancel
   **Then** the system shows cancellation message
   **And** exits gracefully

## Tasks / Subtasks

- [x] Task 1: Define AutomationTemplate type (AC: #1, #3)
  - [x] Add AutomationTemplate type to `src/types/project.types.ts`
  - [x] Define values: 'full-auto' | 'checkpoint'
  - [x] Add automationTemplate field to ProjectState interface
  - [x] Export types via barrel file (already exists)

- [x] Task 2: Implement automation template selection prompt (AC: #1, #2)
  - [x] Use @clack/prompts `select()` function for selection
  - [x] Add options with Turkish labels and descriptions:
    - Hızlı Başla (Full Auto) - value: 'full-auto', hint: "Tüm adımlar otomatik çalışır"
    - Adım Adım (Checkpoint) - value: 'checkpoint', hint: "Her adımda onay istenir"
  - [x] Add message: "Otomasyon seviyesini seçin:"
  - [x] Integrate into initCommand() flow after LLM selection

- [x] Task 3: Store selection in state (AC: #3)
  - [x] Update ProjectState with selected automationTemplate
  - [x] Update outro message to show all selections (idea, llmProvider, automationTemplate)
  - [x] Ensure state is passed to next step

- [x] Task 4: Handle user cancellation (AC: #4)
  - [x] Check isCancel() after select() call
  - [x] Show "İşlem iptal edildi." message
  - [x] Exit gracefully with process.exit(0)

- [x] Task 5: Write unit tests
  - [x] Test select() is called with correct options after LLM selection
  - [x] Test full-auto selection is stored in state
  - [x] Test checkpoint selection is stored in state
  - [x] Test cancellation handling for automation selection
  - [x] Test outro message includes automationTemplate

- [x] Task 6: Update build and verify
  - [x] Verify `npm run build` succeeds
  - [x] Test `appfabrika init` shows automation selection after LLM
  - [x] Verify both options work correctly

## Dev Notes

### Previous Story Learnings (Story 2.3)

From Story 2.3 Implementation and Code Review:
- **Barrel exports:** Types already exported via `src/types/index.ts`
- **Exact test assertions:** Use exact string matches for outro verification
- **select() pattern:** Follow same pattern as LLM selection
- **Cancellation pattern:** Use `throw new Error('process.exit called')` in mocked exit
- **State passing:** Continue accumulating in local `state` object

### Architecture Compliance

This story extends the **CLI Layer** init command:

```
[CLI Layer]
    ├── index.ts
    └── commands/
        └── init.ts       ← EXTEND (add automation template selection)

[Types Layer]
    ├── index.ts          ← ALREADY EXPORTS from project.types.ts
    └── project.types.ts  ← EXTEND (add AutomationTemplate type)
```

**Location:** `src/cli/commands/init.ts` (extend), `src/types/project.types.ts` (extend)

### Technical Requirements

**@clack/prompts select() with hints:**

```typescript
import * as p from '@clack/prompts';

const automationTemplate = await p.select({
  message: 'Otomasyon seviyesini seçin:',
  options: [
    {
      value: 'full-auto',
      label: 'Hızlı Başla (Full Auto)',
      hint: 'Tüm adımlar otomatik çalışır'
    },
    {
      value: 'checkpoint',
      label: 'Adım Adım (Checkpoint)',
      hint: 'Her adımda onay istenir'
    },
  ],
});

if (p.isCancel(automationTemplate)) {
  p.cancel('İşlem iptal edildi.');
  process.exit(0);
}
```

**AutomationTemplate Type:**

```typescript
// src/types/project.types.ts
export type LLMProvider = 'openai' | 'anthropic';
export type AutomationTemplate = 'full-auto' | 'checkpoint';

export interface ProjectState {
  /** User's project idea in one sentence */
  idea: string;
  /** Selected LLM provider for BMAD workflow */
  llmProvider?: LLMProvider;
  /** Selected automation template for workflow control */
  automationTemplate?: AutomationTemplate;
  // Future fields (Story 2.5):
  // projectPath?: string;
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
  const llmProvider = await p.select({ ... });
  if (p.isCancel(llmProvider)) { ... }

  // Story 2.4 - Automation template selection
  const automationTemplate = await p.select({
    message: 'Otomasyon seviyesini seçin:',
    options: [
      {
        value: 'full-auto',
        label: 'Hızlı Başla (Full Auto)',
        hint: 'Tüm adımlar otomatik çalışır'
      },
      {
        value: 'checkpoint',
        label: 'Adım Adım (Checkpoint)',
        hint: 'Her adımda onay istenir'
      },
    ],
  });

  if (p.isCancel(automationTemplate)) {
    p.cancel('İşlem iptal edildi.');
    process.exit(0);
  }

  const state: ProjectState = {
    idea: idea.trim(),
    llmProvider: llmProvider as LLMProvider,
    automationTemplate: automationTemplate as AutomationTemplate,
  };

  // TODO: Story 2.5 - Project folder creation

  p.outro(`✓ Proje yapılandırıldı: ${state.automationTemplate} modunda ${state.llmProvider} ile "${state.idea}"`);
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

describe('initCommand - Automation template selection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(p.text).mockResolvedValue('Test fikri');
    vi.mocked(p.isCancel).mockReturnValue(false);
  });

  it('should prompt for automation template with correct options', async () => {
    vi.mocked(p.select)
      .mockResolvedValueOnce('openai')           // LLM selection
      .mockResolvedValueOnce('full-auto');       // Automation selection

    await initCommand();

    expect(p.select).toHaveBeenCalledTimes(2);
    expect(p.select).toHaveBeenNthCalledWith(2, {
      message: 'Otomasyon seviyesini seçin:',
      options: [
        {
          value: 'full-auto',
          label: 'Hızlı Başla (Full Auto)',
          hint: 'Tüm adımlar otomatik çalışır'
        },
        {
          value: 'checkpoint',
          label: 'Adım Adım (Checkpoint)',
          hint: 'Her adımda onay istenir'
        },
      ],
    });
  });

  it('should store full-auto selection in state', async () => {
    vi.mocked(p.select)
      .mockResolvedValueOnce('openai')
      .mockResolvedValueOnce('full-auto');

    await initCommand();

    expect(p.outro).toHaveBeenCalledWith(
      '✓ Proje yapılandırıldı: full-auto modunda openai ile "Test fikri"'
    );
  });

  it('should store checkpoint selection in state', async () => {
    vi.mocked(p.select)
      .mockResolvedValueOnce('anthropic')
      .mockResolvedValueOnce('checkpoint');

    await initCommand();

    expect(p.outro).toHaveBeenCalledWith(
      '✓ Proje yapılandırıldı: checkpoint modunda anthropic ile "Test fikri"'
    );
  });

  it('should handle automation template cancellation', async () => {
    vi.mocked(p.select).mockResolvedValueOnce('openai');  // LLM passes

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
| @clack/prompts | ^1.0.0 | select() with hint option for template selection |

**Important:** Package already installed. The `hint` property in options is supported by @clack/prompts.

### PRD/Architecture References

- [Source: prd.md#FR4] - Kullanıcı otomasyon şablonu seçebilir (Full Auto / Business Manuel / Full Manuel / Custom)
- [Source: prd.md#FR30] - Kullanıcı "Full Auto" şablonunu seçebilir
- [Source: prd.md#FR31] - Kullanıcı "Business Manuel" şablonunu seçebilir
- [Source: architecture.md#UX-Trade-off-Decisions] - İlk seçimde 2 ana seçenek: "Hızlı Başla" / "Adım Adım"
- [Source: epics.md#Story-2.4] - Automation Template Selection requirements

**Note:** PRD mentions 4 templates (Full Auto / Business Manuel / Full Manuel / Custom) but Architecture simplifies to 2 options for MVP UX. Follow Architecture decision.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - AutomationTemplate Type**
   - Added `AutomationTemplate` type as union: `'full-auto' | 'checkpoint'`
   - Updated `ProjectState` interface with optional `automationTemplate` field
   - Types already exported via existing barrel file

2. **Task 2 - Automation Template Selection Prompt**
   - Used @clack/prompts `select()` function with `hint` property
   - Turkish message: "Otomasyon seviyesini seçin:"
   - Options: Hızlı Başla (Full Auto), Adım Adım (Checkpoint)

3. **Task 3 - State Storage**
   - Selection stored in `state.automationTemplate`
   - Outro message format: "✓ Proje yapılandırıldı: {template} modunda {provider} ile "{idea}""

4. **Task 4 - Cancellation Handling**
   - Uses `p.isCancel()` after select() call
   - Shows "İşlem iptal edildi." message
   - Exits gracefully with process.exit(0)

5. **Task 5 - Unit Tests**
   - 5 new tests for automation template selection
   - Used `vi.resetAllMocks()` instead of `vi.clearAllMocks()` for cleaner test isolation
   - Added helper function `setupDefaultMocks()` for consistent mock setup
   - Total: 21 init tests (16 existing + 5 new)

6. **Task 6 - Build & Verify**
   - `npm run build` succeeds
   - All 169 tests pass (164 + 5 new = 169)

### File List

- `src/types/project.types.ts` (MODIFIED) - Added AutomationTemplate type
- `src/cli/commands/init.ts` (MODIFIED) - Added automation template selection flow
- `tests/cli/init.test.ts` (MODIFIED) - Added automation template tests, improved mock setup

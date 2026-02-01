# Story 2.1: Init Command Entry Point

Status: done

## Story

As a **user**,
I want **to run `appfabrika init` to start a new project**,
So that **I can begin the BMAD workflow**.

## Acceptance Criteria

1. **Given** AppFabrika is installed globally
   **When** I run `appfabrika init`
   **Then** the initialization flow starts with a welcome message
   **And** the process completes in under 3 seconds

2. **Given** AppFabrika CLI is running
   **When** `appfabrika init` command is invoked
   **Then** Commander.js parses the command correctly
   **And** the init command handler is executed

3. **Given** the init command starts
   **When** a welcome message is shown
   **Then** it uses @clack/prompts intro() for styled output
   **And** displays AppFabrika branding

4. **Given** the init command completes setup
   **When** no errors occur
   **Then** the user sees a success message
   **And** is ready for the next step (idea input - Story 2.2)

## Tasks / Subtasks

- [x] Task 1: Integrate Commander.js into CLI (AC: #2)
  - [x] Create `src/cli/commands/init.ts` with init command handler
  - [x] Update `src/cli/index.ts` to use Commander.js program
  - [x] Add `--version` and `--help` flags
  - [x] Register `init` command with description

- [x] Task 2: Implement welcome message (AC: #1, #3)
  - [x] Import @clack/prompts `intro()` function
  - [x] Create branded welcome message with AppFabrika name
  - [x] Add brief description of what will happen

- [x] Task 3: Create init command structure (AC: #4)
  - [x] Implement `initCommand()` async function
  - [x] Add basic flow: welcome → (placeholder for future steps) → success
  - [x] Return control to main CLI after completion

- [x] Task 4: Write unit tests (AC: #1, #2, #3, #4)
  - [x] Test Commander.js command registration
  - [x] Test init command handler is called
  - [x] Test welcome message output (mock @clack/prompts)
  - [x] Test success completion

- [x] Task 5: Update build and verify
  - [x] Verify `npm run build` succeeds
  - [x] Test `npx appfabrika init` runs correctly
  - [x] Verify `appfabrika --help` shows init command

## Dev Notes

### Previous Story Learnings (Epic 1)

From Epic 1 Retrospective:
- **Singleton reset:** Add `reset*()` function for any singleton/module-level state
- **Validation normalize:** Validation functions should return normalized values
- **Test isolation:** Use `beforeEach/afterEach` with reset calls
- **Deep copy:** Use spread or structuredClone for nested objects
- **Dead code:** Remove unused imports immediately after refactoring

### Architecture Compliance

This story creates the **CLI Layer** entry point:

```
[CLI Layer]
    ├── index.ts          ← Main entry (UPDATE)
    └── commands/
        └── init.ts       ← THIS STORY (NEW)
```

**Location:** `src/cli/commands/init.ts`

### Technical Requirements

**Commander.js Integration:**

```typescript
// src/cli/index.ts
import { Command } from 'commander';
import { initCommand } from './commands/init.js';

const program = new Command();

program
  .name('appfabrika')
  .description('BMAD metodolojisi ile ürün geliştirme CLI aracı')
  .version('0.1.0');

program
  .command('init')
  .description('Yeni bir BMAD projesi başlat')
  .action(initCommand);

program.parse();
```

**Init Command Handler:**

```typescript
// src/cli/commands/init.ts
import * as p from '@clack/prompts';

export async function initCommand(): Promise<void> {
  p.intro('🏭 AppFabrika - BMAD Proje Başlatıcı');

  // TODO: Story 2.2 - Idea input
  // TODO: Story 2.3 - LLM selection
  // TODO: Story 2.4 - Automation template
  // TODO: Story 2.5 - Project folder creation

  p.outro('✓ Init tamamlandı. Sonraki adımlar için bekleyiniz.');
}
```

**@clack/prompts Usage:**

```typescript
import * as p from '@clack/prompts';

// Intro - Branded welcome
p.intro('🏭 AppFabrika');

// Outro - Success message
p.outro('✓ Başarılı');

// Note - Info messages
p.note('Detaylı bilgi...', 'Bilgi');

// Spinner for async ops (future stories)
const s = p.spinner();
s.start('İşleniyor...');
s.stop('Tamamlandı');
```

### File Structure Requirements

```
src/cli/
├── index.ts              # Commander.js program setup
├── commands/
│   └── init.ts           # Init command handler
└── ui/
    └── .gitkeep          # (Future: UI utilities)
```

### Testing Requirements

**Test Pattern:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initCommand } from '../../src/cli/commands/init.js';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
}));

describe('initCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show welcome message', async () => {
    const p = await import('@clack/prompts');

    await initCommand();

    expect(p.intro).toHaveBeenCalledWith(expect.stringContaining('AppFabrika'));
  });

  it('should show success message on completion', async () => {
    const p = await import('@clack/prompts');

    await initCommand();

    expect(p.outro).toHaveBeenCalled();
  });
});
```

**Commander.js Testing:**

```typescript
import { Command } from 'commander';

describe('CLI Program', () => {
  it('should register init command', () => {
    // Import the program and check commands
    // Or use commander's built-in testing utilities
  });
});
```

### Performance Requirement

- NFR4: Proje başlangıcı (init) 3 saniye içinde tamamlanmalı
- This story only sets up the entry point - should complete in <100ms
- Future stories (2.2-2.5) will add actual initialization logic

### Library/Framework Requirements

| Package | Version | Usage |
|---------|---------|-------|
| commander | ^14.0.3 | CLI command parsing |
| @clack/prompts | ^1.0.0 | Styled terminal prompts |

**Important:** Both packages are already installed (see package.json).

### References

- [Source: architecture.md#CLI-Layer]
- [Source: architecture.md#Starter-Template]
- [Source: prd.md#FR1] - `appfabrika init` komutu
- [Source: epics.md#Story-2.1]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - Commander.js Integration**
   - Created `src/cli/commands/init.ts` with async `initCommand()` function
   - Updated `src/cli/index.ts` to use Commander.js program with name, description, version
   - Added `--version` (-V) and `--help` (-h) flags via Commander.js
   - Registered `init` command with Turkish description

2. **Task 2 - Welcome Message**
   - Used @clack/prompts `intro()` for styled welcome message
   - Branded with "🏭 AppFabrika - BMAD Proje Başlatıcı"

3. **Task 3 - Init Command Structure**
   - Implemented async `initCommand()` returning Promise<void>
   - Flow: intro() → TODO placeholders for future steps → outro()
   - Returns control after completion

4. **Task 4 - Unit Tests**
   - Created `tests/cli/init.test.ts` with 3 tests
   - Mocked @clack/prompts module
   - Tests: welcome message contains "AppFabrika", outro called, no errors

5. **Task 5 - Build & Verify**
   - `npm run build` succeeds
   - `appfabrika init` shows styled welcome/success
   - `appfabrika --help` shows init command
   - `appfabrika --version` shows 0.1.0

6. **Test Results**
   - All 152 tests pass (146 existing + 6 new)
   - No regressions

7. **Code Review Fixes (Round 1)**
   - M1: Removed redundant afterEach block from tests
   - M2: Added Commander.js command registration tests (2 tests)
   - M3: Fixed test isolation - top-level imports instead of dynamic imports
   - M4: Added error handling test for @clack/prompts failures

### File List

- `src/cli/index.ts` (MODIFIED) - Commander.js integration
- `src/cli/commands/init.ts` (NEW) - Init command handler
- `tests/cli/init.test.ts` (NEW, UPDATED) - Init command tests (6 tests)

## Senior Developer Review (AI)

**Review Date:** 2026-01-31
**Reviewer:** Claude Opus 4.5 (Adversarial Code Review)
**Outcome:** Approved

### Issues Found

| Severity | Count | Status |
|----------|-------|--------|
| HIGH | 0 | - |
| MEDIUM | 4 | All Fixed |
| LOW | 2 | Noted |

### Action Items

- [x] M1: Remove redundant afterEach block [tests/cli/init.test.ts:19-21]
- [x] M2: Add Commander.js command registration test [tests/cli/init.test.ts]
- [x] M3: Fix test isolation - use top-level imports [tests/cli/init.test.ts]
- [x] M4: Add error handling test [tests/cli/init.test.ts]
- [ ] L1: (NOTED) Inconsistent Turkish characters in comments - deferred to future cleanup
- [ ] L2: (NOTED) outro message could be more descriptive - will be updated in Story 2.5

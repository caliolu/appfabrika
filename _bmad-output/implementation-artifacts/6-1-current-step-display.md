# Story 6.1: Current Step Display

Status: done

## Story

As a **user**,
I want **to see which BMAD step is currently running**,
So that **I know where I am in the workflow**.

## Acceptance Criteria

1. **Given** a BMAD step is in progress
   **When** I look at the terminal
   **Then** I see the step name with emoji and description

2. **Given** the workflow is running
   **When** a step transitions
   **Then** the display updates to show the new step

3. **Given** step display elements
   **When** rendering
   **Then** uses defined emojis and Turkish names

## Tasks / Subtasks

- [x] Task 1: Define step display constants (AC: #3)
  - [x] Create step emojis mapping
  - [x] Create step descriptions
  - [x] Export from types

- [x] Task 2: Create TerminalUI service (AC: #1, #2)
  - [x] Create src/cli/ui/terminal-ui.ts
  - [x] Add renderCurrentStep() method
  - [x] Add formatStepDisplay() method

- [x] Task 3: Create step display components (AC: #1)
  - [x] Create step header with emoji
  - [x] Create step description line
  - [x] Create progress indicator

- [x] Task 4: Write tests
  - [x] Test step emoji mapping
  - [x] Test display formatting
  - [x] Test Turkish text content

## Dev Notes

### Architecture Compliance

Per FR39: Sistem mevcut BMAD adımını gösterebilir

Display format:
```
💡 Fikir Geliştirme
   Proje fikrini analiz ediyor...
```

Step emojis:
- 💡 Brainstorming
- 🔍 Research
- 📋 Product Brief
- 📄 PRD
- 🎨 UX Design
- 🏗️ Architecture
- 📝 Epics & Stories
- 📅 Sprint Planning
- 🔧 Tech Spec
- 💻 Development
- 🔎 Code Review
- ✅ QA Testing

### PRD/Architecture References

- [Source: prd.md#FR39] - Mevcut adım gösterimi
- [Source: epics.md#Epic-6-Story-6.1] - Current Step Display

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - Step Display Constants**
   - Added BMAD_STEP_EMOJIS mapping with all 12 step emojis
   - Added BMAD_STEP_DESCRIPTIONS with Turkish descriptions for all steps
   - Exported from src/types/bmad.types.ts

2. **Task 2 - TerminalUI Service**
   - Created TerminalUI class with singleton pattern
   - renderCurrentStep() displays emoji + name + description
   - formatStepDisplay() with options (showDescription, indent, showNumber)
   - Color support via ANSI codes with enable/disable option

3. **Task 3 - Step Display Components**
   - formatStepHeader() with bold styling
   - formatStepDescription() with dim styling and indent
   - formatProgress() for progress indicator
   - formatStepWithStatus() for status display
   - renderCurrentStepStyled() for combined styled output

4. **Task 4 - Tests**
   - 41 new tests for TerminalUI
   - Tests for emoji mapping, display formatting, Turkish text
   - Tests for color management and singleton pattern
   - 542 total tests passing

### File List

- `src/types/bmad.types.ts` (MODIFIED) - Added BMAD_STEP_EMOJIS and BMAD_STEP_DESCRIPTIONS
- `src/cli/ui/terminal-ui.ts` (NEW) - TerminalUI service class
- `src/cli/ui/index.ts` (NEW) - UI module exports
- `tests/cli/ui/terminal-ui.test.ts` (NEW) - 41 tests for TerminalUI

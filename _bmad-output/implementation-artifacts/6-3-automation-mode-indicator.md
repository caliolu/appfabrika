# Story 6.3: Automation Mode Indicator

Status: done

## Story

As a **user**,
I want **to see whether each step is auto or manual**,
So that **I know when my input is needed**.

## Acceptance Criteria

1. **Given** the step overview is displayed
   **Then** each step shows [A] for auto or [M] for manual

2. **Given** a step is in manual mode
   **When** viewing the display
   **Then** the indicator is highlighted to draw attention

3. **Given** automation mode changes during workflow
   **When** display updates
   **Then** indicator reflects current mode

## Tasks / Subtasks

- [x] Task 1: Define automation mode display types (AC: #1)
  - [x] Add AutomationModeDisplay interface
  - [x] Add AUTOMATION_MODE_INDICATORS constant
  - [x] Turkish labels for modes

- [x] Task 2: Update formatStepStatusLine (AC: #1, #2)
  - [x] Add formatStepStatusLineWithMode method
  - [x] Include [A] or [M] indicator in output
  - [x] Color-code manual mode differently (yellow)

- [x] Task 3: Update renderStepStatusOverview (AC: #1, #3)
  - [x] Add renderStepStatusOverviewWithModes method
  - [x] Display automation mode for each step
  - [x] Summary of auto vs manual counts

- [x] Task 4: Write tests
  - [x] Test automation mode indicators
  - [x] Test colored output
  - [x] Test overview with modes

## Dev Notes

### Architecture Compliance

Per FR41: Sistem her adımın otomasyon modunu gösterebilir

Display format:
```
BMAD Workflow Durumu
====================
[ 1] ✓ [A] Fikir Geliştirme
[ 2] ✓ [M] Araştırma
[ 3] ● [A] Ürün Özeti (devam ediyor)
...
```

Mode indicators:
- [A] = Otomatik (Auto)
- [M] = Manuel (Manual)
- [S] = Atla (Skip)

### PRD/Architecture References

- [Source: prd.md#FR41] - Otomasyon modu gösterimi
- [Source: epics.md#Epic-6-Story-6.3] - Automation Mode Indicator

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - Automation Mode Display Types**
   - Added AutomationModeDisplay interface with indicator, text, color fields
   - Added AUTOMATION_MODE_INDICATORS constant with [A], [M], [S] indicators
   - Turkish text: Otomatik, Manuel, Atla
   - Added StepStatusWithMode interface

2. **Task 2 - Format Methods**
   - Added formatAutomationModeIndicator() for colored mode indicator
   - Added formatStepStatusLineWithMode() combining status and mode
   - Manual mode highlighted in yellow, auto in green, skip in cyan

3. **Task 3 - Overview Methods**
   - Added renderStepStatusOverviewWithModes() for full overview
   - Added renderCompactStatusOverviewWithModes() without header
   - Added formatAutomationModeSummary() for mode counts
   - Summary format: "Mod: X otomatik, Y manuel"

4. **Task 4 - Tests**
   - 24 new tests for automation mode functionality
   - Tests for AUTOMATION_MODE_INDICATORS constant
   - Tests for all new methods
   - 589 total tests passing

### File List

- `src/cli/ui/terminal-ui.ts` (MODIFIED) - Added automation mode methods and types
- `src/cli/ui/index.ts` (MODIFIED) - Added new exports
- `tests/cli/ui/terminal-ui.test.ts` (MODIFIED) - 24 new tests

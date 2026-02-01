# Story 6.2: Step Status Overview

Status: done

## Story

As a **user**,
I want **to see the status of all BMAD steps**,
So that **I understand overall progress**.

## Acceptance Criteria

1. **Given** the workflow is running
   **When** I view the progress display
   **Then** I see all 12 steps with their status indicators

2. **Given** step statuses change
   **When** the display updates
   **Then** status indicators reflect current state

3. **Given** the overview is displayed
   **When** viewing
   **Then** completed steps show checkmark, in-progress shows spinner indicator, pending shows dash

## Tasks / Subtasks

- [x] Task 1: Add step status overview methods to TerminalUI (AC: #1, #2)
  - [x] Create renderStepStatusOverview() method
  - [x] Create formatStepStatusLine() method
  - [x] Support Map<BmadStepType, StepStatus> input

- [x] Task 2: Create status indicators (AC: #3)
  - [x] Completed: green checkmark
  - [x] In-progress: yellow dot
  - [x] Pending: gray dash
  - [x] Skipped: cyan skip icon

- [x] Task 3: Add progress summary (AC: #1)
  - [x] Show completed/total count
  - [x] Show percentage complete
  - [x] Display in Turkish

- [x] Task 4: Write tests
  - [x] Test all 12 steps display
  - [x] Test status indicators
  - [x] Test progress summary

## Dev Notes

### Architecture Compliance

Per FR40: Sistem tüm BMAD adımlarının durumunu gösterebilir

Display format:
```
BMAD Workflow Durumu
====================
[1] ✓ Fikir Geliştirme
[2] ✓ Araştırma
[3] ● Ürün Özeti (devam ediyor)
[4] - Gereksinimler
...
İlerleme: 2/12 (17%)
```

### PRD/Architecture References

- [Source: prd.md#FR40] - Adım durumu gösterimi
- [Source: epics.md#Epic-6-Story-6.2] - Step Status Overview

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - Step Status Overview Methods**
   - Added renderStepStatusOverview() for full overview with header and progress
   - Added formatStepStatusLine() for single line with status icon
   - Added renderCompactStatusOverview() for compact display without header
   - Added calculateProgress() to compute progress from status map
   - All methods support Map<BmadStepType, StepStatus> input

2. **Task 2 - Status Indicators**
   - Added STATUS_ICONS constant: pending (-), in-progress (●), completed (✓), skipped (○)
   - Icons are colored: gray for pending, yellow for in-progress, green for completed, cyan for skipped
   - In-progress steps show "(devam ediyor)" suffix

3. **Task 3 - Progress Summary**
   - renderStepStatusOverview() includes progress at bottom
   - Shows completed/total count and percentage
   - Added renderProgressBar() for visual progress bar [████░░░░]
   - All text in Turkish

4. **Task 4 - Tests**
   - 23 new tests for step status overview functionality
   - Tests for formatStepStatusLine(), calculateProgress()
   - Tests for renderStepStatusOverview(), renderCompactStatusOverview()
   - Tests for renderProgressBar() with custom widths
   - 565 total tests passing

### File List

- `src/cli/ui/terminal-ui.ts` (MODIFIED) - Added overview methods and STATUS_ICONS
- `src/cli/ui/index.ts` (MODIFIED) - Added STATUS_ICONS export
- `tests/cli/ui/terminal-ui.test.ts` (MODIFIED) - 23 new tests

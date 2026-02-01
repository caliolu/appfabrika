# Story 6.5: Completion Summary

Status: done

## Story

As a **user**,
I want **to see a summary when the project completes**,
So that **I know what was accomplished**.

## Acceptance Criteria

1. **Given** all BMAD steps complete successfully
   **When** the workflow finishes
   **Then** I see a completion summary with stats and next steps

2. **Given** the workflow completes with some skipped steps
   **When** viewing the summary
   **Then** I see which steps were completed and which were skipped

3. **Given** the summary is displayed
   **When** viewing
   **Then** I see execution time and next steps in Turkish

## Tasks / Subtasks

- [x] Task 1: Define completion summary types (AC: #1, #2)
  - [x] Add WorkflowSummary interface
  - [x] Add CompletionStats interface
  - [x] Add NextStep interface

- [x] Task 2: Create renderCompletionSummary method (AC: #1, #3)
  - [x] Show workflow completion header
  - [x] Display execution statistics
  - [x] List next steps in Turkish

- [x] Task 3: Add summary statistics formatting (AC: #2)
  - [x] Format completed steps count
  - [x] Format skipped steps count
  - [x] Format total duration

- [x] Task 4: Write tests
  - [x] Test summary rendering
  - [x] Test statistics formatting
  - [x] Test next steps display

## Dev Notes

### Architecture Compliance

Per FR43: Sistem tamamlama özeti gösterebilir

Summary format:
```
✨ BMAD Workflow Tamamlandı!
============================

📊 Özet:
   • Tamamlanan adımlar: 10/12
   • Atlanan adımlar: 2
   • Toplam süre: 5 dk 32 sn

📁 Çıktı dosyaları:
   • .appfabrika/outputs/step-01-brainstorming.md
   • ...

🚀 Sonraki Adımlar:
   1. Üretilen belgeleri inceleyin
   2. Projeyi GitHub'a yükleyin
   3. Geliştirmeye başlayın
```

### PRD/Architecture References

- [Source: prd.md#FR43] - Tamamlama özeti
- [Source: epics.md#Epic-6-Story-6.5] - Completion Summary

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - Completion Summary Types**
   - Added CompletionStats interface (counts, duration, timestamps)
   - Added NextStep interface (number, description)
   - Added WorkflowSummary interface (success, stats, files, nextSteps)
   - Added DEFAULT_NEXT_STEPS constant with 3 Turkish steps
   - Added SUMMARY_HEADERS constant with all Turkish headers

2. **Task 2 - Render Methods**
   - renderCompletionSummary() shows full summary with emoji headers
   - renderSuccessCompletion() for simple success message
   - renderFailureCompletion() for simple failure message
   - All text in Turkish

3. **Task 3 - Statistics Formatting**
   - formatDuration() converts ms to "X sa Y dk" or "X dk Y sn"
   - formatCompletionStats() formats all statistics with bullets
   - formatOutputFiles() lists files with bullet points
   - formatNextSteps() shows numbered list

4. **Task 4 - Tests**
   - 22 new tests for completion summary functionality
   - Tests for formatDuration, formatCompletionStats
   - Tests for renderCompletionSummary, success/failure variants
   - 645 total tests passing

### File List

- `src/cli/ui/terminal-ui.ts` (MODIFIED) - Added completion summary types and methods
- `src/cli/ui/index.ts` (MODIFIED) - Added new exports
- `tests/cli/ui/terminal-ui.test.ts` (MODIFIED) - 22 new tests

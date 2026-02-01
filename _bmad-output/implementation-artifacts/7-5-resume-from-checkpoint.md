# Story 7.5: Resume from Checkpoint

Status: done

## Story

As a **user**,
I want **to resume a failed project from where it stopped**,
So that **I don't have to start over**.

## Acceptance Criteria

1. **Given** a project was interrupted
   **When** I run `appfabrika run` again
   **Then** the system asks to resume and continues from last checkpoint

2. **Given** a resumable checkpoint exists
   **When** user chooses to resume
   **Then** workflow state is restored and execution continues

3. **Given** a resumable checkpoint exists
   **When** user chooses to start fresh
   **Then** checkpoint is cleared and workflow starts from beginning

## Tasks / Subtasks

- [x] Task 1: Create ResumeService (AC: #1, #2)
  - [x] Create src/services/resume-service.ts
  - [x] detectResumableState() - check for checkpoint
  - [x] getResumeInfo() - get checkpoint summary for user
  - [x] resumeWorkflow() - restore state and continue

- [x] Task 2: Implement state restoration (AC: #2)
  - [x] restoreStateMachine() - restore state machine
  - [x] restoreCompletedOutputs() - rebuild outputs map
  - [x] determineResumeStep() - find step to resume from

- [x] Task 3: Implement fresh start option (AC: #3)
  - [x] startFresh() - clear checkpoint and start over
  - [x] clearAllCheckpoints() - remove all checkpoint files

- [x] Task 4: Write tests
  - [x] Test resume detection
  - [x] Test state restoration
  - [x] Test fresh start functionality
  - [x] Test resume info formatting

## Dev Notes

### Architecture Compliance

Per NFR15: Yarida kalan projeler kaldigi yerden devam edebilmeli
Per FR38: Sistem hata durumunda projeyi kurtarma noktasindan devam ettirebilir

Resume flow:
```
1. Check for workflow-state.json in checkpoints dir
2. If found, show resume prompt:
   "Önceki çalışma yarıda kaldı (Adım 5/12 - UX Design)"
   "[D] Devam Et | [Y] Yeniden Başla"
3. If resume selected:
   - Load checkpoint
   - Restore state machine
   - Rebuild outputs map
   - Continue from failed step
4. If fresh start:
   - Clear all checkpoints
   - Start workflow from step 1
```

### PRD/Architecture References

- [Source: prd.md#FR38] - Sistem hata durumunda projeyi kurtarma noktasından devam ettirebilir
- [Source: architecture.md#NFR15] - Yarida kalan projeler kaldigi yerden devam edebilmeli
- [Source: epics.md#Epic-7-Story-7.5] - Resume from Checkpoint

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - ResumeService**
   - Created ResumeService class with singleton pattern
   - detectResumableState() checks for checkpoint existence
   - getResumeInfo() returns ResumeInfo with step details, error info
   - resumeWorkflow() restores state machine and returns outputs

2. **Task 2 - State Restoration**
   - restoreStateMachine() applies checkpoint statuses to state machine
   - Uses CheckpointService.restoreCompletedOutputs() for outputs
   - determineResumeStep() returns failed step or current step

3. **Task 3 - Fresh Start**
   - startFresh() clears all checkpoints and returns fresh result
   - clearAllCheckpoints() removes all JSON files in checkpoints dir
   - ResumeAction enum: RESUME, FRESH

4. **Task 4 - Tests**
   - 20 new tests for ResumeService
   - Tests for detect, resume, fresh start, formatting
   - 758 total tests passing

### File List

- `src/services/resume-service.ts` (NEW) - ResumeService implementation
- `src/services/index.ts` (MODIFIED) - Added ResumeService exports
- `tests/services/resume-service.test.ts` (NEW) - 20 tests

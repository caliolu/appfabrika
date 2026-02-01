# Story 5.2: Go Back to Previous Step

Status: done

## Story

As a **user**,
I want **to go back to a previous step**,
So that **I can revise earlier decisions**.

## Acceptance Criteria

1. **Given** I am on step N (where N > 1)
   **When** I select the back option [b]
   **Then** I return to step N-1

2. **Given** I go back to a step
   **When** the step is revisited
   **Then** the step is reset to pending for re-execution

3. **Given** I am on the first step
   **When** I try to go back
   **Then** the system shows an error message

## Tasks / Subtasks

- [x] Task 1: Implement goToPreviousStep (AC: #1)
  - [x] Add goToPreviousStep() to WorkflowController
  - [x] Update current step index
  - [x] Return to previous step

- [x] Task 2: Implement step reset (AC: #2)
  - [x] Reset previous step to pending
  - [x] Clear workflow completion status if needed

- [x] Task 3: Handle edge cases (AC: #3)
  - [x] Prevent going back from first step
  - [x] Return appropriate error message

- [x] Task 4: Write tests
  - [x] Test go back from non-first step
  - [x] Test step reset behavior
  - [x] Test first step edge case

## Dev Notes

### Architecture Compliance

Per FR22: Kullanıcı atlanan adıma geri dönebilir

WorkflowController.goToPreviousStep() uses WorkflowStateMachine.goToStep() to:
- Navigate to previous step
- Reset step to pending status

### PRD/Architecture References

- [Source: prd.md#FR22] - Geri dönme
- [Source: epics.md#Epic-5-Story-5.2] - Go Back to Previous Step

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Implemented in Story 5.1** - WorkflowController
   - goToPreviousStep() navigates to previous step
   - goToStep(index) allows jumping to specific step
   - Uses WorkflowStateMachine.goToStep() for state management
   - Returns ActionResult with success/failure info

2. **Tests**
   - Tests for going back from non-first step
   - Tests for step reset to pending
   - Tests for first step edge case
   - All functionality covered in workflow-controller.test.ts

### File List

- `src/services/workflow-controller.ts` (EXISTING) - goToPreviousStep(), goToStep()
- `tests/services/workflow-controller.test.ts` (EXISTING) - Related tests

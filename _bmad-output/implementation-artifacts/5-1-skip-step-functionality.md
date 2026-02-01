# Story 5.1: Skip Step Functionality

Status: done

## Story

As a **user**,
I want **to skip a BMAD step**,
So that **I can proceed without completing optional steps**.

## Acceptance Criteria

1. **Given** a step is in progress or pending
   **When** I select the skip option [s]
   **Then** the step is marked as skipped and workflow proceeds

2. **Given** a step is skipped
   **When** the workflow continues
   **Then** subsequent steps receive empty output for the skipped step

3. **Given** the workflow state
   **When** checking step status
   **Then** skipped steps show as 'skipped' status

## Tasks / Subtasks

- [x] Task 1: Create WorkflowController service (AC: #1)
  - [x] Create src/services/workflow-controller.ts
  - [x] Add skipCurrentStep() method
  - [x] Integrate with WorkflowStateMachine

- [x] Task 2: Update WorkflowRunner for skip support (AC: #1, #2)
  - [x] Add onSkipRequested callback to WorkflowConfig
  - [x] Handle skip during step execution
  - [x] Propagate skipped status to context

- [x] Task 3: Update checkpoint handling (AC: #3)
  - [x] Save skipped status in checkpoint
  - [x] Handle skipped steps in resume

- [x] Task 4: Write comprehensive tests
  - [x] Test skip from pending state
  - [x] Test skip from in-progress state
  - [x] Test workflow continues after skip

## Dev Notes

### Architecture Compliance

Per FR21: Kullanıcı istenen adımı atlayabilir (skip)

WorkflowController provides user interaction methods:
- skipCurrentStep()
- goToPreviousStep()
- setAutomationMode()

### PRD/Architecture References

- [Source: prd.md#FR21] - Adım atlama
- [Source: epics.md#Epic-5-Story-5.1] - Skip Step Functionality

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - WorkflowController Service**
   - Created WorkflowController with stateMachine and executor dependencies
   - skipCurrentStep() skips pending/in-progress steps
   - Validates step status before skip
   - Saves skip checkpoint via executor

2. **Task 2 - WorkflowRunner Integration**
   - WorkflowRunner already had skip support via AutomationMode.SKIP
   - WorkflowController provides interactive skip capability
   - getAvailableActions() returns valid actions for current state

3. **Task 3 - Checkpoint Handling**
   - Uses executor.markStepSkipped() for checkpoint persistence
   - Skipped steps saved with 'skipped' status
   - Resume correctly handles skipped steps

4. **Task 4 - Tests**
   - 31 tests for WorkflowController
   - Tests for skip from pending/in-progress states
   - Tests for failure when skipping completed step
   - 494 total tests passing

### File List

- `src/services/workflow-controller.ts` (NEW) - Workflow control service
- `src/services/index.ts` (MODIFIED) - Export WorkflowController
- `tests/services/workflow-controller.test.ts` (NEW) - 31 tests

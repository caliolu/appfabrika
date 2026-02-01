# Story 4.8: Sequential Step Execution

Status: done

## Story

As a **system**,
I want **to execute steps in order**,
So that **each step builds on previous outputs**.

## Acceptance Criteria

1. **Given** a multi-step workflow
   **When** the workflow runs
   **Then** steps execute in order (1 through 12)

2. **Given** previous steps have outputs
   **When** a later step executes
   **Then** it receives all previous outputs as context

3. **Given** a step fails
   **When** the workflow is restarted
   **Then** it resumes from the failed step with previous outputs intact

## Tasks / Subtasks

- [x] Task 1: Create WorkflowRunner service (AC: #1)
  - [x] Create src/services/workflow-runner.ts
  - [x] Implement runWorkflow method that iterates through all steps
  - [x] Integrate with StepExecutor for execution

- [x] Task 2: Implement context building (AC: #2)
  - [x] Build previousOutputs map from checkpoints
  - [x] Pass full context to each step
  - [x] Update context after each step completes

- [x] Task 3: Implement resume capability (AC: #3)
  - [x] Detect completed steps from checkpoints
  - [x] Skip already completed steps
  - [x] Resume from first incomplete step

- [x] Task 4: Write comprehensive tests
  - [x] Test sequential execution
  - [x] Test context propagation
  - [x] Test resume from checkpoint

## Dev Notes

### Architecture Compliance

Per FR18: Sistem BMAD adımlarını sıralı olarak yürütebilir

The WorkflowRunner orchestrates step execution:

```typescript
interface WorkflowRunner {
  runWorkflow(config: WorkflowConfig): Promise<WorkflowResult>;
  resumeWorkflow(projectPath: string): Promise<WorkflowResult>;
  getProgress(): WorkflowProgress;
}
```

### PRD/Architecture References

- [Source: prd.md#FR18] - Sıralı yürütme
- [Source: architecture.md#Layer-Orchestration] - WorkflowService
- [Source: epics.md#Epic-4-Story-4.8] - Sequential Step Execution

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - WorkflowRunner Service**
   - Created WorkflowRunner class with constructor taking stateMachine, executor, registry
   - Implemented runWorkflow() method that iterates through BMAD_STEPS array
   - Integrated with StepExecutor.executeStep() for actual execution
   - Added WorkflowConfig and WorkflowResult interfaces
   - Added singleton pattern with getWorkflowRunner/resetWorkflowRunner

2. **Task 2 - Context Building**
   - Loads existing checkpoints at workflow start
   - Maintains outputs Map that accumulates as steps complete
   - Passes full context with previousOutputs to each step
   - Updates context after each successful step

3. **Task 3 - Resume Capability**
   - resumeWorkflow() loads checkpoint metadata
   - Restores state machine state from checkpoints
   - Skips completed/skipped steps automatically
   - Continues from first incomplete step

4. **Task 4 - Tests**
   - 18 new tests for WorkflowRunner
   - Tests for sequential execution order
   - Tests for context propagation (previousOutputs growth)
   - Tests for resume from checkpoint
   - Tests for failure handling
   - Tests for callbacks (onStepComplete, onProgress)
   - 444 total tests passing

### File List

- `src/services/workflow-runner.ts` (NEW) - WorkflowRunner service
- `src/services/index.ts` (MODIFIED) - Export WorkflowRunner
- `tests/services/workflow-runner.test.ts` (NEW) - 18 tests

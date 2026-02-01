# Story 7.4: Checkpoint Save on Error

Status: done

## Story

As a **system**,
I want **to save progress when errors occur**,
So that **work is not lost**.

## Acceptance Criteria

1. **Given** an unrecoverable error occurs
   **When** the workflow stops
   **Then** current state is saved to checkpoint

2. **Given** an error checkpoint is saved
   **When** viewing the checkpoint
   **Then** it contains: project info, current step, all outputs, error details

3. **Given** partial step output exists
   **When** an error occurs mid-step
   **Then** the partial output is preserved in checkpoint

## Tasks / Subtasks

- [x] Task 1: Create CheckpointService (AC: #1, #2)
  - [x] Create src/services/checkpoint-service.ts
  - [x] Define CheckpointData interface
  - [x] saveErrorCheckpoint() - save full workflow state on error
  - [x] loadLatestCheckpoint() - load for resume
  - [x] getCheckpointPath() - return checkpoint file path

- [x] Task 2: Implement workflow state snapshot (AC: #2, #3)
  - [x] WorkflowSnapshot interface (project, step, outputs, error)
  - [x] captureWorkflowState() - create snapshot from current state
  - [x] createPartialOutput() - save incomplete step output

- [x] Task 3: Integrate with error handling (AC: #1)
  - [x] onErrorSaveCheckpoint() - callback for retry service
  - [x] Update exports in services/index.ts

- [x] Task 4: Write tests
  - [x] Test checkpoint saving on error
  - [x] Test partial output preservation
  - [x] Test checkpoint loading
  - [x] Test workflow snapshot creation

## Dev Notes

### Architecture Compliance

Per NFR14: Proje durumu her adımda kaydedilmeli (crash recovery)
Per NFR15: Yarida kalan projeler kaldigi yerden devam edebilmeli
Per ADR-002: Hybrid State Persistence (JSON + Checkpoint files)

Checkpoint structure (ADR-002 compliant):
```
.appfabrika/
  checkpoints/
    workflow-state.json     # Full workflow snapshot on error
    step-XX-name.json       # Individual step checkpoints
```

WorkflowSnapshot format:
```typescript
interface WorkflowSnapshot {
  version: '1.0.0';
  savedAt: string;          // ISO 8601
  projectInfo: {
    projectPath: string;
    projectIdea: string;
    llmProvider: LLMProvider;
    automationTemplate: AutomationTemplate;
  };
  currentStep: BmadStepType;
  stepStatuses: Map<BmadStepType, StepStatus>;
  completedOutputs: Map<BmadStepType, StepOutput>;
  partialOutput?: {
    stepId: BmadStepType;
    content: string;
  };
  error?: {
    code: string;
    message: string;
    stepId: BmadStepType;
    retryCount: number;
  };
}
```

### PRD/Architecture References

- [Source: prd.md#FR38] - Sistem hata durumunda projeyi kurtarma noktasından devam ettirebilir
- [Source: architecture.md#ADR-002] - Hybrid State Persistence
- [Source: epics.md#Epic-7-Story-7.4] - Checkpoint Save on Error

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - CheckpointService**
   - Created CheckpointService class with singleton pattern
   - CheckpointServiceConfig for configuration
   - saveErrorCheckpoint() saves full workflow state
   - loadLatestCheckpoint() loads checkpoint for resume
   - getCheckpointPath() returns workflow-state.json path

2. **Task 2 - Workflow Snapshot**
   - WorkflowSnapshot interface with version, projectInfo, stepStatuses, completedOutputs
   - captureWorkflowState() creates snapshot from Maps
   - createPartialOutput() for interrupted step content
   - createErrorInfo() extracts error details
   - StepStatusEntry/StepOutputEntry for JSON serialization

3. **Task 3 - Error Handling Integration**
   - onErrorSaveCheckpoint() callback for retry service integration
   - restoreStepStatuses() and restoreCompletedOutputs() for resume
   - hasResumableCheckpoint() checks if resume is possible
   - clearCheckpoint() removes checkpoint after successful resume

4. **Task 4 - Tests**
   - 27 new tests for CheckpointService
   - Tests for all capture, save, load, restore methods
   - Tests for error info and partial output creation
   - 738 total tests passing

### File List

- `src/services/checkpoint-service.ts` (NEW) - CheckpointService implementation
- `src/services/index.ts` (MODIFIED) - Added CheckpointService exports
- `tests/services/checkpoint-service.test.ts` (NEW) - 27 tests

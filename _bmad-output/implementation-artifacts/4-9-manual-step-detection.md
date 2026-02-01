# Story 4.9: Manual Step Detection

Status: done

## Story

As a **system**,
I want **to detect manually completed steps**,
So that **the workflow can continue from where the user left off**.

## Acceptance Criteria

1. **Given** a step marked as manual
   **When** the user completes it outside the CLI
   **Then** the system detects the output file exists and proceeds

2. **Given** a manual step with expected output file
   **When** the workflow reaches that step
   **Then** the system checks for the output file before prompting

3. **Given** a manual output file is detected
   **When** the workflow processes it
   **Then** the content is loaded and used as step output

## Tasks / Subtasks

- [x] Task 1: Define manual step output file patterns (AC: #1)
  - [x] Define expected output paths per step
  - [x] Create ManualStepDetector class
  - [x] Add file existence checking

- [x] Task 2: Implement output file detection (AC: #2)
  - [x] Check for output files before step execution
  - [x] Integrate with WorkflowRunner
  - [x] Handle MANUAL automation mode

- [x] Task 3: Implement content loading (AC: #3)
  - [x] Read manual output file content
  - [x] Create StepOutput from file content
  - [x] Save as checkpoint for consistency

- [x] Task 4: Write comprehensive tests
  - [x] Test file pattern matching
  - [x] Test manual step detection
  - [x] Test content loading and checkpoint creation

## Dev Notes

### Architecture Compliance

Per FR20: Sistem manuel tamamlanan adımları algılayıp sonraki adıma geçebilir

Manual output files expected at:
```
.appfabrika/outputs/step-01-brainstorming.md
.appfabrika/outputs/step-02-research.md
...
```

### PRD/Architecture References

- [Source: prd.md#FR20] - Manuel adım algılama
- [Source: epics.md#Epic-4-Story-4.9] - Manual Step Detection

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - ManualStepDetector Class**
   - Created ManualStepDetector class with projectPath and outputsDir
   - Output path pattern: .appfabrika/outputs/{stepId}.md
   - hasManualOutput() for quick existence check
   - getOutputPath() for path generation

2. **Task 2 - Output File Detection**
   - detectManualStep() returns detection result with file info
   - Integrated with WorkflowRunner in MANUAL mode
   - Checks for manual output before executing step
   - onManualStepDetected callback added to WorkflowConfig

3. **Task 3 - Content Loading**
   - loadManualOutput() returns StepOutput with content and metadata
   - Metadata includes source: 'manual', detectedAt, originalModifiedAt
   - detectAllManualSteps() for bulk detection
   - Saves manual output as checkpoint for consistency

4. **Task 4 - Tests**
   - 19 new tests for ManualStepDetector
   - Tests for file detection and loading
   - Tests for singleton pattern
   - 463 total tests passing

### File List

- `src/services/manual-step-detector.ts` (NEW) - Manual step detection service
- `src/services/workflow-runner.ts` (MODIFIED) - Manual step integration
- `src/services/index.ts` (MODIFIED) - Export ManualStepDetector
- `tests/services/manual-step-detector.test.ts` (NEW) - 19 tests

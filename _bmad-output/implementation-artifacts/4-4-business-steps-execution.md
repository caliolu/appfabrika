# Story 4.4: Business Steps Execution

Status: done

## Story

As a **user**,
I want **the system to execute business BMAD steps (1-4)**,
So that **my idea is analyzed and documented**.

## Acceptance Criteria

1. **Given** the workflow has started
   **When** business steps execute
   **Then** Brainstorming, Research, Product Brief, and PRD steps complete

2. **Given** a business step is started
   **When** the step handler is called
   **Then** the prompt template is loaded and filled with context

3. **Given** the step prompt is ready
   **When** executed via Claude Code
   **Then** the output is captured and returned

4. **Given** step execution completes
   **When** the output is processed
   **Then** it is saved to the appropriate checkpoint file

5. **Given** previous steps have outputs
   **When** a subsequent step runs
   **Then** those outputs are included in the step context

## Tasks / Subtasks

- [x] Task 1: Create step executor service (AC: #1, #2, #3)
  - [x] Create StepExecutor class in services/
  - [x] Implement loadPromptTemplate(stepId) method
  - [x] Implement fillTemplate(template, context) method
  - [x] Implement executeStep(stepId, context) method

- [x] Task 2: Implement prompt template loading (AC: #2)
  - [x] Read template from templates/step-XX-name.md
  - [x] Handle template not found errors
  - [x] Support template variables ({{projectIdea}}, {{previousOutput}}, etc.)

- [x] Task 3: Implement template variable substitution (AC: #2, #5)
  - [x] Replace {{projectIdea}} with user's idea
  - [x] Replace {{previousOutputs}} with relevant previous step outputs
  - [x] Replace {{stepName}} with current step's Turkish name
  - [x] Replace {{previousOutput.stepId}} with specific step output

- [x] Task 4: Implement checkpoint persistence (AC: #4)
  - [x] Save step output to .appfabrika/checkpoints/step-XX-name.json
  - [x] Include metadata (executedAt, duration, success)
  - [x] Load previous checkpoints for context
  - [x] Implement loadAllCheckpoints() for context building

- [x] Task 5: Create basic prompt templates (AC: #2)
  - [x] Create templates/step-01-brainstorming.md
  - [x] Create templates/step-02-research.md
  - [x] Create templates/step-03-product-brief.md
  - [x] Create templates/step-04-prd.md

- [x] Task 6: Add types for step execution (AC: #4, #5)
  - [x] Add StepExecutionContext interface
  - [x] Add StepCheckpoint interface
  - [x] Add EXECUTOR_ERRORS constant

- [x] Task 7: Write unit tests
  - [x] Test template loading
  - [x] Test template variable substitution
  - [x] Test step execution with mock Claude Code
  - [x] Test checkpoint persistence
  - [x] Test context building from previous outputs
  - [x] Target: 25+ tests (achieved: 25 tests)

- [x] Task 8: Update exports and verify
  - [x] Export StepExecutor from services/index.ts
  - [x] Verify `npm run build` succeeds
  - [x] All tests pass (401 total)

## Dev Notes

### Previous Story Learnings (Story 4.3)

From Story 4.3 Implementation:
- ClaudeCodeAdapter.executeStep(stepId, prompt) executes via Claude Code
- Returns StepOutput with content and metadata
- Prompt written to .appfabrika/{stepId}-prompt.md
- Turkish error messages maintained

### Architecture Compliance

This story extends the **Orchestration Layer**:

```
[Orchestration Layer]
    └── services/
        ├── index.ts                      ← UPDATE
        ├── workflow-state-machine.ts     ← EXISTING
        ├── bmad-step-registry.ts         ← EXISTING
        └── step-executor.ts              ← NEW
```

### Technical Requirements

**StepExecutor Class:**

```typescript
class StepExecutor {
  constructor(
    registry: BmadStepRegistry,
    claudeCode: ClaudeCodeAdapter,
    projectPath: string
  );

  // Template operations
  loadPromptTemplate(stepId: BmadStepType): Promise<string>;
  fillTemplate(template: string, context: StepExecutionContext, stepId: BmadStepType): string;

  // Execution
  executeStep(stepId: BmadStepType, context: StepExecutionContext): Promise<StepOutput>;

  // Checkpoint operations
  saveCheckpoint(stepId: BmadStepType, output: StepOutput): Promise<void>;
  loadCheckpoint(stepId: BmadStepType): Promise<StepOutput | null>;
  loadAllCheckpoints(): Promise<Map<BmadStepType, StepOutput>>;
}
```

**Template Variables:**

| Variable | Description |
|----------|-------------|
| `{{projectIdea}}` | User's original project idea |
| `{{stepName}}` | Current step's Turkish name |
| `{{previousOutput.stepId}}` | Output from specific previous step |
| `{{allPreviousOutputs}}` | Formatted string of all previous outputs |

### Library/Framework Requirements

| Package | Version | Usage |
|---------|---------|-------|
| No new packages | - | Uses existing fs/promises |

### PRD/Architecture References

- [Source: architecture.md#ADR-002] - Hybrid State Persistence
- [Source: prd.md#FR6-9] - Business BMAD steps (Brainstorming, Research, Brief, PRD)
- [Source: prd.md#FR19] - Step output persistence
- [Source: epics.md#Epic-4-Story-4.4] - Business Steps Execution

### File Structure

```
src/
├── types/
│   └── step.types.ts             ← UPDATED (StepExecutionContext, StepCheckpoint, EXECUTOR_ERRORS)
├── services/
│   ├── index.ts                  ← UPDATED
│   └── step-executor.ts          ← NEW
templates/
├── step-01-brainstorming.md      ← NEW
├── step-02-research.md           ← NEW
├── step-03-product-brief.md      ← NEW
└── step-04-prd.md                ← NEW
tests/
└── services/
    └── step-executor.test.ts     ← NEW (25 tests)
```

### Turkish Error Messages

```typescript
const EXECUTOR_ERRORS = {
  TEMPLATE_NOT_FOUND: 'Şablon bulunamadı: {stepId}',
  TEMPLATE_READ_FAILED: 'Şablon okunamadı: {path}',
  CHECKPOINT_WRITE_FAILED: 'Checkpoint yazılamadı: {stepId}',
  CHECKPOINT_READ_FAILED: 'Checkpoint okunamadı: {stepId}',
};
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - Step Executor Service**
   - Created `src/services/step-executor.ts`
   - StepExecutor class with template loading, filling, and execution
   - Integrated with BmadStepRegistry and ClaudeCodeAdapter

2. **Task 2 - Template Loading**
   - Templates loaded from `templates/` directory relative to package
   - ENOENT errors converted to Turkish "Şablon bulunamadı" message
   - Other read errors converted to "Şablon okunamadı" message

3. **Task 3 - Template Variable Substitution**
   - {{projectIdea}} - User's project idea
   - {{stepName}} - Turkish step name from BMAD_STEP_NAMES
   - {{allPreviousOutputs}} - Formatted markdown of all previous outputs
   - {{previousOutput.stepId}} - Specific step's output content

4. **Task 4 - Checkpoint Persistence**
   - Checkpoints saved to `.appfabrika/checkpoints/{stepId}.json`
   - StepCheckpoint structure: stepId, executedAt, duration, success, output
   - loadCheckpoint returns null for non-existent files
   - loadAllCheckpoints iterates all registered steps

5. **Task 5 - Prompt Templates**
   - step-01-brainstorming.md - Beyin fırtınası şablonu
   - step-02-research.md - Araştırma şablonu (uses previousOutput)
   - step-03-product-brief.md - Ürün özeti şablonu (uses allPreviousOutputs)
   - step-04-prd.md - PRD şablonu (uses allPreviousOutputs)

6. **Task 6 - Types**
   - Added StepExecutionContext interface (projectPath, projectIdea, previousOutputs)
   - Added StepCheckpoint interface
   - Added EXECUTOR_ERRORS constant with Turkish messages

7. **Task 7 - Unit Tests**
   - 25 tests in step-executor.test.ts
   - Tests cover: constructor, loadPromptTemplate, fillTemplate (all variables), saveCheckpoint, loadCheckpoint, loadAllCheckpoints, executeStep, singleton

8. **Task 8 - Build & Verify**
   - `npm run build` succeeds
   - 401 tests pass (25 new for this story)
   - Exported from services/index.ts

### File List

- `src/types/step.types.ts` (MODIFIED) - Added StepExecutionContext, StepCheckpoint, EXECUTOR_ERRORS
- `src/services/step-executor.ts` (NEW) - StepExecutor class
- `src/services/index.ts` (MODIFIED) - Added StepExecutor export
- `templates/step-01-brainstorming.md` (NEW) - Brainstorming template
- `templates/step-02-research.md` (NEW) - Research template
- `templates/step-03-product-brief.md` (NEW) - Product Brief template
- `templates/step-04-prd.md` (NEW) - PRD template
- `tests/services/step-executor.test.ts` (NEW) - 25 tests

## Senior Developer Review (AI)

**Review Date:** 2026-02-01
**Review Outcome:** Approved with Minor Fixes

### Issues Found and Addressed

1. **[M2] saveCheckpoint swallows original error** - FIXED
   - Now includes original error message in thrown error
   - Format: "Checkpoint yazılamadı: {stepId} (original error message)"

2. **[L1] loadCheckpoint error handling improved** - FIXED
   - Now includes original error message for JSON parse and other errors
   - ENOENT still returns null as expected

3. **Accepted as-is:**
   - [M1] loadAllCheckpoints uses sync existsSync - Acceptable for directory existence check

### Post-Review Verification

- `npm run build` succeeds
- 401 tests pass
- All code review fixes applied


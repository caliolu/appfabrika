# Story 4.1: Workflow State Machine

Status: done

## Story

As a **system**,
I want **a state machine to manage BMAD workflow**,
So that **step execution is controlled and predictable**.

## Acceptance Criteria

1. **Given** the ADR-004 State Machine decision
   **When** the workflow starts
   **Then** state machine tracks: current step, step status, automation mode

2. **Given** an initialized workflow
   **When** a step transitions occur
   **Then** valid state transitions are enforced (pending → in-progress → completed/skipped)

3. **Given** workflow is in progress
   **When** state is queried
   **Then** current step, all step statuses, and automation modes are returned

4. **Given** any state change
   **When** the change is applied
   **Then** event callbacks are triggered for listeners

5. **Given** invalid state transition attempt
   **When** transition is requested
   **Then** error is thrown with clear message in Turkish

## Tasks / Subtasks

- [x] Task 1: Define workflow state types (AC: #1, #3)
  - [x] Create WorkflowState interface (currentStep, steps, automationMode)
  - [x] Create StepState interface (stepId, status, automationMode, timestamps)
  - [x] Create StepStatus enum (pending, in-progress, completed, skipped)
  - [x] Create AutomationMode enum (auto, manual)
  - [x] Export types via types/index.ts

- [x] Task 2: Implement WorkflowStateMachine class (AC: #1, #2)
  - [x] Create WorkflowStateMachine class in services/workflow-state-machine.ts
  - [x] Implement constructor with initial state from BMAD_STEPS
  - [x] Implement getCurrentStep() method
  - [x] Implement getStepState(stepId) method
  - [x] Implement getAllStepStates() method

- [x] Task 3: Implement state transitions (AC: #2, #5)
  - [x] Implement startStep(stepId) - transitions to in-progress
  - [x] Implement completeStep(stepId) - transitions to completed
  - [x] Implement skipStep(stepId) - transitions to skipped
  - [x] Implement goToStep(stepId) - navigate to specific step
  - [x] Add transition validation with Turkish error messages

- [x] Task 4: Implement automation mode control (AC: #1, #3)
  - [x] Implement setStepAutomationMode(stepId, mode)
  - [x] Implement setGlobalAutomationMode(mode) - affects all steps
  - [x] Implement getAutomationMode(stepId)

- [x] Task 5: Implement event system (AC: #4)
  - [x] Create WorkflowEvent type (step-started, step-completed, step-skipped, mode-changed)
  - [x] Implement on(event, callback) method
  - [x] Implement off(event, callback) method
  - [x] Trigger events on all state changes

- [x] Task 6: Write unit tests
  - [x] Test initial state setup (12 steps in pending)
  - [x] Test valid transitions (pending → in-progress → completed)
  - [x] Test invalid transitions throw errors
  - [x] Test skip functionality
  - [x] Test goToStep navigation
  - [x] Test automation mode setting
  - [x] Test event callbacks
  - [x] Target: 25+ tests (achieved: 48 tests)

- [x] Task 7: Update exports and verify
  - [x] Export from services/index.ts
  - [x] Verify `npm run build` succeeds
  - [x] All tests pass (328 total)

## Dev Notes

### Previous Story Learnings (Epic 3)

From Epic 3 Implementation:
- BmadStepType enum already exists with all 12 steps (step-01 through step-12)
- BMAD_STEPS array provides ordered list of all steps
- BMAD_STEP_NAMES provides Turkish display names
- Use consistent naming patterns: kebab-case files, PascalCase classes, camelCase functions
- Turkish messages for user-facing errors maintained throughout

### Architecture Compliance

This story creates the **Orchestration Layer** foundation:

```
[Orchestration Layer]
    └── services/
        ├── index.ts                      ← UPDATE exports
        ├── workflow-state-machine.ts     ← NEW
        └── workflow.types.ts             ← NEW (or in types/)
```

Per ADR-004: State Machine for workflow management
- Explicit state tanımları hata azaltır
- Visualization ve debug kolaylığı
- 12 adım + 4 şablon + dinamik geçiş = karmaşık state

### Technical Requirements

**StepStatus Enum:**

```typescript
enum StepStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
}
```

**AutomationMode Enum:**

```typescript
enum AutomationMode {
  AUTO = 'auto',
  MANUAL = 'manual',
}
```

**StepState Interface:**

```typescript
interface StepState {
  stepId: BmadStepType;
  status: StepStatus;
  automationMode: AutomationMode;
  startedAt?: string;       // ISO 8601
  completedAt?: string;     // ISO 8601
  error?: {
    code: string;
    message: string;
    retryCount: number;
  };
}
```

**WorkflowState Interface:**

```typescript
interface WorkflowState {
  currentStepIndex: number;
  steps: Map<BmadStepType, StepState>;
  globalAutomationMode: AutomationMode;
  startedAt?: string;
  completedAt?: string;
}
```

**WorkflowStateMachine Class:**

```typescript
class WorkflowStateMachine {
  private state: WorkflowState;
  private listeners: Map<WorkflowEventType, Set<WorkflowEventCallback>>;

  constructor(automationMode: AutomationMode = AutomationMode.AUTO);

  // State queries
  getCurrentStep(): BmadStepType;
  getStepState(stepId: BmadStepType): StepState;
  getAllStepStates(): StepState[];
  isComplete(): boolean;

  // Transitions
  startStep(stepId: BmadStepType): void;
  completeStep(stepId: BmadStepType): void;
  skipStep(stepId: BmadStepType): void;
  goToStep(stepId: BmadStepType): void;

  // Automation control
  setStepAutomationMode(stepId: BmadStepType, mode: AutomationMode): void;
  setGlobalAutomationMode(mode: AutomationMode): void;

  // Events
  on(event: WorkflowEventType, callback: WorkflowEventCallback): void;
  off(event: WorkflowEventType, callback: WorkflowEventCallback): void;
}
```

**Valid State Transitions:**

```
pending → in-progress (via startStep)
in-progress → completed (via completeStep)
in-progress → skipped (via skipStep)
pending → skipped (via skipStep - can skip without starting)
skipped → pending (via goToStep - allows revisiting skipped steps)
completed → pending (via goToStep - allows re-running completed steps)
```

**Invalid Transitions (throw error):**

```
completed → in-progress (must go through pending first)
skipped → in-progress (must go through pending first)
```

### Library/Framework Requirements

| Package | Version | Usage |
|---------|---------|-------|
| No new packages | - | Uses built-in TypeScript Map and Set |

### PRD/Architecture References

- [Source: architecture.md#ADR-004] - State Machine for otomasyon yönetimi
- [Source: architecture.md#BMAD-Step-Patterns] - Step identifiers and state structure
- [Source: prd.md#FR18] - BMAD adımlarını sıralı olarak yürütme
- [Source: prd.md#FR27-29] - Per-step automation control
- [Source: epics.md#Epic-4-Story-4.1] - Workflow State Machine requirements

### File Structure

```
src/
├── types/
│   ├── index.ts              ← UPDATE: export workflow.types
│   └── workflow.types.ts     ← NEW: StepState, WorkflowState, enums
├── services/
│   ├── index.ts              ← NEW: barrel export
│   └── workflow-state-machine.ts  ← NEW: WorkflowStateMachine class
tests/
└── services/
    └── workflow-state-machine.test.ts  ← NEW: 25+ tests
```

### Turkish Error Messages

```typescript
const WORKFLOW_ERRORS = {
  INVALID_TRANSITION: 'Geçersiz durum geçişi: {from} → {to}',
  STEP_NOT_FOUND: 'Adım bulunamadı: {stepId}',
  ALREADY_IN_PROGRESS: 'Bu adım zaten işleniyor: {stepId}',
  WORKFLOW_COMPLETED: 'Workflow zaten tamamlandı',
};
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - Workflow State Types**
   - Created `src/types/workflow.types.ts` with StepStatus and AutomationMode enums
   - Created StepState and WorkflowState interfaces
   - Created WorkflowEventType enum and WorkflowEvent interface
   - Added WORKFLOW_ERRORS constant with Turkish messages
   - Exported via `src/types/index.ts`

2. **Task 2 - WorkflowStateMachine Class**
   - Created `src/services/workflow-state-machine.ts`
   - Constructor initializes 12 steps in PENDING state
   - Implemented getCurrentStep(), getStepState(), getAllStepStates()
   - Added isComplete() and isStarted() helper methods

3. **Task 3 - State Transitions**
   - startStep() - validates PENDING status, transitions to IN_PROGRESS
   - completeStep() - validates IN_PROGRESS status, transitions to COMPLETED
   - skipStep() - works from PENDING or IN_PROGRESS to SKIPPED
   - goToStep() - resets COMPLETED/SKIPPED steps to PENDING for re-execution
   - Turkish error messages for all invalid transitions

4. **Task 4 - Automation Mode Control**
   - setStepAutomationMode() - sets mode for individual step
   - setGlobalAutomationMode() - sets mode for all PENDING steps
   - getAutomationMode() - retrieves step's current mode

5. **Task 5 - Event System**
   - WorkflowEventType: STEP_STARTED, STEP_COMPLETED, STEP_SKIPPED, STEP_RESET, MODE_CHANGED, WORKFLOW_STARTED, WORKFLOW_COMPLETED
   - on()/off() methods for subscribing/unsubscribing
   - Events emitted on all state changes
   - Callback errors handled gracefully

6. **Task 6 - Unit Tests**
   - Created `tests/services/workflow-state-machine.test.ts`
   - 49 tests covering all functionality
   - Test groups: initialization, state queries, startStep, completeStep, skipStep, goToStep, automation mode, event system, singleton

7. **Task 7 - Build & Verify**
   - `npm run build` succeeds
   - 329 tests pass (49 new for this story)

## Senior Developer Review (AI)

**Review Date:** 2026-01-31
**Review Outcome:** Approved with Minor Fixes

### Issues Found and Addressed

1. **[M2] goToStep didn't emit an event** - FIXED
   - Added STEP_RESET event type
   - goToStep now emits event when resetting step
   - Added test for step-reset event

2. **[L1] Unused type import** - FIXED
   - Removed unused WorkflowEvent type import from test file

3. **Remaining (deferred to future stories):**
   - [M1] Serialization methods for state persistence → Story 4.7
   - [M3] Sequential order enforcement → Optional strict mode for future
   - [L3] Silent error swallowing in emit() → Consider for debugging

### File List

- `src/types/workflow.types.ts` (NEW) - Workflow state type definitions
- `src/types/index.ts` (MODIFIED) - Added workflow.types export
- `src/services/workflow-state-machine.ts` (NEW) - WorkflowStateMachine class
- `src/services/index.ts` (NEW) - Services barrel export
- `tests/services/workflow-state-machine.test.ts` (NEW) - 49 tests

# Story 5.3: Per-Step Automation Control

Status: done

## Story

As a **user**,
I want **to set automation mode for each step individually**,
So that **I have fine-grained control over the workflow**.

## Acceptance Criteria

1. **Given** I am running the workflow
   **When** I view the current step
   **Then** I see [m] to switch to manual and [a] to switch to auto

2. **Given** a step has automation mode set
   **When** the workflow executes that step
   **Then** it uses the configured mode

3. **Given** I set automation for a specific step
   **When** the mode is changed
   **Then** only that step is affected

## Tasks / Subtasks

- [x] Task 1: Implement per-step automation setting (AC: #1, #3)
  - [x] Add setStepAutomation() to WorkflowController
  - [x] Add setCurrentStepAutomation() for convenience
  - [x] Return available actions based on current mode

- [x] Task 2: Integrate with workflow execution (AC: #2)
  - [x] WorkflowStateMachine tracks per-step automation
  - [x] WorkflowRunner uses step automation mode

- [x] Task 3: Provide helper methods (AC: #1)
  - [x] switchToManual() shortcut
  - [x] switchToAuto() shortcut
  - [x] getAvailableActions() shows mode options

- [x] Task 4: Write tests
  - [x] Test setting manual mode
  - [x] Test setting auto mode
  - [x] Test available actions reflect current mode

## Dev Notes

### Architecture Compliance

Per FR27: Kullanıcı her BMAD adımı için ayrı ayrı otomasyon/manuel seçimi yapabilir

WorkflowController provides:
- setStepAutomation(stepId, mode)
- setCurrentStepAutomation(mode)
- switchToManual() / switchToAuto()
- getAvailableActions() returns MANUAL or AUTO based on current mode

### PRD/Architecture References

- [Source: prd.md#FR27] - Per-step automation
- [Source: epics.md#Epic-5-Story-5.3] - Per-Step Automation Control

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Implemented in Story 5.1** - WorkflowController
   - setCurrentStepAutomation(mode) sets mode for current step
   - setStepAutomation(stepId, mode) sets mode for specific step
   - Uses WorkflowStateMachine.setStepAutomationMode()
   - Returns ActionResult with Turkish success message

2. **Integration**
   - WorkflowStateMachine tracks per-step automation mode
   - WorkflowRunner checks stepState.automationMode before execution
   - Mode affects whether step is auto-executed or manual detected

3. **Tests**
   - Tests for setting manual mode
   - Tests for setting auto mode
   - Tests for getAvailableActions() showing correct options

### File List

- `src/services/workflow-controller.ts` (EXISTING) - Automation control methods
- `tests/services/workflow-controller.test.ts` (EXISTING) - Related tests

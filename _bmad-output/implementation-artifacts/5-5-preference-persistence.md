# Story 5.5: Preference Persistence

Status: done

## Story

As a **user**,
I want **the system to remember my automation choices**,
So that **future projects suggest my preferred settings**.

## Acceptance Criteria

1. **Given** I have completed a project with custom settings
   **When** I start a new project
   **Then** my previous preferences are suggested

2. **Given** I change automation settings during a project
   **When** the project completes
   **Then** the final settings are saved

3. **Given** saved preferences exist
   **When** initializing a new workflow
   **Then** the preferences are loaded as defaults

## Tasks / Subtasks

- [x] Task 1: Define preference structure (AC: #1)
  - [x] Add StepAutomationMode type
  - [x] Add StepAutomationPreferences type
  - [x] Add stepPreferences to AutomationConfig

- [x] Task 2: Implement preference saving (AC: #2)
  - [x] Create setStepAutomationPreference() method
  - [x] Create setAllStepAutomationPreferences() method
  - [x] Create saveWorkflowPreferences() method

- [x] Task 3: Implement preference loading (AC: #3)
  - [x] Create getStepAutomationPreference() method
  - [x] Create getAllStepAutomationPreferences() method
  - [x] Create clearStepAutomationPreferences() method

- [x] Task 4: Write tests
  - [x] Test preference saving
  - [x] Test preference loading
  - [x] Test persistence across instances

## Dev Notes

### Architecture Compliance

Per FR34: Sistem kullanıcının seçimlerini hatırlayıp sonraki projelerde önerebilir

Preferences stored in:
```
~/.appfabrika/config.json
  preferences:
    stepAutomation:
      step-01-brainstorming: 'auto'
      step-02-research: 'manual'
      ...
```

### PRD/Architecture References

- [Source: prd.md#FR34] - Tercih hatırlama
- [Source: epics.md#Epic-5-Story-5.5] - Preference Persistence

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - Preference Structure**
   - Added StepAutomationMode: 'auto' | 'manual' | 'skip'
   - Added StepAutomationPreferences type (Record<string, StepAutomationMode>)
   - Added optional stepPreferences to AutomationConfig

2. **Task 2 - Preference Saving**
   - setStepAutomationPreference(stepId, mode) for single step
   - setAllStepAutomationPreferences(prefs) for bulk update
   - saveWorkflowPreferences(Map) converts Map to object and saves
   - All methods persist to ~/.appfabrika/config.json

3. **Task 3 - Preference Loading**
   - getStepAutomationPreference(stepId) returns mode or undefined
   - getAllStepAutomationPreferences() returns full preferences object
   - clearStepAutomationPreferences() resets to empty

4. **Task 4 - Tests**
   - 7 new tests for step automation preferences
   - Tests for single and bulk operations
   - Tests for persistence across instances
   - 501 total tests passing

### File List

- `src/types/config.types.ts` (MODIFIED) - Added step preference types
- `src/core/preferences.ts` (MODIFIED) - Added step preference methods
- `tests/core/preferences.test.ts` (MODIFIED) - 7 new tests

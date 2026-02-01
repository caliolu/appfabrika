# Story 6.4: Live Progress with Spinner

Status: done

## Story

As a **user**,
I want **to see a spinner while steps are processing**,
So that **I know the system is working**.

## Acceptance Criteria

1. **Given** a step is executing
   **When** waiting for LLM response
   **Then** ora spinner is displayed with descriptive text

2. **Given** a step completes successfully
   **When** transitioning to next step
   **Then** spinner shows success indicator

3. **Given** a step fails
   **When** error occurs
   **Then** spinner shows failure indicator

## Tasks / Subtasks

- [x] Task 1: Create SpinnerService wrapper (AC: #1)
  - [x] Create src/cli/ui/spinner-service.ts
  - [x] Wrap ora with typed interface
  - [x] Turkish text for spinner states

- [x] Task 2: Implement spinner lifecycle methods (AC: #1, #2, #3)
  - [x] startStep(stepId) - starts spinner with step description
  - [x] succeedStep() - marks current step as successful
  - [x] failStep(message) - marks current step as failed
  - [x] updateText(text) - updates spinner text

- [x] Task 3: Add spinner text templates (AC: #1)
  - [x] Use BMAD_STEP_DESCRIPTIONS for step text
  - [x] Include emoji in spinner text
  - [x] Format: "💡 Proje fikrini analiz ediyor..."

- [x] Task 4: Write tests
  - [x] Test spinner start/stop
  - [x] Test success/fail indicators
  - [x] Test text updates

## Dev Notes

### Architecture Compliance

Per FR42: Sistem işlem sırasında spinner gösterebilir

Spinner format:
```
⠋ 💡 Proje fikrini analiz ediyor...
✓ 💡 Fikir Geliştirme tamamlandı
✗ 💡 Fikir Geliştirme başarısız: Hata mesajı
```

### PRD/Architecture References

- [Source: prd.md#FR42] - Spinner gösterimi
- [Source: epics.md#Epic-6-Story-6.4] - Live Progress with Spinner

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - SpinnerService Wrapper**
   - Created SpinnerService class wrapping ora
   - SpinnerState type: 'idle' | 'spinning' | 'succeeded' | 'failed' | 'warned'
   - SPINNER_MESSAGES constant with Turkish text
   - Singleton pattern with getSpinnerService/resetSpinnerService

2. **Task 2 - Lifecycle Methods**
   - startStep(stepId) starts spinner with step emoji and description
   - succeedStep() shows success with step name + "tamamlandı"
   - failStep(message) shows failure with step name + "başarısız" + error
   - skipStep() shows warning with step name + "atlandı"
   - updateText(text) updates spinner text while spinning
   - stop() stops spinner without indicator

3. **Task 3 - Text Templates**
   - getStepText(stepId) returns "💡 Proje fikrini analiz ediyor..."
   - getSuccessText(stepId) returns "💡 Fikir Geliştirme tamamlandı"
   - getFailureText(stepId, error?) returns "💡 Fikir Geliştirme başarısız: error"

4. **Task 4 - Tests**
   - 34 new tests for SpinnerService
   - Tests for lifecycle, text generation, enable/disable
   - Tests for singleton pattern
   - 623 total tests passing

### File List

- `src/cli/ui/spinner-service.ts` (NEW) - SpinnerService class
- `src/cli/ui/index.ts` (MODIFIED) - Added SpinnerService exports
- `tests/cli/ui/spinner-service.test.ts` (NEW) - 34 tests

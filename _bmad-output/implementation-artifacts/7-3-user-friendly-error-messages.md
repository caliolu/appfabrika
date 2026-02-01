# Story 7.3: User-Friendly Error Messages

Status: done

## Story

As a **user**,
I want **to see clear error messages after all retries fail**,
So that **I understand what to do**.

## Acceptance Criteria

1. **Given** all 3 retry attempts have failed
   **When** the final error is shown
   **Then** I see friendly options: [R] Retry, [S] Save, [?] Help

2. **Given** an error occurs
   **When** displaying the error
   **Then** the message is in Turkish and explains the issue

3. **Given** error options are shown
   **When** user selects an option
   **Then** appropriate action is taken

## Tasks / Subtasks

- [x] Task 1: Create ErrorDisplay service (AC: #1, #2)
  - [x] Create src/cli/ui/error-display.ts
  - [x] Define ErrorDisplayConfig interface
  - [x] Format error messages in Turkish

- [x] Task 2: Implement error action options (AC: #1, #3)
  - [x] Add ErrorAction enum (RETRY, SAVE, HELP, SKIP, ABORT)
  - [x] Display options with keyboard shortcuts
  - [x] Format: "[R] Yeniden Dene | [S] Kaydet | [?] Yardım"

- [x] Task 3: Integrate with error types (AC: #1)
  - [x] getErrorInfo() extracts from LLMError
  - [x] ERROR_MESSAGES mapping for all error codes
  - [x] renderRetryExhausted() for retry failures

- [x] Task 4: Write tests
  - [x] Test error message formatting
  - [x] Test action options display
  - [x] Test Turkish text content

## Dev Notes

### Architecture Compliance

Per FR46: Sistem kullanıcı dostu hata mesajları gösterebilir

Error display format:
```
❌ Hata Oluştu

   API bağlantısı başarısız oldu.

   Denemeler: 3/3 başarısız

   Ne yapabilirsiniz:
   [R] Yeniden Dene | [S] İlerlemeyi Kaydet | [?] Yardım
```

### PRD/Architecture References

- [Source: prd.md#FR46] - Kullanıcı dostu hata mesajları
- [Source: epics.md#Epic-7-Story-7.3] - User-Friendly Error Messages

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - ErrorDisplay Service**
   - Created ErrorDisplay class with singleton pattern
   - ErrorDisplayConfig for color and display options
   - getErrorInfo() extracts info from LLMError or generic Error

2. **Task 2 - Action Options**
   - ErrorAction enum: RETRY, SAVE, HELP, SKIP, ABORT
   - DEFAULT_ACTIONS: [R] Yeniden Dene, [S] Kaydet, [?] Yardım
   - EXTENDED_ACTIONS: includes [K] Atla, [Q] İptal
   - formatActions() with colored keyboard shortcuts

3. **Task 3 - Error Integration**
   - ERROR_MESSAGES mapping for all LLMErrorCode values
   - ERROR_LABELS constant with all Turkish strings
   - render() for full error display with options
   - renderSimple() and renderRetryExhausted() variants

4. **Task 4 - Tests**
   - 30 new tests for ErrorDisplay
   - Tests for all formatting methods
   - Tests for Turkish content
   - 711 total tests passing

### File List

- `src/cli/ui/error-display.ts` (NEW) - ErrorDisplay service
- `src/cli/ui/index.ts` (MODIFIED) - Added exports
- `tests/cli/ui/error-display.test.ts` (NEW) - 30 tests

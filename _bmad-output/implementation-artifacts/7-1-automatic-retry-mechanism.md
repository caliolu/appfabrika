# Story 7.1: Automatic Retry Mechanism

Status: done

## Story

As a **system**,
I want **to automatically retry failed operations**,
So that **transient errors don't stop the workflow**.

## Acceptance Criteria

1. **Given** an LLM API call fails
   **When** the error is detected
   **Then** the system retries up to 3 times

2. **Given** a retryable error occurs
   **When** checking if retry is allowed
   **Then** only timeout, rate_limit, and network errors are retried

3. **Given** a non-retryable error occurs
   **When** checking if retry is allowed
   **Then** auth_failed and invalid_response are NOT retried

## Tasks / Subtasks

- [x] Task 1: Create RetryService (AC: #1)
  - [x] Create src/services/retry-service.ts
  - [x] Define RetryConfig interface
  - [x] Implement withRetry() method

- [x] Task 2: Implement retry logic (AC: #1, #2, #3)
  - [x] Check error.retryable property
  - [x] Track retry count
  - [x] Emit events on retry

- [x] Task 3: Add retry types and constants (AC: #1)
  - [x] Add RetryState type
  - [x] Add DEFAULT_RETRY_CONFIG
  - [x] Turkish messages for retry events

- [x] Task 4: Write tests
  - [x] Test successful retry
  - [x] Test max retries exceeded
  - [x] Test non-retryable errors

## Dev Notes

### Architecture Compliance

Per FR44: Sistem başarısız işlemleri otomatik olarak yeniden deneyebilir

Retryable errors:
- TIMEOUT
- RATE_LIMIT
- NETWORK

Non-retryable errors:
- AUTH_FAILED
- INVALID_RESPONSE

### PRD/Architecture References

- [Source: prd.md#FR44] - Otomatik yeniden deneme
- [Source: epics.md#Epic-7-Story-7.1] - Automatic Retry Mechanism

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - RetryService**
   - Created RetryService class with singleton pattern
   - RetryConfig interface with maxRetries, delays, strategy
   - withRetry() executes operation with automatic retry
   - withRetryNoDelay() for testing without delays

2. **Task 2 - Retry Logic**
   - isRetryableError() checks LLMError.retryable or message patterns
   - Tracks attempt count and emits events
   - RetryResult includes success, result, error, attempts, totalTimeMs
   - Emits: attempt, retry, success, failure, exhausted events

3. **Task 3 - Types and Constants**
   - RetryState: 'idle' | 'retrying' | 'succeeded' | 'failed' | 'exhausted'
   - DEFAULT_RETRY_CONFIG: maxRetries=3, delays=[10s, 30s, 60s]
   - RETRY_MESSAGES Turkish constants

4. **Task 4 - Tests**
   - 36 new tests for RetryService
   - Tests for retry success, failure, max retries
   - Tests for delay calculation strategies
   - Tests for isRetryableError function
   - 681 total tests passing

### File List

- `src/services/retry-service.ts` (NEW) - RetryService class
- `src/services/index.ts` (MODIFIED) - Added RetryService exports
- `tests/services/retry-service.test.ts` (NEW) - 36 tests

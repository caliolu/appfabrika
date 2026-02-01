# Story 7.2: Retry Delay Strategy

Status: done

## Story

As a **system**,
I want **to wait between retry attempts**,
So that **rate limits can resolve**.

## Acceptance Criteria

1. **Given** a retry is needed
   **When** the system waits
   **Then** delay increases: 10s, 30s, 60s

2. **Given** delay strategy is configured
   **When** calculating delay
   **Then** supports fixed, linear, exponential strategies

3. **Given** maximum delay is set
   **When** calculated delay exceeds max
   **Then** delay is capped at maxDelayMs

## Tasks / Subtasks

- [x] Task 1: Implement delay calculation (AC: #1, #2)
  - [x] calculateDelay() function
  - [x] Support fixed, linear, exponential strategies
  - [x] Custom delay sequence option

- [x] Task 2: Add delay configuration (AC: #1, #3)
  - [x] DEFAULT_RETRY_CONFIG with 10s, 30s, 60s sequence
  - [x] maxDelayMs cap
  - [x] DelayStrategy type

- [x] Task 3: Integrate with RetryService (AC: #1)
  - [x] Apply delays in withRetry()
  - [x] Sleep function implementation

- [x] Task 4: Write tests (already in 7.1)
  - [x] Test delay calculation strategies
  - [x] Test max delay cap
  - [x] Test custom delay sequence

## Dev Notes

### Architecture Compliance

Per FR45: Sistem yeniden denemeler arasında bekleyebilir

Default delays per spec:
- Retry 1: 10 seconds
- Retry 2: 30 seconds
- Retry 3: 60 seconds

### PRD/Architecture References

- [Source: prd.md#FR45] - Yeniden deneme gecikmesi
- [Source: epics.md#Epic-7-Story-7.2] - Retry Delay Strategy

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Implemented together with Story 7.1**
   - calculateDelay() supports fixed, linear, exponential strategies
   - delaySequence option for custom delays [10000, 30000, 60000]
   - maxDelayMs caps calculated delay
   - DelayStrategy type: 'fixed' | 'linear' | 'exponential'

2. **Tests**
   - Tests for all delay strategies included in retry-service.test.ts
   - 681 total tests passing

### File List

- `src/services/retry-service.ts` (in Story 7.1) - calculateDelay(), DelayStrategy
- `tests/services/retry-service.test.ts` (in Story 7.1) - Delay tests

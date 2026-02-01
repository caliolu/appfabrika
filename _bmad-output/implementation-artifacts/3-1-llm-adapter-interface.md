# Story 3.1: LLM Adapter Interface

Status: done

## Story

As a **developer**,
I want **a common interface for LLM adapters**,
So that **different LLM providers can be used interchangeably**.

## Acceptance Criteria

1. **Given** the adapter pattern from Architecture
   **When** I implement the LLMAdapter interface
   **Then** it includes stream(), complete(), and validateKey() methods

2. **Given** the LLMAdapter interface exists
   **When** adapters are created for different providers
   **Then** they implement the same interface methods

3. **Given** stream() is called with a prompt
   **When** the LLM responds
   **Then** responses are returned as AsyncIterable<string>

4. **Given** complete() is called with a prompt
   **When** the LLM responds
   **Then** the full response is returned as Promise<string>

5. **Given** validateKey() is called
   **When** the API key is tested
   **Then** returns Promise<boolean> indicating validity

6. **Given** error occurs during LLM communication
   **When** the adapter handles the error
   **Then** typed errors (LLMError) are thrown with proper error codes

## Tasks / Subtasks

- [x] Task 1: Define LLM type definitions (AC: #1, #6)
  - [x] Create LLMAdapter interface in `src/types/llm.types.ts`
  - [x] Define LLMStreamChunk type for streaming responses
  - [x] Define LLMCompletionOptions interface
  - [x] Define LLMError codes enum
  - [x] Export types via barrel file

- [x] Task 2: Create base LLMError class (AC: #6)
  - [x] Create LLMError class extending Error (standalone, not AppFabrikaError)
  - [x] Add error codes: TIMEOUT, RATE_LIMIT, AUTH_FAILED, NETWORK, INVALID_RESPONSE
  - [x] Add helper factory methods for common errors

- [x] Task 3: Create abstract base adapter (AC: #1, #2)
  - [x] Create BaseLLMAdapter abstract class
  - [x] Implement common validation logic
  - [x] Implement timeout handling
  - [x] Add withTimeout helper method (for use by concrete adapters)

- [x] Task 4: Create adapter factory (AC: #2)
  - [x] Create createLLMAdapter factory function
  - [x] Accept LLMProvider type parameter
  - [x] Return appropriate adapter instance (placeholder for now)
  - [x] Throw error for invalid provider

- [x] Task 5: Write unit tests
  - [x] Test LLMError class and factory methods (23 tests)
  - [x] Test adapter factory with valid/invalid providers (8 tests)
  - [x] Test type exports
  - [x] Test base adapter validation methods (17 tests)

- [x] Task 6: Update build and verify
  - [x] Verify `npm run build` succeeds
  - [x] All 220 tests pass
  - [x] Verify types are properly exported

## Dev Notes

### Previous Epic Learnings (Epic 2)

From Epic 2 Implementation and Code Review:
- **vi.resetAllMocks():** Use instead of vi.clearAllMocks() for clean test isolation
- **Helper functions:** setupDefaultMocks() pattern works well for consistent test setup
- **Exact assertions:** Continue using exact string matches
- **State accumulation:** Follow consistent patterns from previous stories

### Architecture Compliance

This story creates the **Integration Layer** foundation:

```
[Integration Layer]
    └── llm/
        ├── llm.adapter.ts        ← NEW (interface + base class)
        └── llm.types.ts          ← Already in types folder

[Types Layer]
    ├── index.ts                  ← UPDATE barrel
    └── llm.types.ts              ← NEW
```

**Location:**
- `src/types/llm.types.ts` (new)
- `src/adapters/llm/llm.adapter.ts` (new)
- `src/adapters/llm/index.ts` (new - barrel export)
- `src/adapters/index.ts` (new - top-level barrel)

### Technical Requirements

**LLMAdapter Interface (from Architecture):**

```typescript
interface LLMAdapter {
  /** Stream response chunks as they arrive */
  stream(prompt: string, options?: LLMCompletionOptions): AsyncIterable<string>;

  /** Get complete response as single string */
  complete(prompt: string, options?: LLMCompletionOptions): Promise<string>;

  /** Validate API key is working */
  validateKey(): Promise<boolean>;

  /** Get provider name */
  readonly provider: LLMProvider;
}
```

**LLMCompletionOptions:**

```typescript
interface LLMCompletionOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Temperature for response randomness (0-1) */
  temperature?: number;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** System prompt/context */
  systemPrompt?: string;
}
```

**LLMError Codes (from Architecture ADR):**

```typescript
enum LLMErrorCode {
  TIMEOUT = 'E001',
  RATE_LIMIT = 'E002',
  AUTH_FAILED = 'E003',
  NETWORK = 'E004',
  INVALID_RESPONSE = 'E005',
}
```

**LLMError Class:**

```typescript
class LLMError extends AppFabrikaError {
  constructor(
    code: LLMErrorCode,
    userMessage: string,
    technicalDetails?: string
  ) { ... }

  // Factory methods
  static timeout(details?: string): LLMError;
  static rateLimit(details?: string): LLMError;
  static authFailed(details?: string): LLMError;
  static network(details?: string): LLMError;
  static invalidResponse(details?: string): LLMError;
}
```

**Adapter Factory:**

```typescript
function createLLMAdapter(
  provider: LLMProvider,
  apiKey: string
): LLMAdapter {
  switch (provider) {
    case 'openai':
      return new OpenAIAdapter(apiKey);
    case 'anthropic':
      return new AnthropicAdapter(apiKey);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
```

### Testing Requirements

**Test Pattern:**

```typescript
describe('LLMError', () => {
  it('should create timeout error with correct code', () => {
    const error = LLMError.timeout('Connection timed out');
    expect(error.code).toBe(LLMErrorCode.TIMEOUT);
    expect(error.userMessage).toContain('zaman');
  });
});

describe('createLLMAdapter', () => {
  it('should throw for invalid provider', () => {
    expect(() => createLLMAdapter('invalid' as LLMProvider, 'key'))
      .toThrow('Unknown LLM provider');
  });
});
```

### Library/Framework Requirements

| Package | Version | Usage |
|---------|---------|-------|
| openai | ^4.x | Will be used in Story 3.2 |
| @anthropic-ai/sdk | ^0.x | Will be used in Story 3.3 |

**Important:** This story creates interfaces and base classes only. Actual API integration is in Stories 3.2 and 3.3.

### PRD/Architecture References

- [Source: prd.md#FR23-26] - LLM API iletişimi
- [Source: architecture.md#ADR-001] - Streaming Response kararı
- [Source: architecture.md#LLM-Provider-Abstraction] - Adapter pattern
- [Source: architecture.md#Error-Handling-Standards] - Typed error classes
- [Source: epics.md#Story-3.1] - LLM Adapter Interface requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - LLM Type Definitions**
   - Created comprehensive `LLMAdapter` interface with stream(), complete(), validateKey()
   - Added `LLMCompletionOptions` with timeout, temperature, maxTokens, systemPrompt
   - Added `LLMResponse` type for complete() return value
   - Added `LLMStreamChunk` type for streaming responses
   - Added `LLMAdapterConfig` for adapter instantiation
   - Defined `LLMErrorCode` enum with 5 error types
   - Exported `DEFAULT_LLM_OPTIONS` constant

2. **Task 2 - LLMError Class**
   - Created standalone LLMError class (not extending AppFabrikaError - not yet implemented)
   - Added `code`, `userMessage`, `technicalDetails`, `retryable` properties
   - Implemented factory methods: timeout(), rateLimit(), authFailed(), network(), invalidResponse()
   - Added `fromError()` static method for converting generic errors
   - User messages in Turkish matching project language

3. **Task 3 - BaseLLMAdapter Abstract Class**
   - Created abstract class with common functionality
   - Implemented `mergeOptions()` for default option handling
   - Implemented `withTimeout()` for timeout handling with AbortController
   - Implemented `validatePrompt()` for input validation
   - Abstract methods: getDefaultModel(), stream(), complete(), validateKey()

4. **Task 4 - Adapter Factory**
   - Created `createLLMAdapter()` factory function
   - Placeholder implementations for OpenAI and Anthropic (to be completed in 3.2 and 3.3)
   - Added `getSupportedProviders()` and `isProviderSupported()` helper functions

5. **Task 5 - Unit Tests**
   - 23 tests for LLMError (constructor, factory methods, fromError)
   - 8 tests for adapter factory (providers, support checking)
   - 17 tests for BaseLLMAdapter (constructor, options, validation, timeout)
   - Total: 48 new tests added, 220 total tests in project

6. **Task 6 - Build & Verify**
   - `npm run build` succeeds
   - All 220 tests pass
   - Types properly exported via barrel files

### File List

- `src/types/llm.types.ts` (NEW) - LLM type definitions
- `src/types/index.ts` (MODIFIED) - Added llm.types export
- `src/adapters/llm/llm-error.ts` (NEW) - LLMError class
- `src/adapters/llm/base-adapter.ts` (NEW) - BaseLLMAdapter abstract class
- `src/adapters/llm/adapter-factory.ts` (NEW) - Factory function and helpers
- `src/adapters/llm/index.ts` (NEW) - LLM adapter barrel export
- `src/adapters/index.ts` (NEW) - Top-level adapters barrel export
- `tests/adapters/llm/llm-error.test.ts` (NEW) - LLMError tests
- `tests/adapters/llm/adapter-factory.test.ts` (NEW) - Factory tests
- `tests/adapters/llm/base-adapter.test.ts` (NEW) - BaseLLMAdapter tests

# Story 3.3: Anthropic Adapter

Status: done

## Story

As a **system**,
I want **to communicate with Anthropic API**,
So that **users can use Claude models for BMAD**.

## Acceptance Criteria

1. **Given** a valid Anthropic API key is configured
   **When** the system sends a BMAD prompt
   **Then** the response is streamed back

2. **Given** the Anthropic adapter implements LLMAdapter interface
   **When** stream() is called
   **Then** response chunks are yielded as they arrive

3. **Given** the Anthropic adapter implements LLMAdapter interface
   **When** complete() is called
   **Then** the full response is returned as LLMResponse

4. **Given** the Anthropic adapter is created
   **When** validateKey() is called with a valid key
   **Then** it returns true

5. **Given** the Anthropic adapter is created
   **When** validateKey() is called with an invalid key
   **Then** it returns false

6. **Given** a timeout of 30 seconds (default)
   **When** the API doesn't respond in time
   **Then** LLMError.timeout is thrown

## Tasks / Subtasks

- [x] Task 1: Create Anthropic adapter class (AC: #1, #2, #3)
  - [x] Create AnthropicAdapter class extending BaseLLMAdapter
  - [x] Implement stream() method using Anthropic SDK streaming
  - [x] Implement complete() method using Anthropic SDK
  - [x] Set default model to 'claude-3-5-sonnet-latest'

- [x] Task 2: Implement API key validation (AC: #4, #5)
  - [x] Implement validateKey() using a simple API call
  - [x] Handle auth errors gracefully
  - [x] Return boolean (no throw)

- [x] Task 3: Implement timeout handling (AC: #6)
  - [x] Use AbortController for timeout (via BaseLLMAdapter.withTimeout)
  - [x] Default timeout from options (30s)
  - [x] Throw LLMError.timeout on abort

- [x] Task 4: Update adapter factory
  - [x] Replace AnthropicAdapterPlaceholder with real AnthropicAdapter
  - [x] Import and export properly

- [x] Task 5: Write unit tests
  - [x] Test stream() with mocked SDK (4 tests)
  - [x] Test complete() with mocked SDK (7 tests)
  - [x] Test validateKey() success/failure (3 tests)
  - [x] Test options handling (2 tests)
  - [x] Test constructor (4 tests)
  - [x] Total: 20 tests for AnthropicAdapter

- [x] Task 6: Update build and verify
  - [x] Verify `npm run build` succeeds
  - [x] All 260 tests pass
  - [x] Verify Anthropic SDK is properly imported

## Dev Notes

### Previous Story Learnings (Story 3.2)

From Story 3.2 Implementation:
- Mock OpenAI SDK using class-based mock (not function)
- vi.mock() must be defined before imports due to hoisting
- vi.resetAllMocks() in beforeEach for clean test isolation
- System prompt only added to messages array when non-empty

### Architecture Compliance

This story extends the **Integration Layer**:

```
[Integration Layer]
    └── llm/
        ├── index.ts              ← UPDATE exports
        ├── openai.adapter.ts     ← EXISTS
        ├── anthropic.adapter.ts  ← NEW
        └── adapter-factory.ts    ← UPDATE
```

### Technical Requirements

**Anthropic SDK Usage:**

```typescript
import Anthropic from '@anthropic-ai/sdk';

class AnthropicAdapter extends BaseLLMAdapter {
  readonly provider: LLMProvider = 'anthropic';
  private client: Anthropic;

  constructor(config: LLMAdapterConfig) {
    super(config);
    this.client = new Anthropic({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
    });
  }

  protected getDefaultModel(): string {
    return 'claude-3-5-sonnet-latest';
  }

  async *stream(prompt: string, options?: LLMCompletionOptions): AsyncIterable<string> {
    this.validatePrompt(prompt);
    const merged = this.mergeOptions(options);

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: merged.maxTokens,
      system: merged.systemPrompt || undefined,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }

  async complete(prompt: string, options?: LLMCompletionOptions): Promise<LLMResponse> {
    this.validatePrompt(prompt);
    const merged = this.mergeOptions(options);

    const response = await this.withTimeout(
      async (signal) => {
        return this.client.messages.create({
          model: this.model,
          max_tokens: merged.maxTokens,
          system: merged.systemPrompt || undefined,
          messages: [{ role: 'user', content: prompt }],
        }, { signal });
      },
      merged.timeout
    );

    const textContent = response.content.find(c => c.type === 'text');
    return {
      content: textContent?.text ?? '',
      provider: this.provider,
      model: this.model,
      usage: response.usage ? {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      } : undefined,
    };
  }

  async validateKey(): Promise<boolean> {
    try {
      // Simple validation by making a minimal request
      await this.client.messages.create({
        model: this.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
```

### Testing Requirements

**Mock Anthropic SDK:**

```typescript
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreate,
        stream: mockStream,
      };
    },
  };
});
```

### Library/Framework Requirements

| Package | Version | Usage |
|---------|---------|-------|
| @anthropic-ai/sdk | ^0.x | Already installed |

### PRD/Architecture References

- [Source: prd.md#FR23-24] - LLM API query/response
- [Source: architecture.md#ADR-001] - Streaming Response
- [Source: architecture.md#NFR2] - 30 second timeout
- [Source: epics.md#Story-3.3] - Anthropic Adapter requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - Anthropic Adapter Class**
   - Created AnthropicAdapter extending BaseLLMAdapter
   - Uses @anthropic-ai/sdk with messages API
   - Default model: claude-3-5-sonnet-latest
   - System prompt passed as top-level param (not in messages)

2. **Task 2 - API Key Validation**
   - Uses messages.create() with minimal request
   - Returns true/false without throwing
   - Handles all error types gracefully

3. **Task 3 - Timeout Handling**
   - Uses BaseLLMAdapter.withTimeout() for complete()
   - Passes AbortSignal to Anthropic SDK
   - Stream() uses SDK's built-in handling

4. **Task 4 - Adapter Factory Update**
   - Replaced placeholder with real AnthropicAdapter
   - Added import and export
   - Both providers now fully functional

5. **Task 5 - Unit Tests**
   - Used vi.mock() with class-based mock for Anthropic SDK
   - Tested stream events (content_block_delta with text_delta)
   - 20 tests total for Anthropic adapter

6. **Task 6 - Build & Verify**
   - `npm run build` succeeds
   - All 260 tests pass

### File List

- `src/adapters/llm/anthropic.adapter.ts` (NEW) - Anthropic adapter implementation
- `src/adapters/llm/adapter-factory.ts` (MODIFIED) - Added AnthropicAdapter import
- `src/adapters/llm/index.ts` (MODIFIED) - Added AnthropicAdapter export
- `tests/adapters/llm/anthropic.adapter.test.ts` (NEW) - 20 tests
- `tests/adapters/llm/adapter-factory.test.ts` (MODIFIED) - Updated with Anthropic mock

# Story 3.2: OpenAI Adapter

Status: done

## Story

As a **system**,
I want **to communicate with OpenAI API**,
So that **users can use GPT models for BMAD**.

## Acceptance Criteria

1. **Given** a valid OpenAI API key is configured
   **When** the system sends a BMAD prompt
   **Then** the response is streamed back

2. **Given** the OpenAI adapter implements LLMAdapter interface
   **When** stream() is called
   **Then** response chunks are yielded as they arrive

3. **Given** the OpenAI adapter implements LLMAdapter interface
   **When** complete() is called
   **Then** the full response is returned as LLMResponse

4. **Given** the OpenAI adapter is created
   **When** validateKey() is called with a valid key
   **Then** it returns true

5. **Given** the OpenAI adapter is created
   **When** validateKey() is called with an invalid key
   **Then** it returns false

6. **Given** a timeout of 30 seconds (default)
   **When** the API doesn't respond in time
   **Then** LLMError.timeout is thrown

## Tasks / Subtasks

- [x] Task 1: Create OpenAI adapter class (AC: #1, #2, #3)
  - [x] Create OpenAIAdapter class extending BaseLLMAdapter
  - [x] Implement stream() method using OpenAI SDK streaming
  - [x] Implement complete() method using OpenAI SDK
  - [x] Set default model to 'gpt-4'

- [x] Task 2: Implement API key validation (AC: #4, #5)
  - [x] Implement validateKey() using a simple models list call
  - [x] Handle auth errors gracefully
  - [x] Return boolean (no throw)

- [x] Task 3: Implement timeout handling (AC: #6)
  - [x] Use AbortController for timeout (via BaseLLMAdapter.withTimeout)
  - [x] Default timeout from options (30s)
  - [x] Throw LLMError.timeout on abort

- [x] Task 4: Update adapter factory
  - [x] Replace OpenAIAdapterPlaceholder with real OpenAIAdapter
  - [x] Import and export properly

- [x] Task 5: Write unit tests
  - [x] Test stream() with mocked SDK (4 tests)
  - [x] Test complete() with mocked SDK (7 tests)
  - [x] Test validateKey() success/failure (3 tests)
  - [x] Test options handling (2 tests)
  - [x] Test constructor (4 tests)
  - [x] Total: 20 tests for OpenAIAdapter

- [x] Task 6: Update build and verify
  - [x] Verify `npm run build` succeeds
  - [x] All 240 tests pass
  - [x] Verify OpenAI SDK is properly imported

## Dev Notes

### Previous Story Learnings (Story 3.1)

From Story 3.1 Implementation:
- LLMAdapter interface with stream(), complete(), validateKey()
- BaseLLMAdapter provides common utilities: mergeOptions(), withTimeout(), validatePrompt()
- LLMError class with factory methods for typed errors
- DEFAULT_LLM_OPTIONS for consistent defaults

### Architecture Compliance

This story extends the **Integration Layer**:

```
[Integration Layer]
    └── llm/
        ├── index.ts              ← UPDATE exports
        ├── llm-error.ts          ← EXISTS
        ├── base-adapter.ts       ← EXISTS
        ├── adapter-factory.ts    ← UPDATE
        └── openai.adapter.ts     ← NEW
```

### Technical Requirements

**OpenAI SDK Usage:**

```typescript
import OpenAI from 'openai';

class OpenAIAdapter extends BaseLLMAdapter {
  readonly provider: LLMProvider = 'openai';
  private client: OpenAI;

  constructor(config: LLMAdapterConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
    });
  }

  protected getDefaultModel(): string {
    return 'gpt-4';
  }

  async *stream(prompt: string, options?: LLMCompletionOptions): AsyncIterable<string> {
    this.validatePrompt(prompt);
    const merged = this.mergeOptions(options);

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: merged.systemPrompt },
        { role: 'user', content: prompt },
      ],
      stream: true,
      temperature: merged.temperature,
      max_tokens: merged.maxTokens,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  async complete(prompt: string, options?: LLMCompletionOptions): Promise<LLMResponse> {
    this.validatePrompt(prompt);
    const merged = this.mergeOptions(options);

    const response = await this.withTimeout(
      async (signal) => {
        return this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: merged.systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: merged.temperature,
          max_tokens: merged.maxTokens,
        }, { signal });
      },
      merged.timeout
    );

    return {
      content: response.choices[0]?.message?.content ?? '',
      provider: this.provider,
      model: this.model,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }

  async validateKey(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
```

### Testing Requirements

**Mock OpenAI SDK:**

```typescript
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
    models: {
      list: vi.fn(),
    },
  })),
}));
```

### Library/Framework Requirements

| Package | Version | Usage |
|---------|---------|-------|
| openai | ^4.x | Already installed |

### PRD/Architecture References

- [Source: prd.md#FR23-24] - LLM API query/response
- [Source: architecture.md#ADR-001] - Streaming Response
- [Source: architecture.md#NFR2] - 30 second timeout
- [Source: epics.md#Story-3.2] - OpenAI Adapter requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - OpenAI Adapter Class**
   - Created OpenAIAdapter extending BaseLLMAdapter
   - Uses OpenAI SDK v6 with chat.completions API
   - Default model: gpt-4
   - Supports system prompts (only added when non-empty)

2. **Task 2 - API Key Validation**
   - Uses models.list() to verify API key
   - Returns true/false without throwing
   - Handles all error types gracefully

3. **Task 3 - Timeout Handling**
   - Uses BaseLLMAdapter.withTimeout() for complete()
   - Passes AbortSignal to OpenAI SDK
   - Stream() doesn't use timeout (SDK handles it)

4. **Task 4 - Adapter Factory Update**
   - Replaced placeholder with real OpenAIAdapter
   - Added import and export
   - Factory tests updated

5. **Task 5 - Unit Tests**
   - Used vi.mock() with class-based mock for OpenAI SDK
   - Mock must be defined before imports (hoisting)
   - Tested all methods: constructor, complete, stream, validateKey
   - 20 tests total for OpenAI adapter

6. **Task 6 - Build & Verify**
   - `npm run build` succeeds
   - All 240 tests pass

### File List

- `src/adapters/llm/openai.adapter.ts` (NEW) - OpenAI adapter implementation
- `src/adapters/llm/adapter-factory.ts` (MODIFIED) - Added OpenAIAdapter import
- `src/adapters/llm/index.ts` (MODIFIED) - Added OpenAIAdapter export
- `tests/adapters/llm/openai.adapter.test.ts` (NEW) - 20 tests
- `tests/adapters/llm/adapter-factory.test.ts` (MODIFIED) - Updated mock

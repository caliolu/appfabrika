# Story 3.4: Response Transformation

Status: done

## Story

As a **system**,
I want **to transform LLM responses to BMAD format**,
So that **responses are structured for workflow processing**.

## Acceptance Criteria

1. **Given** an LLM streaming response
   **When** the response completes
   **Then** it is parsed and validated for BMAD step requirements

2. **Given** a raw LLM response
   **When** it contains markdown formatting
   **Then** it is properly parsed and structured

3. **Given** a BMAD step type
   **When** the response is transformed
   **Then** it validates required sections exist

4. **Given** an incomplete or invalid response
   **When** validation fails
   **Then** appropriate error is thrown with details

5. **Given** various LLM providers
   **When** responses are transformed
   **Then** the output format is consistent regardless of provider

## Tasks / Subtasks

- [x] Task 1: Define BMAD response types (AC: #1, #5)
  - [x] Create BmadStepType enum for 12 BMAD steps
  - [x] Create BmadResponse interface for structured output
  - [x] Create BmadSection interface for response sections
  - [x] Export types via barrel file

- [x] Task 2: Create response transformer (AC: #1, #2)
  - [x] Create ResponseTransformer class
  - [x] Implement transformResponse() method
  - [x] Parse markdown sections from raw response
  - [x] Extract metadata and content

- [x] Task 3: Implement validation (AC: #3, #4)
  - [x] Implement validate() method
  - [x] Check required sections per step type
  - [x] Return detailed validation results with errors/warnings

- [x] Task 4: Write unit tests
  - [x] Test markdown parsing (5 tests)
  - [x] Test section extraction
  - [x] Test validation (5 tests)
  - [x] Test transformResponse (2 tests)
  - [x] Test findSection (4 tests)
  - [x] Test getSectionsByLevel (2 tests)
  - [x] Test singleton (2 tests)
  - [x] Total: 20 tests

- [x] Task 5: Update build and verify
  - [x] Verify `npm run build` succeeds
  - [x] All 280 tests pass
  - [x] Verify exports are correct

## Dev Notes

### Previous Story Learnings (Stories 3.1-3.3)

From Epic 3 Implementation:
- LLMAdapter interface provides consistent stream() and complete()
- LLMResponse type contains content, provider, model, usage
- vi.mock() with class-based mock works well for SDK mocking
- Turkish user messages maintained throughout

### Architecture Compliance

This story adds to the **Integration Layer**:

```
[Integration Layer]
    └── llm/
        ├── index.ts                  ← UPDATE exports
        ├── response-transformer.ts   ← NEW
        └── bmad.types.ts             ← NEW (or in types/)
```

### Technical Requirements

**BmadStepType Enum:**

```typescript
enum BmadStepType {
  BRAINSTORMING = 'step-01-brainstorming',
  RESEARCH = 'step-02-research',
  PRODUCT_BRIEF = 'step-03-product-brief',
  PRD = 'step-04-prd',
  UX_DESIGN = 'step-05-ux-design',
  ARCHITECTURE = 'step-06-architecture',
  EPICS_STORIES = 'step-07-epics-stories',
  SPRINT_PLANNING = 'step-08-sprint-planning',
  TECH_SPEC = 'step-09-tech-spec',
  DEVELOPMENT = 'step-10-development',
  CODE_REVIEW = 'step-11-code-review',
  QA_TESTING = 'step-12-qa-testing',
}
```

**BmadResponse Interface:**

```typescript
interface BmadResponse {
  stepType: BmadStepType;
  rawContent: string;
  sections: BmadSection[];
  metadata: {
    createdAt: string;
    provider: LLMProvider;
    model: string;
  };
  isValid: boolean;
  validationErrors?: string[];
}
```

**ResponseTransformer:**

```typescript
class ResponseTransformer {
  transformResponse(
    llmResponse: LLMResponse,
    stepType: BmadStepType
  ): BmadResponse {
    const sections = this.parseSections(llmResponse.content);
    const validationResult = this.validate(sections, stepType);

    return {
      stepType,
      rawContent: llmResponse.content,
      sections,
      metadata: {
        createdAt: new Date().toISOString(),
        provider: llmResponse.provider,
        model: llmResponse.model,
      },
      isValid: validationResult.isValid,
      validationErrors: validationResult.errors,
    };
  }
}
```

### Library/Framework Requirements

| Package | Version | Usage |
|---------|---------|-------|
| No new packages | - | Uses built-in string parsing |

### PRD/Architecture References

- [Source: prd.md#FR25] - LLM cevaplarını BMAD formatına dönüştürme
- [Source: architecture.md#BMAD-Steps] - 12 BMAD step definitions
- [Source: epics.md#Story-3.4] - Response Transformation requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - BMAD Response Types**
   - Created BmadStepType enum with all 12 steps (step-01 through step-12)
   - Added BMAD_STEP_NAMES for Turkish display names
   - Created BmadSection, BmadResponse, BmadValidationResult interfaces
   - Added REQUIRED_SECTIONS config (currently empty for flexibility)

2. **Task 2 - Response Transformer**
   - Created ResponseTransformer class with parseSections()
   - Parses markdown headings (#) into structured sections
   - Tracks line numbers for each section
   - Handles edge cases: empty content, no headings, multiple levels

3. **Task 3 - Validation**
   - Implemented validate() returning BmadValidationResult
   - Checks for empty content (error)
   - Checks for short content (warning)
   - Checks for unparsed markdown (warning)
   - Turkish error messages maintained

4. **Task 4 - Unit Tests**
   - 20 tests covering all methods
   - Tests parseSections, validate, transformResponse
   - Tests findSection with Turkish character support
   - Tests singleton pattern

5. **Task 5 - Build & Verify**
   - `npm run build` succeeds
   - All 280 tests pass

### File List

- `src/types/bmad.types.ts` (NEW) - BMAD type definitions
- `src/types/index.ts` (MODIFIED) - Added bmad.types export
- `src/adapters/llm/response-transformer.ts` (NEW) - ResponseTransformer class
- `src/adapters/llm/index.ts` (MODIFIED) - Added ResponseTransformer export
- `tests/adapters/llm/response-transformer.test.ts` (NEW) - 20 tests

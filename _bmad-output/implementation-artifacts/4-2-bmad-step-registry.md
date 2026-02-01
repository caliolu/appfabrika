# Story 4.2: BMAD Step Registry

Status: done

## Story

As a **system**,
I want **a registry of all 12 BMAD steps**,
So that **each step can be executed in sequence**.

## Acceptance Criteria

1. **Given** the BMAD methodology
   **When** the workflow is initialized
   **Then** all 12 steps are registered (step-01 through step-12)

2. **Given** a registered step
   **When** the step configuration is queried
   **Then** step metadata is returned (name, description, prompt template path)

3. **Given** a step type
   **When** the step handler is requested
   **Then** the appropriate handler function is returned

4. **Given** the step registry
   **When** steps are iterated
   **Then** they are returned in correct order (1-12)

5. **Given** an invalid step ID
   **When** queried from registry
   **Then** appropriate error is thrown with Turkish message

## Tasks / Subtasks

- [x] Task 1: Define step registry types (AC: #1, #2)
  - [x] Create StepDefinition interface (id, name, description, templatePath, handler)
  - [x] Create StepHandler type (async function signature)
  - [x] Create StepCategory enum (business, design, technical)
  - [x] Export types via types/index.ts

- [x] Task 2: Create BmadStepRegistry class (AC: #1, #4)
  - [x] Create BmadStepRegistry class in services/bmad-step-registry.ts
  - [x] Implement registerStep() for adding step definitions
  - [x] Implement getStep(stepId) for retrieving step definition
  - [x] Implement getAllSteps() returning steps in order

- [x] Task 3: Register all 12 BMAD steps (AC: #1, #2)
  - [x] Define step-01-brainstorming configuration
  - [x] Define step-02-research configuration
  - [x] Define step-03-product-brief configuration
  - [x] Define step-04-prd configuration
  - [x] Define step-05-ux-design configuration
  - [x] Define step-06-architecture configuration
  - [x] Define step-07-epics-stories configuration
  - [x] Define step-08-sprint-planning configuration
  - [x] Define step-09-tech-spec configuration
  - [x] Define step-10-development configuration
  - [x] Define step-11-code-review configuration
  - [x] Define step-12-qa-testing configuration

- [x] Task 4: Implement step handler lookup (AC: #3)
  - [x] Implement getHandler(stepId) method
  - [x] Create placeholder handlers for each step type
  - [x] Allow handler registration/override

- [x] Task 5: Add error handling (AC: #5)
  - [x] Add Turkish error messages for step not found
  - [x] Add validation for duplicate step registration
  - [x] Add validation for missing required fields

- [x] Task 6: Write unit tests
  - [x] Test step registration
  - [x] Test step retrieval by ID
  - [x] Test getAllSteps ordering
  - [x] Test handler lookup
  - [x] Test error cases (not found, duplicate)
  - [x] Test step categories
  - [x] Target: 20+ tests (achieved: 27 tests)

- [x] Task 7: Update exports and verify
  - [x] Export from services/index.ts
  - [x] Verify `npm run build` succeeds
  - [x] All tests pass (356 total)

## Dev Notes

### Previous Story Learnings (Story 4.1)

From Story 4.1 Implementation:
- WorkflowStateMachine already uses BmadStepType and BMAD_STEPS
- WorkflowEventType includes STEP_RESET for goToStep transitions
- Turkish error messages pattern established in WORKFLOW_ERRORS
- Singleton pattern with reset function for testing works well
- Services layer barrel export established in services/index.ts

### Architecture Compliance

This story extends the **Orchestration Layer**:

```
[Orchestration Layer]
    └── services/
        ├── index.ts                      ← UPDATE exports
        ├── workflow-state-machine.ts     ← EXISTING
        └── bmad-step-registry.ts         ← NEW
```

Per Architecture:
- 12 BMAD steps in step-XX-name format
- Templates folder will contain prompt templates
- Step handlers will be async functions for LLM interaction

### Technical Requirements

**StepCategory Enum:**

```typescript
enum StepCategory {
  BUSINESS = 'business',   // steps 1-4: Brainstorming, Research, Product Brief, PRD
  DESIGN = 'design',       // steps 5-7: UX Design, Architecture, Epics & Stories
  TECHNICAL = 'technical', // steps 8-12: Sprint Planning, Tech Spec, Dev, Review, QA
}
```

**StepHandler Type:**

```typescript
type StepHandler = (
  input: StepInput,
  context: StepContext
) => Promise<StepOutput>;

interface StepInput {
  prompt: string;
  previousOutputs: Map<BmadStepType, StepOutput>;
}

interface StepContext {
  projectPath: string;
  automationMode: AutomationMode;
  llmProvider: LLMProvider;
}

interface StepOutput {
  content: string;
  files?: string[];
  metadata?: Record<string, unknown>;
}
```

**StepDefinition Interface:**

```typescript
interface StepDefinition {
  id: BmadStepType;
  name: string;              // Turkish display name
  description: string;       // Turkish description
  category: StepCategory;
  templatePath: string;      // Path to prompt template
  handler?: StepHandler;     // Optional custom handler
  requiredInputs?: BmadStepType[];  // Steps that must complete first
}
```

**BmadStepRegistry Class:**

```typescript
class BmadStepRegistry {
  private steps: Map<BmadStepType, StepDefinition>;
  private handlers: Map<BmadStepType, StepHandler>;

  constructor();

  // Registration
  registerStep(definition: StepDefinition): void;
  registerHandler(stepId: BmadStepType, handler: StepHandler): void;

  // Queries
  getStep(stepId: BmadStepType): StepDefinition;
  getHandler(stepId: BmadStepType): StepHandler;
  getAllSteps(): StepDefinition[];
  getStepsByCategory(category: StepCategory): StepDefinition[];

  // Utilities
  hasStep(stepId: BmadStepType): boolean;
}
```

**Default Step Definitions:**

| Step | Name (TR) | Category |
|------|-----------|----------|
| step-01-brainstorming | Fikir Geliştirme | business |
| step-02-research | Araştırma | business |
| step-03-product-brief | Ürün Özeti | business |
| step-04-prd | Gereksinimler | business |
| step-05-ux-design | UX Tasarımı | design |
| step-06-architecture | Mimari | design |
| step-07-epics-stories | Epic ve Hikayeler | design |
| step-08-sprint-planning | Sprint Planlama | technical |
| step-09-tech-spec | Teknik Şartname | technical |
| step-10-development | Geliştirme | technical |
| step-11-code-review | Kod İnceleme | technical |
| step-12-qa-testing | Test | technical |

### Library/Framework Requirements

| Package | Version | Usage |
|---------|---------|-------|
| No new packages | - | Uses existing types and patterns |

### PRD/Architecture References

- [Source: architecture.md#BMAD-Step-Patterns] - Step identifiers (step-XX-name)
- [Source: prd.md#FR6-17] - 12 BMAD step requirements
- [Source: epics.md#Epic-4-Story-4.2] - BMAD Step Registry requirements
- [Source: architecture.md#Project-Structure] - templates/ folder for prompts

### File Structure

```
src/
├── types/
│   ├── index.ts              ← UPDATE: export step.types
│   └── step.types.ts         ← NEW: StepDefinition, StepHandler types
├── services/
│   ├── index.ts              ← UPDATE: export BmadStepRegistry
│   ├── workflow-state-machine.ts  ← EXISTING
│   └── bmad-step-registry.ts      ← NEW: BmadStepRegistry class
tests/
└── services/
    └── bmad-step-registry.test.ts  ← NEW: 20+ tests
```

### Turkish Error Messages

```typescript
const REGISTRY_ERRORS = {
  STEP_NOT_FOUND: 'Adım bulunamadı: {stepId}',
  STEP_ALREADY_EXISTS: 'Adım zaten kayıtlı: {stepId}',
  HANDLER_NOT_FOUND: 'Handler bulunamadı: {stepId}',
  INVALID_STEP_DEFINITION: 'Geçersiz adım tanımı: {field} eksik',
};
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - Step Registry Types**
   - Created `src/types/step.types.ts` with StepCategory enum, StepHandler type
   - Created StepDefinition, StepInput, StepContext, StepOutput interfaces
   - Added REGISTRY_ERRORS constant with Turkish messages
   - Exported via `src/types/index.ts`

2. **Task 2 - BmadStepRegistry Class**
   - Created `src/services/bmad-step-registry.ts`
   - Implemented registerStep() with validation
   - Implemented getStep() with error handling
   - Implemented getAllSteps() returning ordered array

3. **Task 3 - All 12 Steps Registered**
   - All steps registered with Turkish names from BMAD_STEP_NAMES
   - Turkish descriptions for each step
   - Categories: business (1-4), design (5-7), technical (8-12)
   - Dependencies defined for each step

4. **Task 4 - Handler Lookup**
   - getHandler() returns registered handler
   - registerHandler() allows custom handler override
   - Placeholder handlers created for all steps

5. **Task 5 - Error Handling**
   - Turkish error messages for step not found
   - Validation for duplicate registration
   - Validation for missing required fields (id, name, templatePath)

6. **Task 6 - Unit Tests**
   - 27 tests covering all functionality
   - Tests for initialization, getStep, getAllSteps, getStepsByCategory
   - Tests for step dependencies, handler registration, error cases, singleton

7. **Task 7 - Build & Verify**
   - `npm run build` succeeds
   - 356 tests pass (27 new for this story)

### File List

- `src/types/step.types.ts` (NEW) - Step type definitions
- `src/types/index.ts` (MODIFIED) - Added step.types export
- `src/services/bmad-step-registry.ts` (NEW) - BmadStepRegistry class
- `src/services/index.ts` (MODIFIED) - Added BmadStepRegistry export
- `tests/services/bmad-step-registry.test.ts` (NEW) - 27 tests

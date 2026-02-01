# Story 4.5: Design Steps Execution

Status: done

## Story

As a **user**,
I want **the system to execute design BMAD steps (5-7)**,
So that **my product is architected properly**.

## Acceptance Criteria

1. **Given** business steps are complete
   **When** design steps execute
   **Then** UX Design, Architecture, and Epics & Stories steps complete

2. **Given** a design step is started
   **When** the step handler is called
   **Then** the prompt template is loaded with business step outputs as context

3. **Given** the design prompt is ready
   **When** executed via Claude Code
   **Then** the output is captured and includes architectural decisions

4. **Given** design step execution completes
   **When** the output is processed
   **Then** it is saved to the appropriate checkpoint file

## Tasks / Subtasks

- [x] Task 1: Create design step prompt templates (AC: #1, #2)
  - [x] Create templates/step-05-ux-design.md
  - [x] Create templates/step-06-architecture.md
  - [x] Create templates/step-07-epics-stories.md

- [x] Task 2: Write unit tests for design templates
  - [x] Test template loading for step-05
  - [x] Test template loading for step-06
  - [x] Test template loading for step-07
  - [x] Test context from business steps is included ({{allPreviousOutputs}})

- [x] Task 3: Update exports and verify
  - [x] Verify `npm run build` succeeds
  - [x] All tests pass (403 total)

## Dev Notes

### Previous Story Learnings (Story 4.4)

From Story 4.4 Implementation:
- StepExecutor handles template loading and execution
- Templates use {{projectIdea}}, {{stepName}}, {{allPreviousOutputs}}, {{previousOutput.stepId}}
- Checkpoints auto-saved after execution
- Business templates created (step-01 through step-04)

### Architecture Compliance

This story extends the templates for design steps:

```
templates/
├── step-01-brainstorming.md      ← EXISTING
├── step-02-research.md           ← EXISTING
├── step-03-product-brief.md      ← EXISTING
├── step-04-prd.md                ← EXISTING
├── step-05-ux-design.md          ← NEW
├── step-06-architecture.md       ← NEW
└── step-07-epics-stories.md      ← NEW
```

### PRD/Architecture References

- [Source: prd.md#FR10-12] - Design BMAD steps (UX Design, Architecture, Epics & Stories)
- [Source: epics.md#Epic-4-Story-4.5] - Design Steps Execution

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - Design Step Templates**
   - step-05-ux-design.md: Kullanıcı personaları, user journey, wireframes, accessibility
   - step-06-architecture.md: Teknoloji stack, veri mimarisi, API tasarımı, ADRs
   - step-07-epics-stories.md: Epic/Story breakdown, önceliklendirme, MVP kapsamı

2. **Task 2 - Unit Tests**
   - Added test for business step templates (1-4)
   - Added test for design step templates (5-7)
   - Verified all templates contain {{projectIdea}} and {{allPreviousOutputs}}
   - 2 new tests added (403 total)

3. **Task 3 - Build & Verify**
   - `npm run build` succeeds
   - 403 tests pass

### File List

- `templates/step-05-ux-design.md` (NEW) - UX Design template
- `templates/step-06-architecture.md` (NEW) - Architecture template
- `templates/step-07-epics-stories.md` (NEW) - Epics & Stories template
- `tests/services/step-executor.test.ts` (MODIFIED) - Added 2 tests for template loading


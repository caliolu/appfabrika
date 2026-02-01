# Story 4.3: Claude Code Adapter

Status: done

## Story

As a **system**,
I want **to execute BMAD steps via Claude Code**,
So that **files are created and code is generated**.

## Acceptance Criteria

1. **Given** ADR-003 File-Based Communication
   **When** a BMAD step needs execution
   **Then** prompt is written to .appfabrika/prompt.md
   **And** Claude Code is invoked with the prompt file

2. **Given** Claude Code is installed
   **When** the adapter is initialized
   **Then** Claude Code availability is verified

3. **Given** a prompt file is ready
   **When** Claude Code is invoked
   **Then** the system waits for completion and captures output

4. **Given** Claude Code execution completes
   **When** the result is processed
   **Then** output is returned in StepOutput format

5. **Given** Claude Code is not installed
   **When** the adapter is used
   **Then** appropriate error is thrown with Turkish message

## Tasks / Subtasks

- [x] Task 1: Define Claude Code adapter types (AC: #4)
  - [x] Create ClaudeCodeExecutionOptions interface
  - [x] Create ClaudeCodeResult interface
  - [x] Create ClaudeCodeExecutionMetadata interface
  - [x] Export types via types/index.ts

- [x] Task 2: Create ClaudeCodeAdapter class (AC: #1, #2)
  - [x] Create ClaudeCodeAdapter class in adapters/claude-code/
  - [x] Implement constructor with options
  - [x] Implement isAvailable() method to check CLI installation
  - [x] Implement getVersion() method

- [x] Task 3: Implement prompt file writing (AC: #1)
  - [x] Implement writePromptFile(prompt, stepId) method
  - [x] Create .appfabrika directory if not exists
  - [x] Write prompt to .appfabrika/prompt.md
  - [x] Also write to step-specific file for logging

- [x] Task 4: Implement Claude Code execution (AC: #3)
  - [x] Implement execute(promptPath) method
  - [x] Spawn claude CLI with --file flag
  - [x] Capture stdout and stderr
  - [x] Handle process completion

- [x] Task 5: Implement executeStep for BMAD integration (AC: #1, #3, #4)
  - [x] Implement executeStep(stepId, prompt) method
  - [x] Write prompt file
  - [x] Execute Claude Code
  - [x] Return StepOutput with content and metadata

- [x] Task 6: Add error handling (AC: #5)
  - [x] Turkish error messages for CLI not found
  - [x] Handle execution timeout
  - [x] Handle process errors

- [x] Task 7: Write unit tests
  - [x] Test isAvailable() method
  - [x] Test writePromptFile() method
  - [x] Test execute() with mocked spawn
  - [x] Test executeStep() integration
  - [x] Test error handling
  - [x] Target: 15+ tests (achieved: 20 tests)

- [x] Task 8: Update exports and verify
  - [x] Update adapters/index.ts barrel export
  - [x] Export from adapters/claude-code/index.ts
  - [x] Verify `npm run build` succeeds
  - [x] All tests pass (376 total)

## Dev Notes

### Previous Story Learnings (Story 4.2)

From Story 4.2 Implementation:
- BmadStepRegistry provides step definitions and handlers
- StepHandler type: (input: StepInput, context: StepContext) => Promise<StepOutput>
- StepOutput interface: { content: string, files?: string[], metadata?: Record<string, unknown> }
- Singleton pattern with reset function for testing works well
- Turkish error messages pattern established

### Architecture Compliance

This story creates the **Integration Layer** for Claude Code:

```
[Integration Layer]
    └── adapters/
        ├── index.ts                      ← UPDATED
        └── claude-code/
            ├── index.ts                  ← NEW
            └── claude-code.adapter.ts    ← NEW
```

Per ADR-003: File-Based Claude Code Communication
```typescript
writeFile('.appfabrika/prompt.md', prompt);
spawn('claude', ['--file', '.appfabrika/prompt.md']);
```

### Technical Requirements

**ClaudeCodeExecutionOptions Interface:**

```typescript
interface ClaudeCodeExecutionOptions {
  projectPath: string;
  timeout?: number;        // Default: 300000 (5 min)
  verbose?: boolean;
}
```

**ClaudeCodeResult Interface:**

```typescript
interface ClaudeCodeResult {
  success: boolean;
  output: string;
  exitCode: number;
  duration: number;        // ms
  error?: string;
}
```

**ClaudeCodeAdapter Class:**

```typescript
class ClaudeCodeAdapter {
  constructor(options?: ClaudeCodeExecutionOptions);

  // Availability check
  isAvailable(): Promise<boolean>;
  getVersion(): Promise<string>;

  // File operations
  writePromptFile(prompt: string, stepId: BmadStepType): Promise<string>;

  // Execution
  execute(promptPath: string): Promise<ClaudeCodeResult>;
  executeStep(stepId: BmadStepType, prompt: string): Promise<StepOutput>;
}
```

**Prompt File Location:**

```
<projectPath>/.appfabrika/prompt.md
```

### Library/Framework Requirements

| Package | Version | Usage |
|---------|---------|-------|
| No new packages | - | Uses Node.js child_process |

### PRD/Architecture References

- [Source: architecture.md#ADR-003] - File-Based Claude Code Communication
- [Source: architecture.md#Integration-Layer] - adapters/claude-code/
- [Source: prd.md#FR15] - Development (kod uretimi) adimi
- [Source: prd.md#NFR10] - Claude Code CLI ile sorunsuz calisabilmeli
- [Source: epics.md#Epic-4-Story-4.3] - Claude Code Adapter requirements

### File Structure

```
src/
├── types/
│   ├── index.ts                    ← UPDATE: export claude-code.types
│   └── claude-code.types.ts        ← NEW: Adapter types
├── adapters/
│   ├── index.ts                    ← UPDATE: barrel export
│   └── claude-code/
│       ├── index.ts                ← NEW: module export
│       └── claude-code.adapter.ts  ← NEW: ClaudeCodeAdapter class
tests/
└── adapters/
    └── claude-code/
        └── claude-code.adapter.test.ts  ← NEW: 20 tests
```

### Turkish Error Messages

```typescript
const CLAUDE_CODE_ERRORS = {
  NOT_INSTALLED: 'Claude Code CLI kurulu değil. Lütfen Claude Code\'u kurun.',
  EXECUTION_FAILED: 'Claude Code çalıştırma hatası: {error}',
  TIMEOUT: 'Claude Code zaman aşımına uğradı ({timeout}ms)',
  PROMPT_WRITE_FAILED: 'Prompt dosyası yazılamadı: {path}',
};
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - Claude Code Adapter Types**
   - Created `src/types/claude-code.types.ts` with:
     - ClaudeCodeExecutionOptions interface (projectPath, timeout, verbose)
     - ClaudeCodeResult interface (success, output, exitCode, duration, error)
     - ClaudeCodeExecutionMetadata interface (stepId, promptPath, executedAt, duration, exitCode)
     - CLAUDE_CODE_ERRORS constant with Turkish messages
     - CLAUDE_CODE_DEFAULTS constant (timeout, prompt filename, appfabrika dir)
   - Exported via `src/types/index.ts`

2. **Task 2 - ClaudeCodeAdapter Class**
   - Created `src/adapters/claude-code/claude-code.adapter.ts`
   - Constructor initializes projectPath, timeout, verbose, appfabrikaDir
   - isAvailable() checks if `claude --version` succeeds
   - getVersion() returns Claude Code version string

3. **Task 3 - Prompt File Writing**
   - writePromptFile() creates .appfabrika directory if needed
   - Writes prompt to step-specific file (e.g., step-01-brainstorming-prompt.md)
   - Also writes to standard prompt.md for Claude Code consumption
   - Turkish error message on write failure

4. **Task 4 - Claude Code Execution**
   - execute() spawns `claude --file <promptPath>`
   - Captures stdout and stderr
   - Handles timeout with configurable duration
   - Returns ClaudeCodeResult with success, output, exitCode, duration

5. **Task 5 - BMAD Step Execution**
   - executeStep() combines writePromptFile + execute
   - Returns StepOutput with content and metadata
   - Metadata includes: stepId, promptPath, executedAt, duration, exitCode, success

6. **Task 6 - Error Handling**
   - Turkish error message when Claude Code not installed
   - Timeout handling with SIGTERM
   - Process error handling
   - Graceful failure with error in result

7. **Task 7 - Unit Tests**
   - Created `tests/adapters/claude-code/claude-code.adapter.test.ts`
   - 20 tests covering:
     - Constructor initialization
     - Default timeout
     - Appfabrika directory path
     - writePromptFile creates directory
     - writePromptFile creates step-specific file
     - writePromptFile creates standard prompt.md
     - writePromptFile handles multiple steps
     - writePromptFile overwrites existing
     - isAvailable() returns boolean
     - getVersion() returns version or throws
     - execute() returns error when not installed
     - execute() includes duration
     - executeStep() returns output with metadata
     - executeStep() handles failures
     - executeStep() includes timestamp
     - Singleton behavior
     - Singleton throws without options
     - Singleton resets correctly
     - Turkish error messages
     - Default values

8. **Task 8 - Build & Verify**
   - `npm run build` succeeds
   - 376 tests pass (20 new for this story)
   - Updated adapters/index.ts with claude-code export

### File List

- `src/types/claude-code.types.ts` (NEW) - Claude Code type definitions
- `src/types/index.ts` (MODIFIED) - Added claude-code.types export
- `src/adapters/claude-code/claude-code.adapter.ts` (NEW) - ClaudeCodeAdapter class
- `src/adapters/claude-code/index.ts` (NEW) - Module export with type re-exports
- `src/adapters/index.ts` (MODIFIED) - Added claude-code export
- `tests/adapters/claude-code/claude-code.adapter.test.ts` (NEW) - 20 tests

## Senior Developer Review (AI)

**Review Date:** 2026-02-01
**Review Outcome:** Approved with Minor Fixes

### Issues Found and Addressed

1. **[M1] Race condition in writePromptFile** - FIXED
   - Removed `existsSync` check before `mkdir`
   - Now uses `mkdir({ recursive: true })` directly which handles existing directories
   - Removed unused `existsSync` import

2. **[M3] Unused startTime variable in executeStep** - FIXED
   - Removed unused `startTime` declaration from `executeStep` method
   - Duration is correctly taken from `result.duration`

3. **[L1] ClaudeCodeExecutionMetadata type not exported** - FIXED
   - Added type re-exports in `adapters/claude-code/index.ts`
   - Now exports `ClaudeCodeExecutionOptions`, `ClaudeCodeResult`, `ClaudeCodeExecutionMetadata`
   - Also exports `CLAUDE_CODE_ERRORS` and `CLAUDE_CODE_DEFAULTS`

4. **Deferred to future (optional optimization):**
   - [M2] Double availability check in execute() - Each `execute()` calls `isAvailable()` adding ~1s latency
   - This is acceptable for robustness; could cache result in future if performance is critical

### Post-Review Verification

- `npm run build` succeeds
- 376 tests pass
- All code review fixes applied


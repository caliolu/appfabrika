# Story 2.5: Project Folder Creation

Status: done

## Story

As a **user**,
I want **the system to create a project folder structure**,
So that **my project files are organized**.

## Acceptance Criteria

1. **Given** I have completed all init prompts (idea, LLM, automation)
   **When** the initialization completes
   **Then** a project folder is created with a name derived from the idea
   **And** .appfabrika/ folder is created inside with config and checkpoints

2. **Given** the project folder is being created
   **When** I view the folder structure
   **Then** I see .appfabrika/config.json with project settings
   **And** I see .appfabrika/checkpoints/ folder (empty)

3. **Given** the folder creation is successful
   **When** the init command completes
   **Then** the outro message shows the created project path
   **And** projectPath is stored in ProjectState

4. **Given** a folder with the same name already exists
   **When** the system tries to create the project
   **Then** the system shows an error message
   **And** suggests using a different name or location

5. **Given** I cancel during project name input (if prompted)
   **When** I press Ctrl+C or cancel
   **Then** the system shows cancellation message
   **And** exits gracefully without creating any folders

## Tasks / Subtasks

- [x] Task 1: Add projectPath to ProjectState (AC: #3)
  - [x] Add projectPath field to ProjectState interface in `src/types/project.types.ts`
  - [x] Add ProjectConfig interface for config.json structure
  - [x] Export types via barrel file (already exists)

- [x] Task 2: Implement project name derivation (AC: #1)
  - [x] Create deriveProjectName() function with Turkish character support
  - [x] Convert idea to kebab-case folder name
  - [x] Limit to 50 characters
  - [x] Remove special characters and handle edge cases

- [x] Task 3: Implement folder creation logic (AC: #1, #2)
  - [x] Create project folder in current directory
  - [x] Create .appfabrika/ subfolder
  - [x] Create .appfabrika/config.json with project settings
  - [x] Create .appfabrika/checkpoints/ folder

- [x] Task 4: Handle existing folder conflict (AC: #4)
  - [x] Check if folder already exists before creation
  - [x] Show error message with @clack/prompts cancel()
  - [x] Exit with code 1 for conflict

- [x] Task 5: Update outro message (AC: #3)
  - [x] Include project path in success message
  - [x] Format: "✓ Proje oluşturuldu: {projectPath}"

- [x] Task 6: Write unit tests
  - [x] Test deriveProjectName with various inputs (6 tests)
  - [x] Test folder structure creation
  - [x] Test config.json content verification
  - [x] Test existing folder handling
  - [x] Test project path in outro message

- [x] Task 7: Update build and verify
  - [x] Verify `npm run build` succeeds
  - [x] All 172 tests pass
  - [x] Verify folder creation logic works

## Dev Notes

### Previous Story Learnings (Story 2.4)

From Story 2.4 Implementation and Code Review:
- **vi.resetAllMocks():** Use instead of vi.clearAllMocks() for clean test isolation
- **Helper functions:** setupDefaultMocks() pattern works well for consistent test setup
- **Exact assertions:** Continue using exact string matches
- **State accumulation:** ProjectState continues to grow with each story

### Architecture Compliance

This story extends the **CLI Layer** and adds file system operations:

```
[CLI Layer]
    ├── index.ts
    └── commands/
        └── init.ts       ← EXTEND (add folder creation)

[Types Layer]
    ├── index.ts
    └── project.types.ts  ← EXTEND (add projectPath)

[New: Utils or Services]
    └── project-creator.ts  ← NEW (folder creation logic)
```

**Location:**
- `src/cli/commands/init.ts` (extend)
- `src/types/project.types.ts` (extend)
- `src/services/project-creator.ts` (new - optional, can be inline)

### Technical Requirements

**Project Name Derivation (slugify):**

```typescript
function deriveProjectName(idea: string): string {
  return idea
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')          // Spaces to dashes
    .replace(/-+/g, '-')           // Multiple dashes to single
    .substring(0, 50);             // Limit length
}

// Examples:
// "Restoran rezervasyon uygulaması" → "restoran-rezervasyon-uygulamasi"
// "My Cool App!!!" → "my-cool-app"
```

**Folder Structure:**

```
{project-name}/
  └── .appfabrika/
      ├── config.json
      └── checkpoints/
```

**config.json Content:**

```typescript
interface ProjectConfig {
  version: '1.0.0';
  projectName: string;
  idea: string;
  llmProvider: LLMProvider;
  automationTemplate: AutomationTemplate;
  createdAt: string;  // ISO 8601
}
```

**Updated initCommand Flow:**

```typescript
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export async function initCommand(): Promise<void> {
  p.intro('🏭 AppFabrika - BMAD Proje Başlatıcı');

  // ... existing prompts (idea, llmProvider, automationTemplate) ...

  // Story 2.5 - Project folder creation
  const projectName = deriveProjectName(idea.trim());
  const projectPath = join(process.cwd(), projectName);

  // Check if folder exists
  if (existsSync(projectPath)) {
    p.cancel(`Klasör zaten mevcut: ${projectPath}`);
    process.exit(1);
  }

  // Create folder structure
  const appfabrikaPath = join(projectPath, '.appfabrika');
  const checkpointsPath = join(appfabrikaPath, 'checkpoints');

  await mkdir(checkpointsPath, { recursive: true });

  // Create config.json
  const config: ProjectConfig = {
    version: '1.0.0',
    projectName,
    idea: idea.trim(),
    llmProvider: llmProvider as LLMProvider,
    automationTemplate: automationTemplate as AutomationTemplate,
    createdAt: new Date().toISOString(),
  };

  await writeFile(
    join(appfabrikaPath, 'config.json'),
    JSON.stringify(config, null, 2)
  );

  const state: ProjectState = {
    idea: idea.trim(),
    llmProvider: llmProvider as LLMProvider,
    automationTemplate: automationTemplate as AutomationTemplate,
    projectPath,
  };

  p.outro(`✓ Proje oluşturuldu: ${projectPath}`);
}
```

### Testing Requirements

**Test Pattern:**

```typescript
import { mkdir, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('initCommand - Project folder creation', () => {
  let testDir: string;

  beforeEach(async () => {
    vi.resetAllMocks();
    // Create temp directory for tests
    testDir = join(tmpdir(), `appfabrika-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    // Mock process.cwd to return testDir
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);
  });

  afterEach(async () => {
    // Cleanup
    await rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('should create project folder with correct structure', async () => {
    // Setup mocks...
    await initCommand();

    const projectPath = join(testDir, 'test-fikri');
    expect(existsSync(projectPath)).toBe(true);
    expect(existsSync(join(projectPath, '.appfabrika'))).toBe(true);
    expect(existsSync(join(projectPath, '.appfabrika', 'checkpoints'))).toBe(true);
    expect(existsSync(join(projectPath, '.appfabrika', 'config.json'))).toBe(true);
  });
});
```

### Library/Framework Requirements

| Package | Version | Usage |
|---------|---------|-------|
| fs/promises | built-in | mkdir, writeFile for async file operations |
| fs | built-in | existsSync for sync existence check |
| path | built-in | join for path construction |

**Important:** No new packages needed - using Node.js built-ins.

### PRD/Architecture References

- [Source: prd.md#FR5] - Sistem proje klasörü ve temel yapıyı oluşturabilir
- [Source: architecture.md#ADR-002] - State Persistence: .appfabrika/ folder structure
- [Source: architecture.md#Project-Structure] - Folder organization patterns
- [Source: epics.md#Story-2.5] - Project Folder Creation requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - ProjectState & ProjectConfig Types**
   - Added `projectPath` field to `ProjectState` interface
   - Added new `ProjectConfig` interface for config.json structure
   - Includes version, projectName, idea, llmProvider, automationTemplate, createdAt

2. **Task 2 - Project Name Derivation**
   - Created `deriveProjectName()` function exported from init.ts
   - Handles Turkish characters (ğ, ü, ş, ı, ö, ç → g, u, s, i, o, c)
   - Converts to lowercase, removes special chars, spaces to dashes
   - Limits to 50 characters, trims leading/trailing dashes

3. **Task 3 - Folder Creation**
   - Uses fs/promises for async mkdir and writeFile
   - Creates .appfabrika/checkpoints/ with recursive: true
   - Writes config.json with formatted JSON (2-space indent)

4. **Task 4 - Existing Folder Handling**
   - Uses existsSync to check before creation
   - Shows "Klasör zaten mevcut: {path}" with p.cancel()
   - Exits with code 1 (error exit)

5. **Task 5 - Outro Message**
   - Changed from configuration summary to project path
   - Format: "✓ Proje oluşturuldu: {projectPath}"

6. **Task 6 - Unit Tests**
   - Added 6 tests for deriveProjectName function
   - Added 6 tests for folder creation functionality
   - Mocked fs and fs/promises modules
   - Total: 24 init tests (172 total)

7. **Task 7 - Build & Verify**
   - `npm run build` succeeds
   - All 172 tests pass

### File List

- `src/types/project.types.ts` (MODIFIED) - Added ProjectConfig interface, projectPath field
- `src/cli/commands/init.ts` (MODIFIED) - Added folder creation, deriveProjectName function
- `tests/cli/init.test.ts` (MODIFIED) - Added fs mocks, folder creation tests, deriveProjectName tests

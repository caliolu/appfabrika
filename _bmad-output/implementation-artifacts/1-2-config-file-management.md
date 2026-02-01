# Story 1.2: Config File Management

Status: done

## Story

As a **user**,
I want **AppFabrika to create and manage a config file**,
So that **my preferences are saved between sessions**.

## Acceptance Criteria

1. **Given** no config file exists
   **When** I run appfabrika for the first time
   **Then** `~/.appfabrika/config.json` is created with default values

2. **Given** the config file is created
   **When** I check the file permissions
   **Then** the file permissions are set to chmod 600 (owner read/write only)

3. **Given** a config file already exists
   **When** I run appfabrika
   **Then** the existing config is loaded without overwriting

4. **Given** the config file exists
   **When** I update a preference
   **Then** the config file is updated with the new value and `updatedAt` timestamp

5. **Given** the Architecture defines config structure
   **When** the config file is created
   **Then** it follows this structure:
   ```json
   {
     "version": "1.0.0",
     "llm": { "provider": "openai", "model": "gpt-4" },
     "ui": { "style": "friendly", "language": "tr" },
     "automation": { "defaultTemplate": "full-auto" },
     "createdAt": "ISO8601",
     "updatedAt": "ISO8601"
   }
   ```

## Tasks / Subtasks

- [x] Task 1: Create config types (AC: #5)
  - [x] Create `src/types/config.types.ts` with Config interface
  - [x] Define default config values
  - [x] Export CONFIG_VERSION constant

- [x] Task 2: Implement ConfigManager class (AC: #1, #3, #4)
  - [x] Create `src/core/config.ts` with ConfigManager class
  - [x] Implement `getConfigDir()` - returns `~/.appfabrika`
  - [x] Implement `getConfigPath()` - returns `~/.appfabrika/config.json`
  - [x] Implement `ensureConfigDir()` - creates dir if not exists
  - [x] Implement `load()` - reads and parses config file
  - [x] Implement `save(config)` - writes config to file
  - [x] Implement `update(partial)` - merges partial config and saves
  - [x] Implement `getDefault()` - returns default config

- [x] Task 3: Implement secure file permissions (AC: #2)
  - [x] Set chmod 600 on config.json after creation
  - [x] Set chmod 700 on ~/.appfabrika directory
  - [x] Handle cross-platform (Windows has different permission model)

- [x] Task 4: Add config initialization to CLI entry point
  - [x] Update `src/cli/index.ts` to initialize config on startup
  - [x] Log config status (loaded existing vs created new)

- [x] Task 5: Write unit tests
  - [x] Test config creation with defaults
  - [x] Test config loading
  - [x] Test config updating
  - [x] Test file permissions (on Unix systems)
  - [x] Test config validation

- [x] Task 6: Verify integration
  - [x] Run CLI and verify config is created
  - [x] Verify file permissions
  - [x] Verify config content matches schema

### Review Follow-ups (AI) - FIXED

- [x] [AI-Review][HIGH] isValidConfig() provider/style/template union değerlerini validate etmiyor [src/types/config.types.ts:67-89]
- [x] [AI-Review][HIGH] Singleton pattern resetlenemiyor - test isolation için resetInstance() ekle [src/core/config.ts:189-196]
- [x] [AI-Review][HIGH] Corrupted config JSON için test eksik - load() edge case [tests/core/config.test.ts]
- [x] [AI-Review][MEDIUM] update() version alanını güncellemek için mekanizma yok - migration altyapısı [src/core/config.ts:149-155] (deferred to future story)
- [x] [AI-Review][MEDIUM] vi import kullanılmıyor (dead import) [tests/core/config.test.ts:1]
- [x] [AI-Review][MEDIUM] createdAt preserve davranışı için explicit test eksik [tests/core/config.test.ts]
- [x] [AI-Review][LOW] console.warn yerine Logger kullanılmalı (Logger modülü sonra) [src/core/config.ts:110] (TODO comment added)
- [x] [AI-Review][LOW] DEFAULT_CONFIG tipi için ayrı interface düşünülebilir [src/types/config.types.ts:37] (kept as is, works correctly)

**Additional Fix:** createDefaultConfig() shallow copy bug fixed - nested objects now deep copied to prevent test mutation issues.

## Dev Notes

### Previous Story Learnings (Story 1.1)

From the previous story implementation:
- Project uses ESM modules (`"type": "module"`)
- TypeScript target is ES2022 with NodeNext module resolution
- Test framework is vitest with tests in `tests/` directory
- File naming convention: kebab-case.ts
- Build command: `npm run build`
- Test command: `npm run test:run`

### Architecture Compliance

This story implements the **Foundation Layer** component `ConfigManager`:

```
[Foundation Layer]
    ├── ConfigManager  ← THIS STORY
    ├── ErrorHandler
    └── Logger
```

**Location:** `src/core/config.ts`

### Technical Requirements

**Config Directory Structure (from Architecture):**
```
~/.appfabrika/
  ├── config.json      # LLM tercihi, UI style, defaults (chmod 600)
  └── .env             # API keys (Story 1.3'te eklenecek)
```

**Config Schema (from Architecture):**
```typescript
interface AppConfig {
  version: string;
  llm: {
    provider: 'openai' | 'anthropic';
    model: string;
  };
  ui: {
    style: 'friendly' | 'minimal';
    language: string;
  };
  automation: {
    defaultTemplate: 'full-auto' | 'business-manuel' | 'full-manuel' | 'custom';
  };
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}
```

**Default Config Values:**
```typescript
const DEFAULT_CONFIG: AppConfig = {
  version: '1.0.0',
  llm: { provider: 'openai', model: 'gpt-4' },
  ui: { style: 'friendly', language: 'tr' },
  automation: { defaultTemplate: 'full-auto' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```

### Security Requirements (from PRD NFR5, NFR6, NFR7)

- NFR5: Config file must be readable only by owner
- NFR6: No sensitive data in config.json (API keys go to .env)
- NFR7: File permissions chmod 600

### Cross-Platform Considerations

```typescript
import { homedir } from 'os';
import { chmod, mkdir } from 'fs/promises';
import { platform } from 'os';

const CONFIG_DIR = join(homedir(), '.appfabrika');

// Windows doesn't support Unix permissions - skip chmod on Windows
if (platform() !== 'win32') {
  await chmod(configPath, 0o600);
  await chmod(CONFIG_DIR, 0o700);
}
```

### Error Handling Pattern

Use typed errors from Architecture:
```typescript
import { AppFabrikaError, ErrorCode } from './error.js';

if (!isValidConfig(config)) {
  throw new AppFabrikaError(
    ErrorCode.STATE_CORRUPTED,
    'Config dosyası bozuk',
    'Invalid config structure'
  );
}
```

**Note:** Error handling module will be created in a future story. For now, use simple Error throws.

### References

- [Source: architecture.md#Security-&-Configuration]
- [Source: architecture.md#Config-File-Patterns]
- [Source: prd.md#Konfigurasyon] (FR44-FR47)
- [Source: prd.md#Security] (NFR5-NFR7)
- [Source: epics.md#Story-1.2]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1:** Created `src/types/config.types.ts` with:
   - `AppConfig` interface with all required fields
   - Type definitions: `LLMProvider`, `UIStyle`, `AutomationTemplate`
   - `DEFAULT_CONFIG` constant with default values
   - `CONFIG_VERSION` constant (1.0.0)
   - `createDefaultConfig()` function for generating configs with timestamps
   - `isValidConfig()` type guard for runtime validation

2. **Task 2:** Created `src/core/config.ts` with:
   - `ConfigManager` class with all required methods
   - Lazy initialization for configDir/configPath (to support subclass overrides)
   - Singleton pattern via `getConfigManager()` function
   - Proper merging of partial updates in `update()` method

3. **Task 3:** Implemented secure file permissions:
   - chmod 600 for config.json (owner read/write only)
   - chmod 700 for ~/.appfabrika directory (owner only)
   - Cross-platform handling: permissions skipped on Windows (`platform() !== 'win32'`)

4. **Task 4:** Updated `src/cli/index.ts`:
   - Config initialization on startup
   - Logging: "Config dosyası oluşturuldu" for new configs
   - Logging: "Config yüklendi" for existing configs
   - Display of active settings (LLM, UI, Otomasyon)

5. **Task 5:** Created comprehensive unit tests (30 tests total):
   - `createDefaultConfig()` tests (5 tests)
   - `isValidConfig()` tests (6 tests)
   - `ConfigManager` method tests (17 tests)
   - File permission tests for Unix systems (2 tests)
   - Used `TestConfigManager` subclass with temp directory for isolation

6. **Task 6:** Integration verified:
   - CLI creates config at `~/.appfabrika/config.json`
   - Directory permissions: 700 (drwx------)
   - File permissions: 600 (-rw-------)
   - Config content matches expected schema
   - Existing config loads without overwriting

### File List

- `src/types/config.types.ts` (NEW) - Config types and validation
- `src/core/config.ts` (NEW) - ConfigManager class implementation
- `src/cli/index.ts` (UPDATED) - Added config initialization
- `tests/core/config.test.ts` (NEW) - 30 unit tests for config management

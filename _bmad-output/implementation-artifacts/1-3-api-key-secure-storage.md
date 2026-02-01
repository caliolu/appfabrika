# Story 1.3: API Key Secure Storage

Status: done

## Story

As a **user**,
I want **to save my LLM API keys securely**,
So that **I don't have to enter them every time**.

## Acceptance Criteria

1. **Given** I am setting up AppFabrika
   **When** I enter my OpenAI or Anthropic API key
   **Then** the key is saved to `~/.appfabrika/.env`

2. **Given** the .env file is created
   **When** I check the file permissions
   **Then** the file permissions are set to chmod 600 (owner read/write only)

3. **Given** an API key is saved
   **When** I view logs or error messages
   **Then** the key NEVER appears in any output

4. **Given** the .env file exists
   **When** I run appfabrika
   **Then** the API keys are loaded automatically

5. **Given** the Architecture defines API key format
   **When** the .env file is created
   **Then** it follows this structure:
   ```
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   ```

## Tasks / Subtasks

- [x] Task 1: Create API key types and validation (AC: #5)
  - [x] Create `src/types/api-key.types.ts` with key interfaces
  - [x] Define regex patterns for OpenAI and Anthropic key formats
  - [x] Create `isValidOpenAIKey()` and `isValidAnthropicKey()` validators

- [x] Task 2: Implement SecretManager class (AC: #1, #4)
  - [x] Create `src/core/secrets.ts` with SecretManager class
  - [x] Implement `getEnvPath()` - returns `~/.appfabrika/.env`
  - [x] Implement `loadSecrets()` - reads and parses .env file
  - [x] Implement `saveSecret(key, value)` - saves key to .env file
  - [x] Implement `getSecret(key)` - retrieves secret by key
  - [x] Implement `hasSecret(key)` - checks if secret exists

- [x] Task 3: Implement secure file permissions (AC: #2)
  - [x] Set chmod 600 on .env file after creation
  - [x] Verify directory permissions (700) from ConfigManager
  - [x] Handle cross-platform (Windows has different permission model)

- [x] Task 4: Implement API key masking (AC: #3)
  - [x] Create `maskApiKey()` function that shows only last 4 chars
  - [x] Integrate masking into any log/error output
  - [x] Add masking to SecretManager getter (optional masked return)

- [x] Task 5: Write unit tests
  - [x] Test .env file creation
  - [x] Test secret loading and saving
  - [x] Test file permissions (on Unix systems)
  - [x] Test API key validation (valid/invalid formats)
  - [x] Test API key masking

- [x] Task 6: Verify integration
  - [x] Test saving OpenAI key and verify .env content
  - [x] Test saving Anthropic key and verify .env content
  - [x] Verify file permissions
  - [x] Verify key masking in output

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] H1: OPENAI_KEY_PATTERN gerçek key formatlarını desteklemiyor - `sk-proj-` (164+ char), `sk-svcacct-` formatları eksik [src/types/api-key.types.ts:26] - FIXED: Negative lookahead + svcacct desteği eklendi
- [x] [AI-Review][HIGH] H2: `createApiKeyInfo()` invalid key için `type: 'openai'` default veriyor - yanlış provider'a istek riski [src/types/api-key.types.ts:93] - FIXED: ApiKeyTypeWithUnknown tipi ve 'unknown' default eklendi
- [x] [AI-Review][HIGH] H3: Task 3 "Verify directory permissions (700)" marked [x] but not implemented - permission check missing [src/core/secrets.ts:72-75] - VERIFIED: ConfigManager.ensureConfigDir() handles 700 permissions (config.ts:71)
- [x] [AI-Review][MEDIUM] M1: `parseEnvFile` quoted value desteklemiyor (`"value"` veya `'value'`) [src/core/secrets.ts:27] - FIXED: Quote stripping eklendi
- [x] [AI-Review][MEDIUM] M2: `saveSecret` key validation yapmıyor - boş/invalid key isimleri kabul ediliyor [src/core/secrets.ts:116] - FIXED: Env variable name validation eklendi
- [x] [AI-Review][MEDIUM] M3: TestConfigManager tanımlı ama kullanılmıyor - dead code [tests/core/secrets.test.ts:30-46] - FIXED: Dead code kaldırıldı
- [x] [AI-Review][MEDIUM] M4: `clearCache()` `_envPath` cache'ini temizlemiyor [src/core/secrets.ts:211-213] - FIXED: _envPath = null eklendi
- [x] [AI-Review][LOW] L1: Architecture vs implementasyon regex sırası farklı (`-_` vs `_-`) [src/types/api-key.types.ts:32] - NOTED: Fonksiyonel olarak aynı, değişiklik gerekmez
- [x] [AI-Review][LOW] L2: `removeSecret` JSDoc eksik - hata durumları açıklanmamış [src/core/secrets.ts:164-166] - FIXED: JSDoc @remarks eklendi

#### Round 2 Follow-ups

- [x] [AI-Review][MEDIUM] M5: `saveSecret` cache'e untrimmed key kaydediyor - `this.secrets![key]` yerine `this.secrets![trimmedKey]` olmalı [src/core/secrets.ts:145] - FIXED
- [x] [AI-Review][LOW] L3: `clearCache` için `_envPath` temizleme testi eksik [tests/core/secrets.test.ts:396-408] - FIXED: Test eklendi
- [x] [AI-Review][LOW] L4: `serializeEnvFile` özel karakterleri escape etmiyor - newline/special chars riski [src/core/secrets.ts:50-52] - FIXED: Quote + escape handling eklendi

#### Round 3 Follow-ups

- [x] [AI-Review][HIGH] H4: `parseEnvFile` escape processing order bug - `\\n` yanlış parse ediliyor [src/core/secrets.ts:32-35] - FIXED: Single-pass regex ile düzeltildi
- [x] [AI-Review][LOW] L5: `createApiKeyInfo` raw key saklar - design note, caller ihtiyacı için kabul edildi

## Dev Notes

### Previous Story Learnings (Story 1.2)

From the previous story implementation:
- **Deep copy required:** `createDefaultConfig()` had shallow copy bug - use spread for nested objects
- **Lazy initialization:** ConfigManager uses lazy getters to support subclass overrides in tests
- **TestConfigManager pattern:** Use subclass with temp directory for test isolation
- **Union validation:** `isValidConfig()` now validates enum values, not just string types
- **Singleton reset:** Added `resetConfigManager()` for test isolation
- **chmod always:** Set permissions on every ensureConfigDir() call, not just on creation

### Architecture Compliance

This story implements the **Foundation Layer** component for secrets management:

```
[Foundation Layer]
    ├── ConfigManager  ← Story 1.2 (done)
    ├── SecretManager  ← THIS STORY
    ├── ErrorHandler
    └── Logger
```

**Location:** `src/core/secrets.ts`

### Technical Requirements

**Config Directory Structure (from Architecture):**
```
~/.appfabrika/
  ├── config.json      # LLM tercihi, UI style, defaults (chmod 600) - Story 1.2
  └── .env             # API keys (chmod 600) - THIS STORY
```

**API Key Format (from Architecture):**
```typescript
// OpenAI key format: sk-...
const OPENAI_KEY_PATTERN = /^sk-[a-zA-Z0-9]{32,}$/;

// Anthropic key format: sk-ant-...
const ANTHROPIC_KEY_PATTERN = /^sk-ant-[a-zA-Z0-9-_]{32,}$/;
```

**SecretManager Interface:**
```typescript
interface SecretManager {
  getEnvPath(): string;
  loadSecrets(): Promise<Record<string, string>>;
  saveSecret(key: string, value: string): Promise<void>;
  getSecret(key: string): Promise<string | undefined>;
  hasSecret(key: string): Promise<boolean>;
}
```

### Security Requirements (from PRD NFR5, NFR6, NFR7)

- **NFR5:** LLM API key'leri şifrelenmis olarak saklanmali
  - V1 Implementation: chmod 600 file permissions (encryption deferred to V2)
- **NFR6:** API key'ler log'larda veya hata mesajlarinda gorunmemeli
  - Implement `maskApiKey()` function
- **NFR7:** Konfigurasyon dosyasi sadece kullanici tarafindan okunabilir olmali
  - chmod 600 for .env file

### API Key Masking Pattern

```typescript
function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

// Example:
// sk-abc123xyz789... → sk-a...789
// sk-ant-api1234567890 → sk-a...890
```

### Cross-Platform Considerations

```typescript
import { platform } from 'os';

// Windows doesn't support Unix permissions - skip chmod on Windows
if (platform() !== 'win32') {
  await chmod(envPath, 0o600);
}
```

### .env File Format

Use standard dotenv format:
```
# AppFabrika API Keys
# Generated: 2026-01-31

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

**Implementation Note:** Use simple line parsing (no external dotenv dependency) to keep package lightweight:

```typescript
function parseEnvFile(content: string): Record<string, string> {
  const secrets: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length) {
      secrets[key.trim()] = valueParts.join('=').trim();
    }
  }
  return secrets;
}
```

### Integration with ConfigManager

SecretManager should reuse ConfigManager's directory management:

```typescript
import { getConfigManager } from './config.js';

class SecretManager {
  getEnvPath(): string {
    const configManager = getConfigManager();
    return join(configManager.getConfigDir(), '.env');
  }

  async ensureConfigDir(): Promise<void> {
    const configManager = getConfigManager();
    await configManager.ensureConfigDir();
  }
}
```

### References

- [Source: architecture.md#Security-&-Configuration]
- [Source: architecture.md#API-Key-Storage]
- [Source: prd.md#Konfigurasyon] (FR44-FR47)
- [Source: prd.md#Security] (NFR5-NFR7)
- [Source: epics.md#Story-1.3]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **API Key Types Implementation (Task 1)**
   - Created `src/types/api-key.types.ts` with `ApiKeyType`, `ApiKeyInfo` types
   - Defined `OPENAI_KEY_PATTERN = /^sk-(?:proj-)?[a-zA-Z0-9]{32,}$/` (supports project keys)
   - Defined `ANTHROPIC_KEY_PATTERN = /^sk-ant-[a-zA-Z0-9_-]{32,}$/`
   - Implemented validators: `isValidOpenAIKey()`, `isValidAnthropicKey()`, `detectApiKeyType()`
   - Implemented `maskApiKey()` showing first 4 and last 4 chars
   - Implemented `createApiKeyInfo()` for complete key metadata

2. **SecretManager Implementation (Task 2)**
   - Created `src/core/secrets.ts` with full SecretManager class
   - Uses ConfigManager for directory management (lazy initialization)
   - Implements caching for loaded secrets
   - Singleton pattern with `getSecretManager()` and `resetSecretManager()`
   - Simple .env parsing without external dependencies

3. **Secure File Permissions (Task 3)**
   - chmod 600 applied on every saveSecret/removeSecret operation
   - Cross-platform: skips chmod on Windows (`platform() !== 'win32'`)
   - Reuses ConfigManager's ensureConfigDir() for directory setup

4. **API Key Masking (Task 4)**
   - `maskApiKey()` returns `****` for keys ≤8 chars
   - `getSecretMasked()` method for safe logging
   - Re-exported from secrets.ts for convenience

5. **Unit Tests (Task 5)**
   - 53 tests covering all functionality
   - TestSecretManager subclass with temp directory for isolation
   - Unix-specific permission tests (skipped on Windows)
   - Edge cases: null/undefined handling, empty strings, values with = sign

6. **Key Learnings**
   - Test key strings must be ≥32 chars to pass validation
   - Applied Story 1.2 learnings: singleton reset, lazy initialization, TestManager pattern

7. **Code Review Fixes (Round 1)**
   - H1: Added `sk-svcacct-` support and negative lookahead `(?!ant-)` to prevent Anthropic match
   - H2: Added `ApiKeyTypeWithUnknown` type, `createApiKeyInfo` now returns `'unknown'` for invalid keys
   - M1: Added quoted value support (strips `"..."` and `'...'`)
   - M2: Added key validation (valid env variable names only)
   - M3: Removed unused TestConfigManager dead code
   - M4: `clearCache()` now also clears `_envPath`
   - L2: Added JSDoc @remarks to `removeSecret()`

8. **Code Review Fixes (Round 2)**
   - M5: Fixed `saveSecret` to use `trimmedKey` in cache
   - L3: Added test for `clearCache` clearing `_envPath`
   - L4: Added escape handling for special chars in `serializeEnvFile` and `parseEnvFile`

9. **Code Review Fixes (Round 3)**
   - H4: Fixed `parseEnvFile` escape processing with single-pass regex
   - Added round-trip tests for backslash-n literal, newline, and complex escapes

### File List

- `src/types/api-key.types.ts` (NEW)
- `src/core/secrets.ts` (NEW)
- `tests/core/secrets.test.ts` (NEW)

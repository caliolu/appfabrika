# Epic 1 Retrospective: CLI Foundation & Configuration

Status: done
Date: 2026-01-31

## Executive Summary

Epic 1 established the foundation layer for AppFabrika. Across 4 stories, **146 tests** were written and **27 code review issues** were identified and resolved.

## Story Analysis

| Story | Tests | Review Rounds | HIGH | MEDIUM | LOW |
|-------|-------|---------------|------|--------|-----|
| 1-1 Project Setup | 16 | 1 | 3 | 0 | 0 |
| 1-2 Config File Management | 37 | 1 | 3 | 5 | 0 |
| 1-3 API Key Secure Storage | 71 | 3 | 4 | 5 | 0 |
| 1-4 Default Preferences | 22 | 1 | 1 | 4 | 2 |
| **TOTAL** | **146** | - | **11** | **14** | **2** |

## What Went Well

1. **Singleton + Reset Pattern**: Learned in Story 1-2, successfully applied in subsequent stories
2. **Thin Wrapper Design**: PreferencesManager -> ConfigManager delegation stayed clean
3. **Test Coverage**: Every story met 100% acceptance criteria
4. **Adversarial Review**: Code review caught HIGH issues before production
5. **Documentation**: Dev Notes section transferred lessons learned between stories

## Recurring Patterns (Issues Found Multiple Times)

### 1. Validation Logic Bugs
- **1-2:** `validateProvider()` accepted empty strings
- **1-3:** `validateApiKey()` missing whitespace-only check
- **1-4:** `validateAndNormalizeProvider()` not saving trimmed value

**Root Cause:** Validation functions computed trimmed value but used original value.

**Solution:** Rename to `validateAndNormalize*()` and return the trimmed/normalized value.

### 2. Test Isolation Issues
- **1-2:** ConfigManager state leaking between tests
- **1-3:** SecretManager singleton reset was missing
- **1-4:** Test pollution caused "default values" test to fail

**Root Cause:** Singleton pattern without proper reset in test setup.

**Solution:** Always implement `reset*()` function, use `beforeEach/afterEach` consistently.

### 3. Dead Code Accumulation
- **1-3:** Unused `path` import, `TestSecretManager` variable
- **1-4:** Unused `TestConfigManager` class, `readFile` import

**Root Cause:** Refactoring left behind unused code.

**Solution:** Run dead code check before PR (unused imports, variables).

### 4. Deep Copy Issues
- **1-2:** Missing nested object spread - mutation risk
- **1-3:** Config object reference sharing

**Root Cause:** Spread operator only works one level deep.

**Solution:** Use `structuredClone()` for nested objects or implement proper deep copy.

## Areas for Improvement

1. **Validation First:** Every validation function should return normalized value
2. **Test Template:** Standardize `beforeEach` reset pattern across all tests
3. **Dead Code Check:** Add unused import/code check to PR checklist
4. **TypeScript Strictness:** Use `as const` assertions earlier in validation

## Learnings for Future Epics

| Learning | Applicable Epic |
|----------|-----------------|
| Singleton reset function is mandatory | Epic 3 (LLM Adapters) |
| Validation -> Normalize -> Return pattern | Epic 4 (Workflow Engine) |
| Deep copy with structuredClone | Epic 5 (Workflow Control) |
| Test isolation with beforeEach/afterEach | All epics |

## Metrics

- **Production Code:** ~450 lines
- **Test Code:** ~600 lines
- **Test/Code Ratio:** 1.33
- **Average Issues per Story:** 4
- **Most Complex Story:** 1-3 (71 tests, 3 review rounds)

## Foundation Layer Status

```
[Foundation Layer] COMPLETE
    ├── ConfigManager     ✓ Story 1.2
    ├── SecretManager     ✓ Story 1.3
    ├── PreferencesManager ✓ Story 1.4
    ├── ErrorHandler      → Epic 7
    └── Logger            → Epic 6
```

## Action Items for Next Epic

1. [ ] Add validation normalize pattern to coding standards
2. [ ] Create test template with reset boilerplate
3. [ ] Document singleton + reset pattern in architecture

## Next Steps

Epic 2 (Project Initialization) is ready to start. Recommended first story: 2-1-init-command-entry-point.

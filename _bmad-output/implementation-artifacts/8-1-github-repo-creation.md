# Story 8.1: GitHub Repo Creation

Status: done

## Story

As a **user**,
I want **the system to create a GitHub repository**,
So that **my project is hosted online**.

## Acceptance Criteria

1. **Given** the BMAD workflow has completed
   **When** the GitHub integration step runs
   **Then** Claude Code creates a new GitHub repo via gh CLI

2. **Given** gh CLI is not installed
   **When** attempting to create repo
   **Then** user sees helpful error message

3. **Given** gh CLI is not authenticated
   **When** attempting to create repo
   **Then** user is prompted to authenticate

## Tasks / Subtasks

- [x] Task 1: Create GitHubService (AC: #1)
  - [x] Create src/adapters/github/github-service.ts
  - [x] checkGhCliAvailable() - verify gh is installed
  - [x] checkGhAuthenticated() - verify gh is logged in
  - [x] createRepository() - create new repo via gh CLI

- [x] Task 2: Implement repo creation (AC: #1)
  - [x] generateRepoName() - generate valid repo name
  - [x] Support public/private option
  - [x] Return repo URL on success

- [x] Task 3: Handle errors (AC: #2, #3)
  - [x] GitHubError class for error handling
  - [x] Turkish error messages for common cases
  - [x] GitHubErrorCode enum for error types

- [x] Task 4: Write tests
  - [x] Test gh CLI availability check
  - [x] Test authentication check
  - [x] Test repo creation
  - [x] Test error handling

## Dev Notes

### Architecture Compliance

Per FR48: Sistem proje tamamlandiginda GitHub reposu olusturabilir
Per NFR11: GitHub API (gh CLI) ile uyumlu olmali

GitHub integration via gh CLI:
```bash
# Check if gh is available
gh --version

# Check if authenticated
gh auth status

# Create repository
gh repo create <name> --public --source=. --remote=origin
```

### PRD/Architecture References

- [Source: prd.md#FR48] - Sistem proje tamamlandığında GitHub reposu oluşturabilir
- [Source: architecture.md#NFR11] - GitHub API (gh CLI) ile uyumlu olmalı
- [Source: epics.md#Epic-8-Story-8.1] - GitHub Repo Creation

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1 - GitHubService**
   - Created GitHubService class with singleton pattern
   - checkGhCliAvailable() verifies gh is installed
   - checkGhAuthenticated() returns AuthStatus with username
   - getGhVersion() returns version string

2. **Task 2 - Repo Creation**
   - createRepository() creates repo via gh CLI
   - generateRepoName() sanitizes project name for GitHub
   - Supports public/private visibility
   - Returns CreateRepoResult with repoUrl and fullName

3. **Task 3 - Error Handling**
   - GitHubError class with factory methods
   - GitHubErrorCode enum: CLI_NOT_FOUND, NOT_AUTHENTICATED, REPO_EXISTS, etc.
   - GITHUB_ERRORS and GITHUB_MESSAGES constants in Turkish

4. **Task 4 - Tests**
   - 30 new tests for GitHubService
   - Mocked exec for CLI command testing
   - Tests for all error scenarios
   - 788 total tests passing

### File List

- `src/adapters/github/github-service.ts` (NEW) - GitHubService implementation
- `src/adapters/github/index.ts` (NEW) - Barrel export
- `tests/adapters/github/github-service.test.ts` (NEW) - 30 tests

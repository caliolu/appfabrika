/**
 * GitHub Adapter - Barrel Export
 */

export {
  GitHubService,
  getGitHubService,
  resetGitHubService,
  GitHubError,
  GitHubErrorCode,
  GITHUB_ERRORS,
  GITHUB_MESSAGES,
  type CreateRepoOptions,
  type CreateRepoResult,
  type AuthStatus,
  type RepoVisibility,
  type PushOptions,
  type PushResult,
} from './github-service.js';

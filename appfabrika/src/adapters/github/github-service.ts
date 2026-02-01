/**
 * GitHub Service
 * Handles GitHub repository operations via gh CLI
 * Implements Story 8.1 - GitHub Repo Creation
 * Implements Story 8.2 - Code Push to GitHub
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const execAsync = promisify(exec);

/**
 * GitHub error codes
 */
export enum GitHubErrorCode {
  /** gh CLI not installed */
  CLI_NOT_FOUND = 'CLI_NOT_FOUND',
  /** gh CLI not authenticated */
  NOT_AUTHENTICATED = 'NOT_AUTHENTICATED',
  /** Repository already exists */
  REPO_EXISTS = 'REPO_EXISTS',
  /** Network error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Permission denied */
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  /** Git not installed */
  GIT_NOT_FOUND = 'GIT_NOT_FOUND',
  /** Git initialization failed */
  GIT_INIT_FAILED = 'GIT_INIT_FAILED',
  /** Git commit failed */
  GIT_COMMIT_FAILED = 'GIT_COMMIT_FAILED',
  /** Git push failed */
  GIT_PUSH_FAILED = 'GIT_PUSH_FAILED',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * GitHub error class
 */
export class GitHubError extends Error {
  readonly code: GitHubErrorCode;
  readonly userMessage: string;
  readonly technicalDetails?: string;

  constructor(
    code: GitHubErrorCode,
    userMessage: string,
    technicalDetails?: string
  ) {
    super(userMessage);
    this.name = 'GitHubError';
    this.code = code;
    this.userMessage = userMessage;
    this.technicalDetails = technicalDetails;
  }

  static cliNotFound(details?: string): GitHubError {
    return new GitHubError(
      GitHubErrorCode.CLI_NOT_FOUND,
      GITHUB_ERRORS.CLI_NOT_FOUND,
      details
    );
  }

  static notAuthenticated(details?: string): GitHubError {
    return new GitHubError(
      GitHubErrorCode.NOT_AUTHENTICATED,
      GITHUB_ERRORS.NOT_AUTHENTICATED,
      details
    );
  }

  static repoExists(repoName: string): GitHubError {
    return new GitHubError(
      GitHubErrorCode.REPO_EXISTS,
      GITHUB_ERRORS.REPO_EXISTS.replace('{repoName}', repoName)
    );
  }

  static networkError(details?: string): GitHubError {
    return new GitHubError(
      GitHubErrorCode.NETWORK_ERROR,
      GITHUB_ERRORS.NETWORK_ERROR,
      details
    );
  }

  static permissionDenied(details?: string): GitHubError {
    return new GitHubError(
      GitHubErrorCode.PERMISSION_DENIED,
      GITHUB_ERRORS.PERMISSION_DENIED,
      details
    );
  }

  static unknown(details?: string): GitHubError {
    return new GitHubError(
      GitHubErrorCode.UNKNOWN,
      GITHUB_ERRORS.UNKNOWN,
      details
    );
  }

  static gitNotFound(details?: string): GitHubError {
    return new GitHubError(
      GitHubErrorCode.GIT_NOT_FOUND,
      GITHUB_ERRORS.GIT_NOT_FOUND,
      details
    );
  }

  static gitInitFailed(details?: string): GitHubError {
    return new GitHubError(
      GitHubErrorCode.GIT_INIT_FAILED,
      GITHUB_ERRORS.GIT_INIT_FAILED,
      details
    );
  }

  static gitCommitFailed(details?: string): GitHubError {
    return new GitHubError(
      GitHubErrorCode.GIT_COMMIT_FAILED,
      GITHUB_ERRORS.GIT_COMMIT_FAILED,
      details
    );
  }

  static gitPushFailed(details?: string): GitHubError {
    return new GitHubError(
      GitHubErrorCode.GIT_PUSH_FAILED,
      GITHUB_ERRORS.GIT_PUSH_FAILED,
      details
    );
  }
}

/**
 * Turkish error messages for GitHub operations
 */
export const GITHUB_ERRORS = {
  CLI_NOT_FOUND: 'GitHub CLI (gh) bulunamadı. Lütfen gh CLI\'ı yükleyin: https://cli.github.com',
  NOT_AUTHENTICATED: 'GitHub\'a giriş yapılmadı. Lütfen `gh auth login` komutunu çalıştırın.',
  REPO_EXISTS: '"{repoName}" adında bir repo zaten mevcut.',
  NETWORK_ERROR: 'GitHub\'a bağlanılamadı. İnternet bağlantınızı kontrol edin.',
  PERMISSION_DENIED: 'GitHub işlemi için yetki yok. Hesap izinlerini kontrol edin.',
  UNKNOWN: 'GitHub işlemi sırasında beklenmedik bir hata oluştu.',
  REPO_CREATE_FAILED: 'GitHub repo oluşturulamadı: {reason}',
  GIT_NOT_FOUND: 'Git bulunamadı. Lütfen git\'i yükleyin: https://git-scm.com',
  GIT_INIT_FAILED: 'Git deposu başlatılamadı.',
  GIT_COMMIT_FAILED: 'Değişiklikler commit edilemedi.',
  GIT_PUSH_FAILED: 'Kod GitHub\'a gönderilemedi.',
} as const;

/**
 * Turkish success messages for GitHub operations
 */
export const GITHUB_MESSAGES = {
  CLI_AVAILABLE: 'GitHub CLI mevcut',
  AUTHENTICATED: 'GitHub\'a giriş yapılmış',
  REPO_CREATED: 'GitHub repo oluşturuldu: {repoUrl}',
  CREATING_REPO: 'GitHub repo oluşturuluyor...',
  GIT_AVAILABLE: 'Git mevcut',
  GIT_INITIALIZED: 'Git deposu başlatıldı',
  COMMITTED: 'Değişiklikler commit edildi',
  PUSHED: 'Kod GitHub\'a gönderildi: {repoUrl}',
  PUSHING: 'Kod GitHub\'a gönderiliyor...',
} as const;

/**
 * Repository visibility options
 */
export type RepoVisibility = 'public' | 'private';

/**
 * Repository creation options
 */
export interface CreateRepoOptions {
  /** Repository name */
  name: string;
  /** Repository description */
  description?: string;
  /** Repository visibility */
  visibility?: RepoVisibility;
  /** Path to source directory */
  sourcePath?: string;
  /** Add as remote origin */
  addRemote?: boolean;
}

/**
 * Repository creation result
 */
export interface CreateRepoResult {
  /** Whether creation was successful */
  success: boolean;
  /** Repository URL */
  repoUrl?: string;
  /** Repository name with owner */
  fullName?: string;
  /** Error if creation failed */
  error?: GitHubError;
}

/**
 * GitHub authentication status
 */
export interface AuthStatus {
  /** Whether authenticated */
  authenticated: boolean;
  /** Username if authenticated */
  username?: string;
  /** Error if not authenticated */
  error?: string;
}

/**
 * Push options
 */
export interface PushOptions {
  /** Path to project directory */
  projectPath: string;
  /** Commit message */
  commitMessage?: string;
  /** Branch name */
  branch?: string;
  /** Remote name */
  remote?: string;
}

/**
 * Push result
 */
export interface PushResult {
  /** Whether push was successful */
  success: boolean;
  /** Commit hash if successful */
  commitHash?: string;
  /** Error if push failed */
  error?: GitHubError;
}

/**
 * Service for GitHub operations via gh CLI
 */
export class GitHubService {
  private readonly timeout: number;

  /**
   * Create a new GitHubService
   * @param timeout - Command timeout in milliseconds (default: 30000)
   */
  constructor(timeout: number = 30000) {
    this.timeout = timeout;
  }

  /**
   * Check if gh CLI is available
   * @returns True if gh CLI is installed
   */
  async checkGhCliAvailable(): Promise<boolean> {
    try {
      await execAsync('gh --version', { timeout: this.timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get gh CLI version
   * @returns Version string or null if not available
   */
  async getGhVersion(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('gh --version', { timeout: this.timeout });
      const match = stdout.match(/gh version ([\d.]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if gh CLI is authenticated
   * @returns Authentication status
   */
  async checkGhAuthenticated(): Promise<AuthStatus> {
    try {
      const { stdout } = await execAsync('gh auth status', { timeout: this.timeout });

      // Parse username from output
      const usernameMatch = stdout.match(/Logged in to github\.com account (\S+)/i) ||
                           stdout.match(/Logged in to github\.com as (\S+)/i);

      return {
        authenticated: true,
        username: usernameMatch ? usernameMatch[1] : undefined,
      };
    } catch (error) {
      const stderr = (error as any).stderr || '';
      return {
        authenticated: false,
        error: stderr || 'Not authenticated',
      };
    }
  }

  /**
   * Create a new GitHub repository
   * @param options - Repository creation options
   * @returns Creation result
   */
  async createRepository(options: CreateRepoOptions): Promise<CreateRepoResult> {
    // Check if gh CLI is available
    const cliAvailable = await this.checkGhCliAvailable();
    if (!cliAvailable) {
      return {
        success: false,
        error: GitHubError.cliNotFound(),
      };
    }

    // Check if authenticated
    const authStatus = await this.checkGhAuthenticated();
    if (!authStatus.authenticated) {
      return {
        success: false,
        error: GitHubError.notAuthenticated(authStatus.error),
      };
    }

    // Build command
    const visibility = options.visibility === 'private' ? '--private' : '--public';
    const description = options.description
      ? `--description "${options.description.replace(/"/g, '\\"')}"`
      : '';
    const source = options.sourcePath ? `--source="${options.sourcePath}"` : '';
    const remote = options.addRemote !== false ? '--remote=origin' : '';

    const command = `gh repo create ${options.name} ${visibility} ${description} ${source} ${remote}`.trim();

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: this.timeout });

      // Parse repo URL from output
      const urlMatch = stdout.match(/https:\/\/github\.com\/[\w-]+\/[\w-]+/);
      const repoUrl = urlMatch ? urlMatch[0] : `https://github.com/${authStatus.username}/${options.name}`;

      return {
        success: true,
        repoUrl,
        fullName: `${authStatus.username}/${options.name}`,
      };
    } catch (error) {
      const stderr = (error as any).stderr || '';
      const message = (error as Error).message || '';

      // Check for specific error types
      if (stderr.includes('already exists') || message.includes('already exists')) {
        return {
          success: false,
          error: GitHubError.repoExists(options.name),
        };
      }

      if (stderr.includes('permission') || message.includes('permission')) {
        return {
          success: false,
          error: GitHubError.permissionDenied(stderr),
        };
      }

      if (stderr.includes('network') || message.includes('connect')) {
        return {
          success: false,
          error: GitHubError.networkError(stderr),
        };
      }

      return {
        success: false,
        error: GitHubError.unknown(stderr || message),
      };
    }
  }

  /**
   * Generate a valid repository name from project name
   * @param projectName - Original project name
   * @returns Valid GitHub repository name
   */
  generateRepoName(projectName: string): string {
    return projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100); // GitHub has a 100 char limit
  }

  /**
   * Get repository URL for a given name
   * @param repoName - Repository name
   * @param username - GitHub username
   * @returns Full repository URL
   */
  getRepoUrl(repoName: string, username: string): string {
    return `https://github.com/${username}/${repoName}`;
  }

  /**
   * Check if git is available
   * @returns True if git is installed
   */
  async checkGitAvailable(): Promise<boolean> {
    try {
      await execAsync('git --version', { timeout: this.timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get git version
   * @returns Version string or null if not available
   */
  async getGitVersion(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git --version', { timeout: this.timeout });
      const match = stdout.match(/git version ([\d.]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if directory is a git repository
   * @param projectPath - Path to check
   * @returns True if .git directory exists
   */
  isGitInitialized(projectPath: string): boolean {
    return existsSync(join(projectPath, '.git'));
  }

  /**
   * Initialize a git repository
   * @param projectPath - Path to initialize
   * @returns True if successful
   */
  async initializeGit(projectPath: string): Promise<boolean> {
    try {
      await execAsync('git init', { cwd: projectPath, timeout: this.timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Stage and commit all files
   * @param projectPath - Path to the project
   * @param message - Commit message
   * @returns Commit hash if successful, null otherwise
   */
  async addAndCommit(projectPath: string, message: string): Promise<string | null> {
    try {
      // Stage all files
      await execAsync('git add -A', { cwd: projectPath, timeout: this.timeout });

      // Create commit
      const { stdout } = await execAsync(
        `git commit -m "${message.replace(/"/g, '\\"')}"`,
        { cwd: projectPath, timeout: this.timeout }
      );

      // Extract commit hash
      const hashMatch = stdout.match(/\[[\w-]+ ([a-f0-9]+)\]/);
      return hashMatch ? hashMatch[1] : null;
    } catch (error) {
      // Check if there's nothing to commit
      const stderr = (error as any).stderr || '';
      if (stderr.includes('nothing to commit')) {
        return 'no-changes';
      }
      return null;
    }
  }

  /**
   * Push to remote repository
   * @param projectPath - Path to the project
   * @param remote - Remote name (default: origin)
   * @param branch - Branch name (default: main)
   * @returns True if successful
   */
  async pushToRemote(
    projectPath: string,
    remote: string = 'origin',
    branch: string = 'main'
  ): Promise<boolean> {
    try {
      await execAsync(
        `git push -u ${remote} ${branch}`,
        { cwd: projectPath, timeout: this.timeout }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set git config for the repository
   * @param projectPath - Path to the project
   * @param name - User name
   * @param email - User email
   */
  async setGitConfig(projectPath: string, name: string, email: string): Promise<void> {
    await execAsync(`git config user.name "${name}"`, { cwd: projectPath, timeout: this.timeout });
    await execAsync(`git config user.email "${email}"`, { cwd: projectPath, timeout: this.timeout });
  }

  /**
   * Push project to GitHub (full workflow)
   * @param options - Push options
   * @returns Push result
   */
  async pushProjectToGitHub(options: PushOptions): Promise<PushResult> {
    const {
      projectPath,
      commitMessage = 'Initial commit from AppFabrika',
      branch = 'main',
      remote = 'origin',
    } = options;

    // Check if git is available
    const gitAvailable = await this.checkGitAvailable();
    if (!gitAvailable) {
      return {
        success: false,
        error: GitHubError.gitNotFound(),
      };
    }

    // Initialize git if needed
    if (!this.isGitInitialized(projectPath)) {
      const initSuccess = await this.initializeGit(projectPath);
      if (!initSuccess) {
        return {
          success: false,
          error: GitHubError.gitInitFailed(),
        };
      }
    }

    // Stage and commit
    const commitHash = await this.addAndCommit(projectPath, commitMessage);
    if (!commitHash) {
      return {
        success: false,
        error: GitHubError.gitCommitFailed(),
      };
    }

    // Push to remote
    const pushSuccess = await this.pushToRemote(projectPath, remote, branch);
    if (!pushSuccess) {
      return {
        success: false,
        error: GitHubError.gitPushFailed(),
      };
    }

    return {
      success: true,
      commitHash: commitHash === 'no-changes' ? undefined : commitHash,
    };
  }
}

/**
 * Singleton instance
 */
let instance: GitHubService | null = null;

/**
 * Get or create the singleton GitHubService instance
 * @param timeout - Optional timeout for commands
 * @returns The GitHubService instance
 */
export function getGitHubService(timeout?: number): GitHubService {
  if (!instance) {
    instance = new GitHubService(timeout);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetGitHubService(): void {
  instance = null;
}

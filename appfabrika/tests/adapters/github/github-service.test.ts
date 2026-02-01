/**
 * GitHubService Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  GitHubService,
  getGitHubService,
  resetGitHubService,
  GitHubError,
  GitHubErrorCode,
  GITHUB_ERRORS,
  GITHUB_MESSAGES,
} from '../../../src/adapters/github/github-service.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

// Mock fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

const mockExec = vi.mocked(exec);
const mockExistsSync = vi.mocked(existsSync);

describe('GitHubService', () => {
  let githubService: GitHubService;

  beforeEach(() => {
    resetGitHubService();
    githubService = new GitHubService(5000);
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetGitHubService();
  });

  describe('constructor', () => {
    it('should create with default timeout', () => {
      const service = new GitHubService();
      expect(service).toBeInstanceOf(GitHubService);
    });

    it('should create with custom timeout', () => {
      const service = new GitHubService(10000);
      expect(service).toBeInstanceOf(GitHubService);
    });
  });

  describe('checkGhCliAvailable', () => {
    it('should return true when gh CLI is available', async () => {
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callback!(null, { stdout: 'gh version 2.40.0', stderr: '' } as any, '');
        return {} as any;
      });

      const result = await githubService.checkGhCliAvailable();
      expect(result).toBe(true);
    });

    it('should return false when gh CLI is not available', async () => {
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callback!(new Error('command not found'), { stdout: '', stderr: '' } as any, '');
        return {} as any;
      });

      const result = await githubService.checkGhCliAvailable();
      expect(result).toBe(false);
    });
  });

  describe('getGhVersion', () => {
    it('should return version string', async () => {
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callback!(null, { stdout: 'gh version 2.40.0 (2024-01-15)', stderr: '' } as any, '');
        return {} as any;
      });

      const version = await githubService.getGhVersion();
      expect(version).toBe('2.40.0');
    });

    it('should return null if gh not available', async () => {
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callback!(new Error('command not found'), { stdout: '', stderr: '' } as any, '');
        return {} as any;
      });

      const version = await githubService.getGhVersion();
      expect(version).toBeNull();
    });
  });

  describe('checkGhAuthenticated', () => {
    it('should return authenticated with username', async () => {
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callback!(
          null,
          { stdout: 'Logged in to github.com account testuser', stderr: '' } as any,
          ''
        );
        return {} as any;
      });

      const status = await githubService.checkGhAuthenticated();
      expect(status.authenticated).toBe(true);
      expect(status.username).toBe('testuser');
    });

    it('should return not authenticated on error', async () => {
      const error = new Error('Not logged in');
      (error as any).stderr = 'You are not logged into any GitHub hosts';

      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callback!(error, { stdout: '', stderr: '' } as any, '');
        return {} as any;
      });

      const status = await githubService.checkGhAuthenticated();
      expect(status.authenticated).toBe(false);
      expect(status.error).toContain('not logged');
    });
  });

  describe('createRepository', () => {
    it('should return error if gh CLI not available', async () => {
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callback!(new Error('command not found'), { stdout: '', stderr: '' } as any, '');
        return {} as any;
      });

      const result = await githubService.createRepository({ name: 'test-repo' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(GitHubErrorCode.CLI_NOT_FOUND);
    });

    it('should return error if not authenticated', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callCount++;

        if (callCount === 1) {
          // gh --version succeeds
          callback!(null, { stdout: 'gh version 2.40.0', stderr: '' } as any, '');
        } else {
          // gh auth status fails
          const error = new Error('Not authenticated');
          (error as any).stderr = 'You are not logged in';
          callback!(error, { stdout: '', stderr: '' } as any, '');
        }
        return {} as any;
      });

      const result = await githubService.createRepository({ name: 'test-repo' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(GitHubErrorCode.NOT_AUTHENTICATED);
    });

    it('should create repository successfully', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callCount++;

        if (callCount === 1) {
          // gh --version
          callback!(null, { stdout: 'gh version 2.40.0', stderr: '' } as any, '');
        } else if (callCount === 2) {
          // gh auth status
          callback!(
            null,
            { stdout: 'Logged in to github.com account testuser', stderr: '' } as any,
            ''
          );
        } else {
          // gh repo create
          callback!(
            null,
            { stdout: 'https://github.com/testuser/test-repo', stderr: '' } as any,
            ''
          );
        }
        return {} as any;
      });

      const result = await githubService.createRepository({
        name: 'test-repo',
        visibility: 'public',
        description: 'Test repository',
      });

      expect(result.success).toBe(true);
      expect(result.repoUrl).toBe('https://github.com/testuser/test-repo');
      expect(result.fullName).toBe('testuser/test-repo');
    });

    it('should handle repo already exists error', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callCount++;

        if (callCount === 1) {
          callback!(null, { stdout: 'gh version 2.40.0', stderr: '' } as any, '');
        } else if (callCount === 2) {
          callback!(
            null,
            { stdout: 'Logged in to github.com account testuser', stderr: '' } as any,
            ''
          );
        } else {
          const error = new Error('Repository already exists');
          (error as any).stderr = 'repository already exists';
          callback!(error, { stdout: '', stderr: '' } as any, '');
        }
        return {} as any;
      });

      const result = await githubService.createRepository({ name: 'test-repo' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(GitHubErrorCode.REPO_EXISTS);
    });

    it('should handle permission denied error', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callCount++;

        if (callCount === 1) {
          callback!(null, { stdout: 'gh version 2.40.0', stderr: '' } as any, '');
        } else if (callCount === 2) {
          callback!(
            null,
            { stdout: 'Logged in to github.com account testuser', stderr: '' } as any,
            ''
          );
        } else {
          const error = new Error('Permission denied');
          (error as any).stderr = 'permission denied';
          callback!(error, { stdout: '', stderr: '' } as any, '');
        }
        return {} as any;
      });

      const result = await githubService.createRepository({ name: 'test-repo' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(GitHubErrorCode.PERMISSION_DENIED);
    });
  });

  describe('generateRepoName', () => {
    it('should convert to lowercase', () => {
      const result = githubService.generateRepoName('MyProject');
      expect(result).toBe('myproject');
    });

    it('should replace spaces with hyphens', () => {
      const result = githubService.generateRepoName('My Project Name');
      expect(result).toBe('my-project-name');
    });

    it('should remove special characters', () => {
      const result = githubService.generateRepoName('Project@123!');
      expect(result).toBe('project-123');
    });

    it('should collapse multiple hyphens', () => {
      const result = githubService.generateRepoName('my--project---name');
      expect(result).toBe('my-project-name');
    });

    it('should remove leading and trailing hyphens', () => {
      const result = githubService.generateRepoName('-my-project-');
      expect(result).toBe('my-project');
    });

    it('should truncate to 100 characters', () => {
      const longName = 'a'.repeat(150);
      const result = githubService.generateRepoName(longName);
      expect(result.length).toBe(100);
    });
  });

  describe('getRepoUrl', () => {
    it('should return correct URL', () => {
      const url = githubService.getRepoUrl('test-repo', 'testuser');
      expect(url).toBe('https://github.com/testuser/test-repo');
    });
  });

  describe('checkGitAvailable', () => {
    it('should return true when git is available', async () => {
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callback!(null, { stdout: 'git version 2.40.0', stderr: '' } as any, '');
        return {} as any;
      });

      const result = await githubService.checkGitAvailable();
      expect(result).toBe(true);
    });

    it('should return false when git is not available', async () => {
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callback!(new Error('command not found'), { stdout: '', stderr: '' } as any, '');
        return {} as any;
      });

      const result = await githubService.checkGitAvailable();
      expect(result).toBe(false);
    });
  });

  describe('getGitVersion', () => {
    it('should return version string', async () => {
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callback!(null, { stdout: 'git version 2.40.0', stderr: '' } as any, '');
        return {} as any;
      });

      const version = await githubService.getGitVersion();
      expect(version).toBe('2.40.0');
    });
  });

  describe('isGitInitialized', () => {
    it('should return true if .git exists', () => {
      mockExistsSync.mockReturnValue(true);
      const result = githubService.isGitInitialized('/test/path');
      expect(result).toBe(true);
    });

    it('should return false if .git does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      const result = githubService.isGitInitialized('/test/path');
      expect(result).toBe(false);
    });
  });

  describe('initializeGit', () => {
    it('should return true on success', async () => {
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callback!(null, { stdout: 'Initialized empty Git repository', stderr: '' } as any, '');
        return {} as any;
      });

      const result = await githubService.initializeGit('/test/path');
      expect(result).toBe(true);
    });

    it('should return false on failure', async () => {
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callback!(new Error('init failed'), { stdout: '', stderr: '' } as any, '');
        return {} as any;
      });

      const result = await githubService.initializeGit('/test/path');
      expect(result).toBe(false);
    });
  });

  describe('addAndCommit', () => {
    it('should return commit hash on success', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callCount++;
        if (callCount === 1) {
          // git add
          callback!(null, { stdout: '', stderr: '' } as any, '');
        } else {
          // git commit
          callback!(null, { stdout: '[main abc1234] Initial commit', stderr: '' } as any, '');
        }
        return {} as any;
      });

      const result = await githubService.addAndCommit('/test/path', 'Initial commit');
      expect(result).toBe('abc1234');
    });

    it('should return no-changes if nothing to commit', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callCount++;
        if (callCount === 1) {
          callback!(null, { stdout: '', stderr: '' } as any, '');
        } else {
          const error = new Error('nothing to commit');
          (error as any).stderr = 'nothing to commit, working tree clean';
          callback!(error, { stdout: '', stderr: '' } as any, '');
        }
        return {} as any;
      });

      const result = await githubService.addAndCommit('/test/path', 'Commit');
      expect(result).toBe('no-changes');
    });
  });

  describe('pushToRemote', () => {
    it('should return true on success', async () => {
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callback!(null, { stdout: 'Everything up-to-date', stderr: '' } as any, '');
        return {} as any;
      });

      const result = await githubService.pushToRemote('/test/path');
      expect(result).toBe(true);
    });

    it('should return false on failure', async () => {
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callback!(new Error('push failed'), { stdout: '', stderr: '' } as any, '');
        return {} as any;
      });

      const result = await githubService.pushToRemote('/test/path');
      expect(result).toBe(false);
    });
  });

  describe('pushProjectToGitHub', () => {
    it('should return error if git not available', async () => {
      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        callback!(new Error('command not found'), { stdout: '', stderr: '' } as any, '');
        return {} as any;
      });

      const result = await githubService.pushProjectToGitHub({
        projectPath: '/test/path',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(GitHubErrorCode.GIT_NOT_FOUND);
    });

    it('should initialize git if not initialized', async () => {
      mockExistsSync.mockReturnValue(false);
      let commandIndex = 0;
      const commands: string[] = [];

      mockExec.mockImplementation((cmd, opts, cb) => {
        commands.push(String(cmd));
        const callback = typeof opts === 'function' ? opts : cb;
        commandIndex++;

        if (commandIndex === 1) {
          // git --version
          callback!(null, { stdout: 'git version 2.40.0', stderr: '' } as any, '');
        } else if (commandIndex === 2) {
          // git init
          callback!(null, { stdout: 'Initialized', stderr: '' } as any, '');
        } else if (commandIndex === 3) {
          // git add
          callback!(null, { stdout: '', stderr: '' } as any, '');
        } else if (commandIndex === 4) {
          // git commit
          callback!(null, { stdout: '[main abc1234] commit', stderr: '' } as any, '');
        } else {
          // git push
          callback!(null, { stdout: 'pushed', stderr: '' } as any, '');
        }
        return {} as any;
      });

      const result = await githubService.pushProjectToGitHub({
        projectPath: '/test/path',
      });

      expect(result.success).toBe(true);
      expect(commands.some(c => c.includes('git init'))).toBe(true);
    });

    it('should complete full push workflow', async () => {
      mockExistsSync.mockReturnValue(true); // .git exists
      let commandIndex = 0;

      mockExec.mockImplementation((cmd, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        commandIndex++;

        if (commandIndex === 1) {
          // git --version
          callback!(null, { stdout: 'git version 2.40.0', stderr: '' } as any, '');
        } else if (commandIndex === 2) {
          // git add
          callback!(null, { stdout: '', stderr: '' } as any, '');
        } else if (commandIndex === 3) {
          // git commit
          callback!(null, { stdout: '[main def5678] commit', stderr: '' } as any, '');
        } else {
          // git push
          callback!(null, { stdout: 'pushed', stderr: '' } as any, '');
        }
        return {} as any;
      });

      const result = await githubService.pushProjectToGitHub({
        projectPath: '/test/path',
        commitMessage: 'Test commit',
      });

      expect(result.success).toBe(true);
      expect(result.commitHash).toBe('def5678');
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const service1 = getGitHubService();
      const service2 = getGitHubService();
      expect(service1).toBe(service2);
    });

    it('should return new instance after reset', () => {
      const service1 = getGitHubService();
      resetGitHubService();
      const service2 = getGitHubService();
      expect(service1).not.toBe(service2);
    });
  });
});

describe('GitHubError', () => {
  describe('static factory methods', () => {
    it('should create CLI not found error', () => {
      const error = GitHubError.cliNotFound('details');
      expect(error.code).toBe(GitHubErrorCode.CLI_NOT_FOUND);
      expect(error.userMessage).toContain('GitHub CLI');
      expect(error.technicalDetails).toBe('details');
    });

    it('should create not authenticated error', () => {
      const error = GitHubError.notAuthenticated();
      expect(error.code).toBe(GitHubErrorCode.NOT_AUTHENTICATED);
      expect(error.userMessage).toContain('giriş yapılmadı');
    });

    it('should create repo exists error', () => {
      const error = GitHubError.repoExists('my-repo');
      expect(error.code).toBe(GitHubErrorCode.REPO_EXISTS);
      expect(error.userMessage).toContain('my-repo');
    });

    it('should create network error', () => {
      const error = GitHubError.networkError();
      expect(error.code).toBe(GitHubErrorCode.NETWORK_ERROR);
      expect(error.userMessage).toContain('bağlanılamadı');
    });

    it('should create permission denied error', () => {
      const error = GitHubError.permissionDenied();
      expect(error.code).toBe(GitHubErrorCode.PERMISSION_DENIED);
      expect(error.userMessage).toContain('yetki');
    });

    it('should create unknown error', () => {
      const error = GitHubError.unknown('some error');
      expect(error.code).toBe(GitHubErrorCode.UNKNOWN);
      expect(error.technicalDetails).toBe('some error');
    });

    it('should create git not found error', () => {
      const error = GitHubError.gitNotFound();
      expect(error.code).toBe(GitHubErrorCode.GIT_NOT_FOUND);
      expect(error.userMessage).toContain('Git bulunamadı');
    });

    it('should create git init failed error', () => {
      const error = GitHubError.gitInitFailed();
      expect(error.code).toBe(GitHubErrorCode.GIT_INIT_FAILED);
      expect(error.userMessage).toContain('başlatılamadı');
    });

    it('should create git commit failed error', () => {
      const error = GitHubError.gitCommitFailed();
      expect(error.code).toBe(GitHubErrorCode.GIT_COMMIT_FAILED);
      expect(error.userMessage).toContain('commit');
    });

    it('should create git push failed error', () => {
      const error = GitHubError.gitPushFailed();
      expect(error.code).toBe(GitHubErrorCode.GIT_PUSH_FAILED);
      expect(error.userMessage).toContain('gönderilemedi');
    });
  });
});

describe('GITHUB_ERRORS constant', () => {
  it('should have Turkish error messages', () => {
    expect(GITHUB_ERRORS.CLI_NOT_FOUND).toContain('bulunamadı');
    expect(GITHUB_ERRORS.NOT_AUTHENTICATED).toContain('giriş yapılmadı');
    expect(GITHUB_ERRORS.REPO_EXISTS).toContain('mevcut');
    expect(GITHUB_ERRORS.NETWORK_ERROR).toContain('bağlanılamadı');
    expect(GITHUB_ERRORS.PERMISSION_DENIED).toContain('yetki');
    expect(GITHUB_ERRORS.UNKNOWN).toContain('beklenmedik');
  });

  it('should have Turkish git error messages', () => {
    expect(GITHUB_ERRORS.GIT_NOT_FOUND).toContain('bulunamadı');
    expect(GITHUB_ERRORS.GIT_INIT_FAILED).toContain('başlatılamadı');
    expect(GITHUB_ERRORS.GIT_COMMIT_FAILED).toContain('commit');
    expect(GITHUB_ERRORS.GIT_PUSH_FAILED).toContain('gönderilemedi');
  });
});

describe('GITHUB_MESSAGES constant', () => {
  it('should have Turkish messages', () => {
    expect(GITHUB_MESSAGES.CLI_AVAILABLE).toContain('mevcut');
    expect(GITHUB_MESSAGES.AUTHENTICATED).toContain('giriş');
    expect(GITHUB_MESSAGES.REPO_CREATED).toContain('oluşturuldu');
    expect(GITHUB_MESSAGES.CREATING_REPO).toContain('oluşturuluyor');
  });

  it('should have Turkish git messages', () => {
    expect(GITHUB_MESSAGES.GIT_AVAILABLE).toContain('mevcut');
    expect(GITHUB_MESSAGES.GIT_INITIALIZED).toContain('başlatıldı');
    expect(GITHUB_MESSAGES.COMMITTED).toContain('commit');
    expect(GITHUB_MESSAGES.PUSHED).toContain('gönderildi');
    expect(GITHUB_MESSAGES.PUSHING).toContain('gönderiliyor');
  });
});

/**
 * Claude Code Adapter
 * Handles communication with Claude Code CLI for BMAD step execution
 */

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BmadStepType } from '../../types/bmad.types.js';
import type { StepOutput } from '../../types/step.types.js';
import {
  type ClaudeCodeExecutionOptions,
  type ClaudeCodeResult,
  type ClaudeCodeExecutionMetadata,
  CLAUDE_CODE_ERRORS,
  CLAUDE_CODE_DEFAULTS,
} from '../../types/claude-code.types.js';

/**
 * Adapter for executing BMAD steps via Claude Code CLI
 * Per ADR-003: File-Based Communication
 */
export class ClaudeCodeAdapter {
  private readonly projectPath: string;
  private readonly timeout: number;
  private readonly verbose: boolean;
  private readonly appfabrikaDir: string;

  /**
   * Create a new Claude Code adapter
   * @param options - Configuration options
   */
  constructor(options: ClaudeCodeExecutionOptions) {
    this.projectPath = options.projectPath;
    this.timeout = options.timeout ?? CLAUDE_CODE_DEFAULTS.TIMEOUT;
    this.verbose = options.verbose ?? false;
    this.appfabrikaDir = join(this.projectPath, CLAUDE_CODE_DEFAULTS.APPFABRIKA_DIR);
  }

  /**
   * Check if Claude Code CLI is available
   * @returns true if Claude Code is installed and accessible
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.executeCommand('claude', ['--version']);
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Get Claude Code CLI version
   * @returns Version string
   * @throws Error if version check fails
   */
  async getVersion(): Promise<string> {
    const result = await this.executeCommand('claude', ['--version']);
    if (!result.success) {
      throw new Error(CLAUDE_CODE_ERRORS.VERSION_CHECK_FAILED);
    }
    return result.output.trim();
  }

  /**
   * Write prompt to file for Claude Code consumption
   * @param prompt - The prompt content
   * @param stepId - The BMAD step identifier
   * @returns Path to the written prompt file
   */
  async writePromptFile(prompt: string, stepId: BmadStepType): Promise<string> {
    try {
      // Ensure .appfabrika directory exists (use recursive to avoid race conditions)
      await mkdir(this.appfabrikaDir, { recursive: true });

      // Write prompt to step-specific file
      const promptFilename = `${stepId}-prompt.md`;
      const promptPath = join(this.appfabrikaDir, promptFilename);
      await writeFile(promptPath, prompt, 'utf-8');

      // Also write to standard prompt.md for Claude Code
      const standardPromptPath = join(this.appfabrikaDir, CLAUDE_CODE_DEFAULTS.PROMPT_FILENAME);
      await writeFile(standardPromptPath, prompt, 'utf-8');

      return promptPath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        CLAUDE_CODE_ERRORS.PROMPT_WRITE_FAILED.replace('{path}', this.appfabrikaDir) +
        ` (${errorMessage})`
      );
    }
  }

  /**
   * Execute Claude Code with a prompt file
   * @param promptPath - Path to the prompt file
   * @returns Execution result
   */
  async execute(promptPath: string): Promise<ClaudeCodeResult> {
    const startTime = Date.now();

    // Check if Claude Code is available
    const available = await this.isAvailable();
    if (!available) {
      return {
        success: false,
        output: '',
        exitCode: -1,
        duration: Date.now() - startTime,
        error: CLAUDE_CODE_ERRORS.NOT_INSTALLED,
      };
    }

    try {
      const result = await this.executeCommand('claude', ['--file', promptPath], this.timeout);
      return {
        ...result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: '',
        exitCode: -1,
        duration: Date.now() - startTime,
        error: CLAUDE_CODE_ERRORS.EXECUTION_FAILED.replace('{error}', errorMessage),
      };
    }
  }

  /**
   * Execute a BMAD step via Claude Code
   * Writes prompt to file and executes Claude Code
   * @param stepId - The BMAD step to execute
   * @param prompt - The prompt for the step
   * @returns Step output with content and metadata
   */
  async executeStep(stepId: BmadStepType, prompt: string): Promise<StepOutput> {
    // Write prompt to file
    const promptPath = await this.writePromptFile(prompt, stepId);

    // Execute Claude Code
    const result = await this.execute(promptPath);

    // Create execution metadata
    const metadata: ClaudeCodeExecutionMetadata = {
      stepId,
      promptPath,
      executedAt: new Date().toISOString(),
      duration: result.duration,
      exitCode: result.exitCode,
    };

    // If execution failed, throw with metadata
    if (!result.success) {
      const output: StepOutput = {
        content: result.error ?? 'Bilinmeyen hata',
        metadata: {
          ...metadata,
          success: false,
          error: result.error,
        },
      };
      return output;
    }

    // Return successful output
    return {
      content: result.output,
      metadata: {
        ...metadata,
        success: true,
      },
    };
  }

  /**
   * Execute a shell command
   * @param command - Command to execute
   * @param args - Command arguments
   * @param timeout - Optional timeout override
   * @returns Command result
   */
  private executeCommand(
    command: string,
    args: string[],
    timeout?: number
  ): Promise<ClaudeCodeResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let killed = false;

      const process = spawn(command, args, {
        cwd: this.projectPath,
        env: { ...globalThis.process.env },
      });

      // Set up timeout
      const timeoutMs = timeout ?? this.timeout;
      const timeoutId = setTimeout(() => {
        killed = true;
        process.kill('SIGTERM');
        reject(new Error(
          CLAUDE_CODE_ERRORS.TIMEOUT.replace('{timeout}', String(timeoutMs))
        ));
      }, timeoutMs);

      process.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
        if (this.verbose) {
          globalThis.process.stdout.write(data);
        }
      });

      process.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
        if (this.verbose) {
          globalThis.process.stderr.write(data);
        }
      });

      process.on('close', (code) => {
        clearTimeout(timeoutId);
        if (killed) return;

        const duration = Date.now() - startTime;
        const exitCode = code ?? 0;

        if (exitCode === 0) {
          resolve({
            success: true,
            output: stdout,
            exitCode,
            duration,
          });
        } else {
          resolve({
            success: false,
            output: stdout,
            exitCode,
            duration,
            error: stderr || `Çıkış kodu: ${exitCode}`,
          });
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Get the project path
   */
  getProjectPath(): string {
    return this.projectPath;
  }

  /**
   * Get the appfabrika directory path
   */
  getAppfabrikaDir(): string {
    return this.appfabrikaDir;
  }

  /**
   * Get configured timeout
   */
  getTimeout(): number {
    return this.timeout;
  }
}

/**
 * Singleton instance
 */
let instance: ClaudeCodeAdapter | null = null;

/**
 * Get or create the singleton ClaudeCodeAdapter instance
 * @param options - Required on first call
 * @returns The ClaudeCodeAdapter instance
 */
export function getClaudeCodeAdapter(options?: ClaudeCodeExecutionOptions): ClaudeCodeAdapter {
  if (!instance) {
    if (!options) {
      throw new Error('ClaudeCodeAdapter options gerekli (ilk çağrı için)');
    }
    instance = new ClaudeCodeAdapter(options);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetClaudeCodeAdapter(): void {
  instance = null;
}

/**
 * BMAD Logger
 * Structured logging with file output
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  workflowId?: string;
  stepName?: string;
  error?: {
    message: string;
    stack?: string;
  };
}

interface LoggerConfig {
  level: LogLevel;
  logToConsole: boolean;
  logToFile: boolean;
  logDir: string;
  maxFileSize: number; // bytes
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m', // gray
  info: '\x1b[36m',  // cyan
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
};

const RESET_COLOR = '\x1b[0m';

class BmadLogger {
  private config: LoggerConfig = {
    level: 'info',
    logToConsole: true,
    logToFile: true,
    logDir: '.appfabrika/logs',
    maxFileSize: 5 * 1024 * 1024, // 5MB
  };

  private currentWorkflowId?: string;
  private currentStepName?: string;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start flush interval
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  /**
   * Configure the logger
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set current workflow context
   */
  setWorkflowContext(workflowId?: string, stepName?: string): void {
    this.currentWorkflowId = workflowId;
    this.currentStepName = stepName;
  }

  /**
   * Clear workflow context
   */
  clearWorkflowContext(): void {
    this.currentWorkflowId = undefined;
    this.currentStepName = undefined;
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    const errorInfo = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error
        ? { message: String(error) }
        : undefined;

    this.log('error', message, context, errorInfo);
  }

  /**
   * Core logging function
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: LogEntry['error']
  ): void {
    // Check log level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      workflowId: this.currentWorkflowId,
      stepName: this.currentStepName,
      error,
    };

    // Console output
    if (this.config.logToConsole) {
      this.writeToConsole(entry);
    }

    // Buffer for file output
    if (this.config.logToFile) {
      this.logBuffer.push(entry);
    }
  }

  /**
   * Write log entry to console
   */
  private writeToConsole(entry: LogEntry): void {
    const color = LOG_COLORS[entry.level];
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const time = entry.timestamp.split('T')[1].split('.')[0];

    let output = `${color}[${time}] ${levelStr}${RESET_COLOR} ${entry.message}`;

    if (entry.workflowId) {
      output += ` ${'\x1b[90m'}[${entry.workflowId}]${RESET_COLOR}`;
    }

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += ` ${'\x1b[90m'}${JSON.stringify(entry.context)}${RESET_COLOR}`;
    }

    if (entry.error) {
      output += `\n  ${'\x1b[31m'}Error: ${entry.error.message}${RESET_COLOR}`;
      if (entry.error.stack && entry.level === 'error') {
        output += `\n  ${'\x1b[90m'}${entry.error.stack.split('\n').slice(1, 4).join('\n  ')}${RESET_COLOR}`;
      }
    }

    console.log(output);
  }

  /**
   * Flush log buffer to file
   */
  async flush(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const logDir = this.config.logDir;

      if (!existsSync(logDir)) {
        await mkdir(logDir, { recursive: true });
      }

      const date = new Date().toISOString().split('T')[0];
      const logFile = join(logDir, `bmad-${date}.log`);

      const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
      await appendFile(logFile, lines, 'utf-8');
    } catch (error) {
      // Silently fail file logging
      console.error('Log yazma hatası:', error);
    }
  }

  /**
   * Get recent log entries (from buffer)
   */
  getRecentLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Close logger and flush remaining logs
   */
  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flush();
  }
}

// Singleton instance
export const logger = new BmadLogger();

// Convenience exports
export const debug = logger.debug.bind(logger);
export const info = logger.info.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);

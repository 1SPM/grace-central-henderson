/**
 * Structured Logger Utility
 *
 * Replaces raw console.log/warn/error calls with a structured logger
 * that respects environment, adds context, and can be extended
 * to send logs to external services.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
  timestamp: string;
}

class Logger {
  private minLevel: LogLevel;
  private context: string;

  constructor(context: string = 'app') {
    this.context = context;
    // In production, only show warnings and errors
    this.minLevel = import.meta.env.PROD ? 'warn' : 'debug';
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatEntry(entry: LogEntry): string {
    return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.context}] ${entry.message}`;
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      context: this.context,
      data,
      timestamp: new Date().toISOString(),
    };

    const formatted = this.formatEntry(entry);

    switch (level) {
      case 'debug':
        console.debug(formatted, data !== undefined ? data : '');
        break;
      case 'info':
        console.info(formatted, data !== undefined ? data : '');
        break;
      case 'warn':
        console.warn(formatted, data !== undefined ? data : '');
        break;
      case 'error':
        console.error(formatted, data !== undefined ? data : '');
        break;
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  /**
   * Create a child logger with a specific context
   */
  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`);
  }
}

// Create contextual loggers for different modules
export const logger = new Logger('grace-crm');

export function createLogger(context: string): Logger {
  return new Logger(context);
}

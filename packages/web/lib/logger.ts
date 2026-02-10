/**
 * Structured Logger for Web Package
 *
 * Matches the orchestrator logger API (log.info/warn/error/debug) for consistency.
 * - Production: JSON output (structured, parseable by log aggregators)
 * - Development: Human-readable colored output
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === 'production';

function formatDev(level: LogLevel, message: string, data?: Record<string, unknown>): string {
  const tag = level.toUpperCase().padEnd(5);
  const suffix = data && Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
  return `[${tag}] ${message}${suffix}`;
}

function emit(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (isProduction) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...data,
    };
    // Use appropriate console method so Render/cloud log levels work
    const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[method](JSON.stringify(entry));
  } else {
    const formatted = formatDev(level, message, data);
    if (level === 'error') console.error(formatted);
    else if (level === 'warn') console.warn(formatted);
    else console.log(formatted);
  }
}

export const log = {
  debug(message: string, data?: Record<string, unknown>): void {
    if (!isProduction) emit('debug', message, data);
  },

  info(message: string, data?: Record<string, unknown>): void {
    emit('info', message, data);
  },

  warn(message: string, data?: Record<string, unknown>): void {
    emit('warn', message, data);
  },

  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const errorData: Record<string, unknown> = { ...data };
    if (error instanceof Error) {
      errorData.error = error.message;
      errorData.stack = error.stack;
    } else if (error !== undefined) {
      errorData.error = String(error);
    }
    emit('error', message, errorData);
  },

  /** Convenience: log an API route hit with standard fields */
  api(route: string, method: string, statusCode: number, data?: Record<string, unknown>): void {
    emit('info', `${method} ${route} ${statusCode}`, { route, method, statusCode, ...data });
  },
};

import pino from 'pino';
import { IncomingMessage, ServerResponse } from 'http';

// Determine log level from environment
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create base logger
export const logger = pino({
  level: LOG_LEVEL,
  // Use pino-pretty in development for readable output
  transport: process.env.NODE_ENV !== 'production'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  // Base context included in all logs
  base: {
    service: 'story-magic-orchestrator',
    version: process.env.npm_package_version || '2.0.0',
    env: process.env.NODE_ENV || 'development',
  },
  // Customize serializers
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      // Don't log full body for security
      hasBody: !!req.body,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
  // Format timestamp as ISO string
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Dynamic import for pino-http to handle ESM/CJS interop
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _httpLogger: any = null;

// Initialize using dynamic import (handles ESM properly)
(async () => {
  try {
    const pinoHttpModule = await import('pino-http');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pinoHttp = (pinoHttpModule as any).default ?? pinoHttpModule;

    _httpLogger = pinoHttp({
      logger,
      customLogLevel: (req: IncomingMessage, res: ServerResponse, err?: Error) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customSuccessMessage: (req: IncomingMessage, res: ServerResponse, responseTime: number) => {
        return `${req.method} ${req.url} completed in ${responseTime}ms`;
      },
      customErrorMessage: (req: IncomingMessage, res: ServerResponse, err: Error) => {
        const llmModel = (req as unknown as Record<string, unknown>).llmModel as string | undefined;
        const suffix = llmModel ? ` [llm: ${llmModel}]` : '';
        return `${req.method} ${req.url} failed: ${err.message}${suffix}`;
      },
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      autoLogging: {
        ignore: (req: IncomingMessage) => req.url === '/health' || req.url === '/',
      },
    });
  } catch (e) {
    logger.warn({ err: e }, 'Failed to initialize pino-http');
  }
})();

// Export a middleware that handles the lazy initialization
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const httpLogger = (req: any, res: any, next: () => void) => {
  if (_httpLogger) {
    _httpLogger(req, res, next);
  } else {
    next();
  }
};

// Convenience methods for structured logging
export const log = {
  info: (message: string, data?: Record<string, unknown>) => {
    logger.info(data || {}, message);
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    logger.warn(data || {}, message);
  },
  error: (message: string, error?: Error, data?: Record<string, unknown>) => {
    logger.error({ err: error, ...data }, message);
  },
  debug: (message: string, data?: Record<string, unknown>) => {
    logger.debug(data || {}, message);
  },
  // Specific log for generation events
  generation: (projectId: string, step: string, data?: Record<string, unknown>) => {
    logger.info({ projectId, step, type: 'generation', ...data }, `Generation: ${step}`);
  },
  // Specific log for API calls
  apiCall: (service: string, operation: string, data?: Record<string, unknown>) => {
    logger.info({ service, operation, type: 'api_call', ...data }, `API: ${service}.${operation}`);
  },
};

export default logger;

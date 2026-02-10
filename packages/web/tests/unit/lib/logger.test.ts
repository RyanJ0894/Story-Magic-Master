import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Structured Logger', () => {
  const originalEnv = process.env.NODE_ENV;
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('development mode', () => {
    beforeEach(async () => {
      process.env.NODE_ENV = 'development';
      vi.resetModules();
    });

    it('should output human-readable format for log.info', async () => {
      const { log } = await import('@/lib/logger');
      log.info('Server started', { port: 3000 });

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const output = consoleSpy.log.mock.calls[0][0] as string;
      expect(output).toContain('[INFO ]');
      expect(output).toContain('Server started');
      expect(output).toContain('"port":3000');
    });

    it('should output human-readable format for log.warn', async () => {
      const { log } = await import('@/lib/logger');
      log.warn('Deprecated call');

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const output = consoleSpy.warn.mock.calls[0][0] as string;
      expect(output).toContain('[WARN ]');
      expect(output).toContain('Deprecated call');
    });

    it('should output human-readable format for log.error', async () => {
      const { log } = await import('@/lib/logger');
      log.error('Something broke', new Error('test error'));

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const output = consoleSpy.error.mock.calls[0][0] as string;
      expect(output).toContain('[ERROR]');
      expect(output).toContain('Something broke');
      expect(output).toContain('test error');
    });

    it('should output debug messages in development', async () => {
      const { log } = await import('@/lib/logger');
      log.debug('Debug info');

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const output = consoleSpy.log.mock.calls[0][0] as string;
      expect(output).toContain('[DEBUG]');
    });
  });

  describe('production mode', () => {
    beforeEach(async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
    });

    it('should output JSON for log.info', async () => {
      const { log } = await import('@/lib/logger');
      log.info('Request handled', { route: '/api/test', statusCode: 200 });

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const output = consoleSpy.log.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Request handled');
      expect(parsed.route).toBe('/api/test');
      expect(parsed.statusCode).toBe(200);
      expect(parsed.timestamp).toBeDefined();
    });

    it('should output JSON for log.error with Error object', async () => {
      const { log } = await import('@/lib/logger');
      log.error('DB connection failed', new Error('connection refused'));

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const output = consoleSpy.error.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('DB connection failed');
      expect(parsed.error).toBe('connection refused');
      expect(parsed.stack).toBeDefined();
    });

    it('should suppress debug messages in production', async () => {
      const { log } = await import('@/lib/logger');
      log.debug('Should not appear');

      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });

    it('should include additional data in JSON output', async () => {
      const { log } = await import('@/lib/logger');
      log.warn('Rate limit exceeded', { ip: '1.2.3.4', tier: 'strict' });

      const output = consoleSpy.warn.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.ip).toBe('1.2.3.4');
      expect(parsed.tier).toBe('strict');
    });
  });

  describe('log.api()', () => {
    it('should log route, method, and status code', async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const { log } = await import('@/lib/logger');
      log.api('/api/shares/access/abc', 'POST', 429, { reason: 'rate_limited' });

      const output = consoleSpy.log.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.route).toBe('/api/shares/access/abc');
      expect(parsed.method).toBe('POST');
      expect(parsed.statusCode).toBe(429);
      expect(parsed.reason).toBe('rate_limited');
    });
  });

  describe('log.error() edge cases', () => {
    it('should handle non-Error objects', async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const { log } = await import('@/lib/logger');
      log.error('Unknown failure', 'some string error');

      const output = consoleSpy.error.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.error).toBe('some string error');
    });

    it('should handle undefined error', async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const { log } = await import('@/lib/logger');
      log.error('No error object');

      const output = consoleSpy.error.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('error');
      expect(parsed.error).toBeUndefined();
    });
  });
});

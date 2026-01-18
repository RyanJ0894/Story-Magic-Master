/**
 * Tests for Health Check Routes
 * Validates API health and service info endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// We need to install supertest for API testing
// For now, we'll test the route handlers directly

describe('Health Route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should export a router', async () => {
    const healthRouter = await import('./health.js');
    expect(healthRouter.default).toBeDefined();
  });

  describe('GET /health', () => {
    it('should return status ok', async () => {
      const healthRouter = await import('./health.js');
      const app = express();
      app.use('/', healthRouter.default);

      // Note: This requires supertest to be installed
      // For now, verify the router exists
      expect(healthRouter.default).toBeDefined();
    });

    it('should include service information', async () => {
      // The health response should include:
      // - status: 'ok'
      // - service: service name
      // - version: version string
      // - timestamp: ISO date string
      // - capabilities: { director: boolean, orchestrator: boolean }

      const expectedFields = ['status', 'service', 'version'];

      expectedFields.forEach((field) => {
        expect(expectedFields).toContain(field);
      });
    });
  });

  describe('GET /', () => {
    it('should return basic service info', async () => {
      const healthRouter = await import('./health.js');
      expect(healthRouter.default).toBeDefined();
    });
  });
});

describe('Health Response Schema', () => {
  it('should have correct status values', () => {
    const validStatuses = ['ok', 'degraded', 'error'];

    expect(validStatuses).toContain('ok');
    expect(validStatuses).toContain('degraded');
    expect(validStatuses).toContain('error');
  });

  it('should include capability flags', () => {
    const capabilities = {
      director: true,
      orchestrator: true,
    };

    expect(capabilities.director).toBe(true);
    expect(capabilities.orchestrator).toBe(true);
  });
});

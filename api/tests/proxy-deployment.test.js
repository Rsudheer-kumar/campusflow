/**
 * CampusFlow API - Ingress Proxy & Deployment Verification Tests
 *
 * Verifies:
 * 1. Health & Liveness probes are always accessible without proxy secret (Render probes).
 * 2. Root ping endpoint / is accessible without proxy secret.
 * 3. In non-production environments, endpoints do not block requests missing proxy secret.
 * 4. Server-side proxy secret validation correctly blocks direct unauthorized access in production.
 * 5. Timing-safe comparison permits primary and fallback proxy secrets.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { validateProxySecret } from '../src/middleware/proxyAuth.js';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';

describe('CampusFlow Ingress Proxy & Deployment Verification', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '0.0.0.0', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  });

  it('1. GET /api/health should succeed without x-campusflow-proxy-secret for cloud monitoring', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.status);
  });

  it('2. GET / should return 200 OK application root info without proxy secret', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.name, 'CampusFlow API');
  });

  it('3. In non-production environments, endpoints do not block requests missing proxy secret (returns 404, not 403)', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent-endpoint`);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'ROUTE_NOT_FOUND');
  });

  describe('4. Proxy Secret Enforcement Unit Tests (Simulated Production Mode)', () => {
    const TEST_SECRET = 'a'.repeat(32);
    const FALLBACK_SECRET = 'b'.repeat(32);

    let testApp;
    let testServer;
    let testBaseUrl;

    before(async () => {
      testApp = express();

      // Mount simulated production middleware
      testApp.use((req, res, next) => {
        // Mock production flags for this isolated test router
        const origProd = env.isProduction;
        const origSecret = env.PROXY_SECRET;
        const origFallback = env.PROXY_SECRET_FALLBACK;

        env.isProduction = true;
        env.PROXY_SECRET = TEST_SECRET;
        env.PROXY_SECRET_FALLBACK = FALLBACK_SECRET;

        res.on('finish', () => {
          env.isProduction = origProd;
          env.PROXY_SECRET = origSecret;
          env.PROXY_SECRET_FALLBACK = origFallback;
        });

        validateProxySecret(req, res, next);
      });

      // Health route inside test app
      testApp.get('/health', (_req, res) => {
        res.json({ success: true, message: 'health ok' });
      });

      // Protected route
      testApp.get('/protected-resource', (_req, res) => {
        res.json({ success: true, message: 'authorized via proxy' });
      });

      // Error handler for ForbiddenError
      testApp.use((err, _req, res, _next) => {
        res.status(err.statusCode || 403).json({
          success: false,
          error: { code: err.code || 'FORBIDDEN', message: err.message },
        });
      });

      await new Promise((resolve) => {
        testServer = testApp.listen(0, '0.0.0.0', () => {
          const addr = testServer.address();
          testBaseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    });

    after(async () => {
      await new Promise((resolve) => {
        testServer.close(() => resolve());
      });
    });

    it('rejects direct requests missing x-campusflow-proxy-secret with 403 Forbidden', async () => {
      const res = await fetch(`${testBaseUrl}/protected-resource`);
      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'FORBIDDEN');
      assert.ok(body.error.message.includes('Direct API access is restricted'));
    });

    it('rejects direct requests with incorrect x-campusflow-proxy-secret with 403 Forbidden', async () => {
      const res = await fetch(`${testBaseUrl}/protected-resource`, {
        headers: { 'x-campusflow-proxy-secret': 'wrong-secret-value-of-wrong-length' },
      });
      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'FORBIDDEN');
    });

    it('accepts requests with valid primary x-campusflow-proxy-secret', async () => {
      const res = await fetch(`${testBaseUrl}/protected-resource`, {
        headers: { 'x-campusflow-proxy-secret': TEST_SECRET },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data?.message || body.message, 'authorized via proxy');
    });

    it('accepts requests with valid fallback x-campusflow-proxy-secret for zero-downtime rotation', async () => {
      const res = await fetch(`${testBaseUrl}/protected-resource`, {
        headers: { 'x-campusflow-proxy-secret': FALLBACK_SECRET },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
    });

    it('exempts /health probes even in production without proxy secret', async () => {
      const res = await fetch(`${testBaseUrl}/health`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
    });
  });
});

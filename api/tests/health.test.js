/**
 * CampusFlow API - Health & Core Middleware Integration Tests
 * Tests app.ts directly without starting the production server.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
describe('CampusFlow API Foundation & Health Tests', () => {
    let server;
    let baseUrl;
    before(async () => {
        // Start test server on ephemeral port
        await new Promise((resolve) => {
            server = app.listen(0, () => {
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
    it('GET /api/health should return structured 200 OK with truthful dependency status', async () => {
        const res = await fetch(`${baseUrl}/api/health`);
        assert.strictEqual(res.status, 200);
        const body = (await res.json());
        assert.strictEqual(body.success, true);
        assert.ok(['ok', 'degraded'].includes(body.data.status));
        assert.ok(typeof body.data.timestamp === 'string');
        assert.ok(typeof body.data.uptime === 'number');
        assert.ok(typeof body.data.environment === 'string');
        assert.ok(body.data.services);
        assert.ok(['connected', 'connecting', 'disconnecting', 'disconnected', 'error'].includes(body.data.services.database));
        assert.ok(['connected', 'connecting', 'disconnected', 'error'].includes(body.data.services.redis));
    });
    it('GET / should return root application information', async () => {
        const res = await fetch(`${baseUrl}/`);
        assert.strictEqual(res.status, 200);
        const body = (await res.json());
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.name, 'CampusFlow API');
        assert.strictEqual(body.data.healthCheck, '/api/health');
    });
    it('GET /api/nonexistent-route should return structured 404 JSON', async () => {
        const headers = env.PROXY_SECRET ? { 'x-campusflow-proxy-secret': env.PROXY_SECRET } : {};
        const res = await fetch(`${baseUrl}/api/nonexistent-route`, { headers });
        assert.strictEqual(res.status, 404);
        const body = (await res.json());
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, 'ROUTE_NOT_FOUND');
        assert.ok(body.error.message.includes('/api/nonexistent-route'));
    });
    it('POST with malformed JSON body should return structured 400 INVALID_JSON', async () => {
        const res = await fetch(`${baseUrl}/api/health`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{ invalid_json: ',
        });
        assert.strictEqual(res.status, 400);
        const body = (await res.json());
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, 'INVALID_JSON');
        assert.strictEqual(body.error.message, 'Malformed JSON in request body');
    });
    it('GET /api/health/live should return 200 OK process liveness probe', async () => {
        const res = await fetch(`${baseUrl}/api/health/live`);
        assert.strictEqual(res.status, 200);
        const body = (await res.json());
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.status, 'alive');
        assert.ok(typeof body.data.uptime === 'number');
        assert.ok(typeof body.data.timestamp === 'string');
    });
    it('GET /api/health/ready distinguishes database readiness from Redis optionality', async () => {
        const res = await fetch(`${baseUrl}/api/health/ready`);
        const body = (await res.json());
        // In isolated test without real DB connection, readiness responds truthfully with 503 SERVICE_UNAVAILABLE
        // but crucially reports database dependency state, not Redis
        if (res.status === 200) {
            assert.strictEqual(body.data.status, 'ready');
            assert.strictEqual(body.data.database, 'connected');
        } else {
            assert.strictEqual(res.status, 503);
            assert.strictEqual(body.error.code, 'SERVICE_UNAVAILABLE');
            assert.ok(['disconnected', 'connecting', 'error'].includes(body.error.details.database));
        }
    });
});

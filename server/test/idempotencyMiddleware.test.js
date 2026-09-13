// Unit tests for enforceIdempotency -- the Idempotency-Key response-cache
// middleware factory (see its own doc comment). These verify the factory's own
// responsibilities: replaying a cached 2xx response, caching only successes,
// choosing the caller-supplied TTL, and -- most importantly -- failing OPEN
// (calling next, never hanging) when Redis is not ready or a lookup stalls.
//
// No real Redis is available here, so a fake client is injected via the
// factory's `deps.getClient` override, exactly as createResilientRateLimiter's
// tests do. Redis's own get/setex semantics are not this middleware's concern.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { enforceIdempotency } from '../src/application/middleware/idempotency.middleware.js';

// Minimal express-style response double: records the last status/body sent and
// preserves the middleware's ability to wrap res.json.
function makeRes() {
    return {
        statusCode: 200,
        sentStatus: null,
        sentBody: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.sentStatus = this.statusCode; this.sentBody = body; return this; },
    };
}

// Ready ioredis-like client backed by an in-process Map. Records setex calls.
function makeReadyClient(seed = {}) {
    const store = new Map(Object.entries(seed));
    const setexCalls = [];
    return {
        status: 'ready',
        _setexCalls: setexCalls,
        async get(key) { return store.get(key) ?? null; },
        async setex(key, ttl, value) { setexCalls.push({ key, ttl, value }); store.set(key, value); return 'OK'; },
    };
}

describe('enforceIdempotency', () => {
    test('no Idempotency-Key header: passes through without touching Redis', async () => {
        let getCalled = false;
        const mw = enforceIdempotency(60, { getClient: () => { getCalled = true; return makeReadyClient(); } });
        const res = makeRes();
        let nextCalled = false;
        await mw({ headers: {} }, res, () => { nextCalled = true; });
        assert.equal(nextCalled, true);
        // The no-key guard short-circuits before Redis is even resolved.
        assert.equal(res.sentBody, null);
        assert.equal(getCalled, false, 'no key means no Redis work at all');
    });

    test('replays the cached response and does NOT call next', async () => {
        const cacheKey = 'idempotency:delete-user-42';
        const client = makeReadyClient({ [cacheKey]: JSON.stringify({ status: 200, body: { deleted: true } }) });
        const mw = enforceIdempotency(86400, { getClient: () => client });
        const res = makeRes();
        let nextCalled = false;
        await mw({ headers: { 'idempotency-key': 'delete-user-42' } }, res, () => { nextCalled = true; });
        assert.equal(nextCalled, false, 'a replayed request must not reach the handler');
        assert.equal(res.sentStatus, 200);
        assert.deepEqual(res.sentBody, { deleted: true });
    });

    test('cache miss: calls next, then caches a 2xx response under the supplied TTL', async () => {
        const client = makeReadyClient();
        const mw = enforceIdempotency(60, { getClient: () => client });
        const res = makeRes();
        let nextCalled = false;
        await mw({ headers: { 'idempotency-key': 'seller-status-active-7' } }, res, () => { nextCalled = true; });
        assert.equal(nextCalled, true);

        // Simulate the downstream handler responding 200.
        res.status(200).json({ ok: true });
        assert.equal(client._setexCalls.length, 1);
        assert.equal(client._setexCalls[0].key, 'idempotency:seller-status-active-7');
        assert.equal(client._setexCalls[0].ttl, 60, 'must cache under the TTL the route chose');
    });

    test('does NOT cache a non-2xx response', async () => {
        const client = makeReadyClient();
        const mw = enforceIdempotency(60, { getClient: () => client });
        const res = makeRes();
        await mw({ headers: { 'idempotency-key': 'delete-user-99' } }, res, () => {});

        // Downstream handler rejects with a 400 -- a retry must be allowed to run again.
        res.status(400).json({ error: 'user has a pending balance' });
        assert.equal(client._setexCalls.length, 0);
    });

    test('fails open (calls next) when Redis is not ready, without reading', async () => {
        let getCalled = false;
        const notReady = {
            status: 'connecting',
            get() { getCalled = true; return new Promise(() => {}); }, // would hang if ever called
        };
        const mw = enforceIdempotency(60, { getClient: () => notReady });
        const res = makeRes();
        let nextCalled = false;
        await mw({ headers: { 'idempotency-key': 'k' } }, res, () => { nextCalled = true; });
        assert.equal(nextCalled, true);
        assert.equal(getCalled, false, 'must not issue a command against a not-ready client');
    });

    test('treats the in-memory fallback client as usable', async () => {
        const store = new Map();
        const fallback = {
            __inMemoryFallback: true,
            async get(k) { return store.get(k) ?? null; },
            async setex(k, _ttl, v) { store.set(k, v); return 'OK'; },
        };
        const mw = enforceIdempotency(60, { getClient: () => fallback });
        const res = makeRes();
        let nextCalled = false;
        await mw({ headers: { 'idempotency-key': 'fk' } }, res, () => { nextCalled = true; });
        assert.equal(nextCalled, true);
        res.status(200).json({ ok: true });
        assert.equal(store.get('idempotency:fk'), JSON.stringify({ status: 200, body: { ok: true } }));
    });

    test('fails open when the cache lookup stalls past the read timeout', async () => {
        const stalling = {
            status: 'ready',
            get() { return new Promise(() => {}); }, // never settles
        };
        const mw = enforceIdempotency(60, { getClient: () => stalling, readTimeoutMs: 30 });
        const res = makeRes();
        let nextCalled = false;
        const t0 = Date.now();
        await mw({ headers: { 'idempotency-key': 'slow' } }, res, () => { nextCalled = true; });
        assert.equal(nextCalled, true, 'a stalled Redis must not hang the request');
        assert.ok(Date.now() - t0 < 2000, 'should fall through shortly after the read timeout');
    });
});

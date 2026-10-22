import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { pool, withClient, withTransaction } from '../src/infrastructure/database/database.js';
import healthRoutes from '../src/application/routes/health.routes.js';

let app;
let server;
let baseUrl;

before(async () => {
    app = express();
    app.use('/health', healthRoutes);
    server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve) => server.close(resolve));
});

describe('Database Infrastructure Seam — withClient & withTransaction', () => {
    test('withClient leases a client and automatically releases it on success', async () => {
        const result = await withClient(async (client) => {
            const res = await client.query('SELECT 42 AS value');
            return res.rows[0].value;
        });
        assert.equal(result, 42);
    });

    test('withClient guarantees client release even if the callback throws', async () => {
        let capturedErr;
        try {
            await withClient(async () => {
                throw new Error('boom');
            });
        } catch (err) {
            capturedErr = err;
        }
        assert.equal(capturedErr?.message, 'boom');

        // Pool is still functional and client was released
        const check = await pool.query('SELECT 1 AS alive');
        assert.equal(check.rows[0].alive, 1);
    });

    test('withTransaction commits on success and releases client', async () => {
        const tempTable = `temp_tx_test_${Date.now()}`;
        await pool.query(`CREATE TEMP TABLE ${tempTable} (id INT, name TEXT)`);

        const inserted = await withTransaction(async (client) => {
            await client.query(`INSERT INTO ${tempTable} VALUES (1, 'alpha')`);
            const res = await client.query(`SELECT * FROM ${tempTable} WHERE id = 1`);
            return res.rows[0];
        });

        assert.equal(inserted.id, 1);
        assert.equal(inserted.name, 'alpha');

        // Verify committed data persists
        const check = await pool.query(`SELECT COUNT(*)::int AS cnt FROM ${tempTable}`);
        assert.equal(check.rows[0].cnt, 1);
    });

    test('withTransaction rolls back on error and releases client', async () => {
        const tempTable = `temp_tx_rollback_${Date.now()}`;
        await pool.query(`CREATE TEMP TABLE ${tempTable} (id INT, name TEXT)`);

        let thrownErr;
        try {
            await withTransaction(async (client) => {
                await client.query(`INSERT INTO ${tempTable} VALUES (2, 'beta')`);
                throw new Error('transaction failure simulated');
            });
        } catch (err) {
            thrownErr = err;
        }

        assert.equal(thrownErr?.message, 'transaction failure simulated');

        // Data should have been rolled back
        const check = await pool.query(`SELECT COUNT(*)::int AS cnt FROM ${tempTable}`);
        assert.equal(check.rows[0].cnt, 0);
    });
});

describe('Health & Readiness Endpoints Consolidation', () => {
    test('GET /health/ping returns 200 OK', async () => {
        const res = await fetch(`${baseUrl}/health/ping`);
        assert.equal(res.status, 200);
        const text = await res.text();
        assert.equal(text, 'OK');
    });

    test('GET /health returns liveness status and database connection indicator', async () => {
        const res = await fetch(`${baseUrl}/health`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.status, 'ok');
        assert.equal(body.database, 'connected');
        assert.ok(typeof body.uptime === 'number');
    });

    test('GET /health/ready returns readiness probe with dependency checks', async () => {
        const res = await fetch(`${baseUrl}/health/ready`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.status, 'ready');
        assert.equal(body.database, 'ready');
        assert.ok(body.redis);
        assert.ok(body.paystack);
    });

    test('GET /health/readiness returns readiness probe identical to /ready', async () => {
        const res = await fetch(`${baseUrl}/health/readiness`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.status, 'ready');
        assert.equal(body.database, 'ready');
        assert.ok(body.redis);
        assert.ok(body.paystack);
    });
});

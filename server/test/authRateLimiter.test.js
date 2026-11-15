import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

describe('authRateLimiter', () => {
    let originalNodeEnv;

    before(() => {
        originalNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
    });

    after(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    test('safely handles non-string and malformed email inputs without throwing 500', async () => {
        const { authLimiter } = await import('../src/application/middleware/authRateLimiter.js');

        const app = express();
        app.use(express.json());
        app.post('/api/admin/login', authLimiter, (req, res) => {
            res.json({ status: 'success' });
        });
        // Express error handler to capture 500 if middleware throws
        app.use((err, req, res, next) => {
            res.status(500).json({ error: err.message, stack: err.stack });
        });

        const server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, resolve));
        const port = server.address().port;

        try {
            const cases = [
                { name: 'object email (NoSQL injection probe)', body: { email: { $gt: '' }, password: 'secret' } },
                { name: 'empty object email', body: { email: {}, password: 'secret' } },
                { name: 'number email', body: { email: 12345, password: 'secret' } },
                { name: 'boolean email', body: { email: true, password: 'secret' } },
                { name: 'array email', body: { email: ['test@example.com'], password: 'secret' } },
                { name: 'null email', body: { email: null, password: 'secret' } },
                { name: 'empty string email', body: { email: '', password: 'secret' } },
                { name: 'whitespace email', body: { email: '   ', password: 'secret' } },
                { name: 'missing email field', body: { password: 'secret' } },
                { name: 'valid email with whitespace and mixed case', body: { email: '  Admin@Byblos.com  ', password: 'secret' } },
            ];

            for (const c of cases) {
                const response = await fetch(`http://127.0.0.1:${port}/api/admin/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(c.body),
                });
                const data = await response.json();
                assert.notEqual(
                    response.status,
                    500,
                    `Expected ${c.name} not to throw 500, but got: ${data.error}`
                );
                assert.equal(response.status, 200, `Expected 200 for ${c.name}`);
            }
        } finally {
            await new Promise((resolve) => server.close(resolve));
        }
    });
});

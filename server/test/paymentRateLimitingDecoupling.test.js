import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import {
  paymentRateLimiter,
  logisticsQuoteRateLimiter,
  paymentStatusRateLimiter,
} from '../src/application/middleware/rateLimiting.js';

describe('TDD Slice 1: Backend Rate Limiter Decoupling', () => {
  test('logisticsQuoteRateLimiter allows more than 10 requests without hitting paymentRateLimiter', async () => {
    assert.ok(logisticsQuoteRateLimiter, 'logisticsQuoteRateLimiter must be defined');

    const app = express();
    app.use(express.json());
    app.post('/api/payments/logistics-quote', logisticsQuoteRateLimiter, (req, res) => {
      res.status(200).json({ status: 'success', data: { feeAmount: 150 } });
    });

    const server = app.listen(0);
    const port = server.address().port;

    const makeQuoteRequest = () => new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1',
        port,
        path: '/api/payments/logistics-quote',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body) }));
      });
      req.on('error', reject);
      req.write(JSON.stringify({ location: { address: 'Westlands', latitude: -1.26, longitude: 36.80 } }));
      req.end();
    });

    try {
      // Send 15 requests (previously failed on request 11 due to 10-req payment limit)
      for (let i = 1; i <= 15; i++) {
        const res = await makeQuoteRequest();
        assert.equal(res.statusCode, 200, `Request #${i} should be 200 OK under dedicated logisticsQuoteRateLimiter`);
      }
    } finally {
      server.close();
    }
  });

  test('paymentStatusRateLimiter allows more than 10 polling requests without hitting paymentRateLimiter', async () => {
    assert.ok(paymentStatusRateLimiter, 'paymentStatusRateLimiter must be defined');

    const app = express();
    app.use(express.json());
    app.get('/api/payments/status/:id', paymentStatusRateLimiter, (req, res) => {
      res.status(200).json({ status: 'success', data: { status: 'PENDING' } });
    });

    const server = app.listen(0);
    const port = server.address().port;

    const makeStatusRequest = () => new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1',
        port,
        path: '/api/payments/status/inv_123',
        method: 'GET',
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body) }));
      });
      req.on('error', reject);
      req.end();
    });

    try {
      // Send 15 status checks
      for (let i = 1; i <= 15; i++) {
        const res = await makeStatusRequest();
        assert.equal(res.statusCode, 200, `Status check #${i} should be 200 OK`);
      }
    } finally {
      server.close();
    }
  });
});

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import axios from 'axios';
import express from 'express';
import { globalErrorHandler } from '../src/shared/utils/errorHandler.js';

describe('URIError & Malformed Client Requests Handling', () => {
  test('globalErrorHandler treats URIError as operational 400 and does NOT trigger alert', async () => {
    let webhookCalled = false;
    const originalPost = axios.post;
    axios.post = async (...args) => {
      webhookCalled = true;
      return originalPost.apply(axios, args);
    };

    const originalWebhookUrl = process.env.ALERT_WEBHOOK_URL;
    process.env.ALERT_WEBHOOK_URL = 'http://127.0.0.1:9999/fake-webhook';

    try {
      const uriError = new URIError("Failed to decode param '/%c0'");
      uriError.status = 400;
      uriError.statusCode = 400;

      const req = {
        id: 'test-req-123',
        method: 'GET',
        originalUrl: '/%c0',
        headers: {}
      };

      let responseStatusCode = null;
      let responseBody = null;

      const res = {
        status(code) {
          responseStatusCode = code;
          return this;
        },
        json(data) {
          responseBody = data;
          return this;
        }
      };

      const next = () => {};

      // Test production behavior
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        globalErrorHandler(uriError, req, res, next);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }

      assert.equal(webhookCalled, false, 'reportError webhook must NOT be called for client-side URIError');
      assert.equal(responseStatusCode, 400, 'Status code must be 400 Bad Request, not 500');
      assert.equal(responseBody.status, 'fail');
      assert.notEqual(responseBody.message, 'Something went wrong!', 'Must not leak 500 generic error');
    } finally {
      axios.post = originalPost;
      process.env.ALERT_WEBHOOK_URL = originalWebhookUrl;
    }
  });

  test('Early URI guard returns 400 Bad Request on malformed URI path without server error', async () => {
    const app = express();
    app.use((req, res, next) => {
      try {
        decodeURI(req.url);
        next();
      } catch (err) {
        if (err instanceof URIError) {
          return res.status(400).json({
            status: 'fail',
            message: 'Malformed URL encoding. The requested URI cannot be decoded.',
            requestId: req.id || req.headers['x-request-id'] || 'N/A'
          });
        }
        next(err);
      }
    });

    app.get('/test', (req, res) => res.status(200).json({ ok: true }));
    app.use(globalErrorHandler);

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/%c0`);
      assert.equal(response.status, 400);
      const data = await response.json();
      assert.equal(data.status, 'fail');
      assert.ok(data.message.includes('Malformed URL encoding'));
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('SyntaxError in body parser returns 400 Bad Request and is operational', async () => {
    const syntaxErr = new SyntaxError('Unexpected token in JSON at position 5');
    syntaxErr.statusCode = 400;
    syntaxErr.status = 400;
    syntaxErr.body = '{"foo';

    const req = {
      id: 'test-req-json',
      method: 'POST',
      originalUrl: '/api/test',
      headers: {}
    };

    let responseStatusCode = null;
    let responseBody = null;

    const res = {
      status(code) {
        responseStatusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      }
    };

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      globalErrorHandler(syntaxErr, req, res, () => {});
    } finally {
      process.env.NODE_ENV = originalEnv;
    }

    assert.equal(responseStatusCode, 400);
    assert.equal(responseBody.status, 'fail');
  });
});

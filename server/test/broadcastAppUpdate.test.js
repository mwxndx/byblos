import { test, describe, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import NotificationService from '../src/domains/communication/notifications/notification.service.js';
import { pool } from '../src/infrastructure/database/database.js';

describe('NotificationService.broadcastAppUpdate — FCM push delivery and token deactivation', () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const originalFetch = globalThis.fetch;
  const originalQuery = pool.query;

  before(() => {
    process.env.FIREBASE_PROJECT_ID = 'test-byblos-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test-fcm@test-byblos-project.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY = privateKey;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    pool.query = originalQuery;
  });

  test('tallies successful FCM dispatches as sent and zero failed when all accept', async () => {
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({
          access_token: 'mock-access-token-xyz',
          expires_in: 3600
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.includes('messages:send')) {
        return new Response(JSON.stringify({
          name: 'projects/test-byblos-project/messages/msg_valid_1'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(url, options);
    };

    pool.query = async (queryText, values) => {
      if (typeof queryText === 'string' && queryText.includes('notification_device_tokens') && queryText.includes('SELECT')) {
        return {
          rows: [
            { token: 'device-token-1', platform: 'android', app_version: '70', user_id: 101, role: 'buyer' },
            { token: 'device-token-2', platform: 'android', app_version: '71', user_id: 102, role: 'seller' },
          ]
        };
      }
      if (typeof queryText === 'string' && queryText.includes('INSERT INTO app_notifications')) {
        return { rows: [] };
      }
      return originalQuery.call(pool, queryText, values);
    };

    const result = await NotificationService.broadcastAppUpdate({
      minVersionCode: 73,
      title: 'Update Available',
      body: 'Please update Byblos',
    });

    assert.equal(result.targeted, 2);
    assert.equal(result.sent, 2, 'Successful FCM responses must be tallied into sent');
    assert.equal(result.failed, 0, 'Successful FCM responses must not be tallied into failed');
    assert.equal(result.deactivated, 0);
  });

  test('deactivates unregistered tokens in the database and counts them as failed', async () => {
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({
          access_token: 'mock-access-token-xyz',
          expires_in: 3600
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.includes('messages:send')) {
        return new Response(JSON.stringify({
          error: {
            code: 404,
            status: 'NOT_FOUND',
            details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }]
          }
        }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(url, options);
    };

    let deactivatedCaptured = [];
    pool.query = async (queryText, values) => {
      if (typeof queryText === 'string' && queryText.includes('notification_device_tokens') && queryText.includes('SELECT')) {
        return {
          rows: [
            { token: 'stale-token-dead-1', platform: 'android', app_version: '70', user_id: 101, role: 'buyer' },
          ]
        };
      }
      if (typeof queryText === 'string' && queryText.includes('UPDATE notification_device_tokens') && queryText.includes('is_active = FALSE')) {
        deactivatedCaptured = values[0];
        return { rowCount: 1 };
      }
      if (typeof queryText === 'string' && queryText.includes('INSERT INTO app_notifications')) {
        return { rows: [] };
      }
      return originalQuery.call(pool, queryText, values);
    };

    const result = await NotificationService.broadcastAppUpdate({
      minVersionCode: 73,
    });

    assert.equal(result.targeted, 1);
    assert.equal(result.sent, 0);
    assert.equal(result.failed, 1);
    assert.equal(result.deactivated, 1, 'Unregistered token must be counted in deactivated');
    assert.deepEqual(deactivatedCaptured, ['stale-token-dead-1'], 'Unregistered token must be marked inactive');
  });

  test('accurately splits mixed batch of delivered, unregistered, and rejected tokens', async () => {
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({
          access_token: 'mock-access-token-xyz',
          expires_in: 3600
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.includes('messages:send')) {
        const bodyObj = JSON.parse(options.body);
        const token = bodyObj?.message?.token;
        if (token === 'token-ok') {
          return new Response(JSON.stringify({ name: 'projects/p/messages/1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (token === 'token-unreg') {
          return new Response(JSON.stringify({
            error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] }
          }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        // Server error (e.g. 500 or rate limit)
        return new Response(JSON.stringify({ error: { message: 'Internal error' } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(url, options);
    };

    let deactivatedCaptured = [];
    pool.query = async (queryText, values) => {
      if (typeof queryText === 'string' && queryText.includes('notification_device_tokens') && queryText.includes('SELECT')) {
        return {
          rows: [
            { token: 'token-ok', platform: 'android', app_version: '70', user_id: 101, role: 'buyer' },
            { token: 'token-unreg', platform: 'android', app_version: '70', user_id: 102, role: 'seller' },
            { token: 'token-server-error', platform: 'android', app_version: '70', user_id: 103, role: 'buyer' },
          ]
        };
      }
      if (typeof queryText === 'string' && queryText.includes('UPDATE notification_device_tokens') && queryText.includes('is_active = FALSE')) {
        deactivatedCaptured = values[0];
        return { rowCount: 1 };
      }
      if (typeof queryText === 'string' && queryText.includes('INSERT INTO app_notifications')) {
        return { rows: [] };
      }
      return originalQuery.call(pool, queryText, values);
    };

    const result = await NotificationService.broadcastAppUpdate({ minVersionCode: 73 });

    assert.equal(result.targeted, 3);
    assert.equal(result.sent, 1, 'Only the token-ok should be counted as sent');
    assert.equal(result.failed, 2, 'token-unreg and token-server-error must be counted as failed');
    assert.equal(result.deactivated, 1, 'Only token-unreg should be deactivated');
    assert.deepEqual(deactivatedCaptured, ['token-unreg']);
  });
});

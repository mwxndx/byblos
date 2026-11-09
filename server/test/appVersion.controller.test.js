import { test, describe, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAppVersionPolicy,
  updateAppVersionPolicy,
  resetAppVersionPolicy
} from '../src/shared/utils/appVersion.js';
import { getAppVersion } from '../src/application/controllers/public.controller.js';
import cacheService from '../src/shared/utils/cache.service.js';

describe('App Version Policy & Cache Resilience Tests', () => {
  beforeEach(() => {
    resetAppVersionPolicy();
  });

  afterEach(() => {
    resetAppVersionPolicy();
  });

  after(() => {
    resetAppVersionPolicy();
    setTimeout(() => process.exit(0), 200).unref();
  });

  test('getAppVersionPolicy returns standard baseline policy with fallback values', () => {
    const policy = getAppVersionPolicy();
    assert.strictEqual(policy.platform, 'android');
    assert.ok(typeof policy.minAndroidVersionCode === 'number');
    assert.ok(typeof policy.latestAndroidVersionCode === 'number');
    assert.ok(typeof policy.latestVersionName === 'string');
    assert.ok(Array.isArray(policy.releaseNotes));
    assert.ok(policy.storeUrl.length > 0);
  });

  test('updateAppVersionPolicy dynamically updates runtime policy without restarting service', () => {
    const initial = getAppVersionPolicy();
    const targetMinCode = initial.latestAndroidVersionCode + 5;
    const targetName = `1.0.${targetMinCode}`;

    const updated = updateAppVersionPolicy({
      minVersionCode: targetMinCode,
      latestVersionCode: targetMinCode,
      latestVersionName: targetName,
      storeUrl: 'market://details?id=space.bybloshq.app.test'
    });

    assert.strictEqual(updated.minAndroidVersionCode, targetMinCode);
    assert.strictEqual(updated.latestAndroidVersionCode, targetMinCode);
    assert.strictEqual(updated.latestVersionName, targetName);
    assert.strictEqual(updated.storeUrl, 'market://details?id=space.bybloshq.app.test');

    // Confirm that subsequent getAppVersionPolicy() calls reflect the new runtime policy
    const reFetched = getAppVersionPolicy();
    assert.strictEqual(reFetched.minAndroidVersionCode, targetMinCode);
    assert.strictEqual(reFetched.latestAndroidVersionCode, targetMinCode);
    assert.strictEqual(reFetched.latestVersionName, targetName);
  });

  test('publicController.getAppVersion returns 200 with current active policy', async () => {
    updateAppVersionPolicy({
      minVersionCode: 99,
      latestVersionCode: 100,
      latestVersionName: '1.0.100'
    });

    let statusCode = null;
    let jsonPayload = null;
    const req = {};
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        jsonPayload = payload;
        return this;
      }
    };

    await getAppVersion(req, res);

    assert.strictEqual(statusCode, 200);
    assert.strictEqual(jsonPayload.status, 'success');
    assert.strictEqual(jsonPayload.data.minAndroidVersionCode, 99);
    assert.strictEqual(jsonPayload.data.latestAndroidVersionCode, 100);
    assert.strictEqual(jsonPayload.data.latestVersionName, '1.0.100');
  });

  test('cacheService handles offline redis gracefully without unhandled stream exceptions', async () => {
    // Check that isReady reports a boolean
    const ready = cacheService.isReady();
    assert.strictEqual(typeof ready, 'boolean');

    // Test get, set, del safety
    const key = `test_key_${Date.now()}`;
    const resultGet = await cacheService.get(key);
    assert.strictEqual(resultGet, null);

    const resultSet = await cacheService.set(key, { ping: 'pong' }, 10);
    assert.ok(typeof resultSet === 'boolean');

    const resultDel = await cacheService.del(key);
    assert.ok(typeof resultDel === 'boolean');

    const resultClear = await cacheService.clearPattern('test_key_*');
    assert.ok(typeof resultClear === 'boolean');
  });
});

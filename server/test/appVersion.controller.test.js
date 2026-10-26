import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getAppVersion } from '../src/application/controllers/public.controller.js';

describe('publicController.getAppVersion', () => {
  beforeEach(() => {
    delete process.env.MIN_ANDROID_VERSION_CODE;
    delete process.env.LATEST_ANDROID_VERSION_CODE;
    delete process.env.LATEST_ANDROID_VERSION_NAME;
    delete process.env.FORCE_ANDROID_UPDATE;
  });

  test('returns default version policy when env vars are not set', async () => {
    let statusCode = null;
    let responseBody = null;

    const req = {};
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      }
    };

    await getAppVersion(req, res);

    assert.equal(statusCode, 200);
    assert.equal(responseBody.status, 'success');
    assert.equal(responseBody.data.platform, 'android');
    assert.equal(responseBody.data.minAndroidVersionCode, 73);
    assert.equal(responseBody.data.latestAndroidVersionCode, 73);
    assert.equal(responseBody.data.latestVersionName, '1.0.73');
    assert.equal(responseBody.data.forceUpdate, true);
    assert.equal(responseBody.data.storeUrl, 'market://details?id=space.bybloshq.app');
    assert.ok(Array.isArray(responseBody.data.releaseNotes));
  });

  test('respects custom environment configuration for version codes and force update', async () => {
    process.env.MIN_ANDROID_VERSION_CODE = '75';
    process.env.LATEST_ANDROID_VERSION_CODE = '76';
    process.env.LATEST_ANDROID_VERSION_NAME = '1.0.76';
    process.env.FORCE_ANDROID_UPDATE = 'false';

    let statusCode = null;
    let responseBody = null;

    const req = {};
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      }
    };

    await getAppVersion(req, res);

    assert.equal(statusCode, 200);
    assert.equal(responseBody.data.minAndroidVersionCode, 75);
    assert.equal(responseBody.data.latestAndroidVersionCode, 76);
    assert.equal(responseBody.data.latestVersionName, '1.0.76');
    assert.equal(responseBody.data.forceUpdate, false);
  });
});

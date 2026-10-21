import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getConfig } from '../src/application/controllers/location.controller.js';

function createMockResponse() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

test('getConfig returns cartoApiKey from environment variable', async () => {
  const originalKey = process.env.CARTO_API_KEY;
  try {
    process.env.CARTO_API_KEY = 'test_carto_env_key';
    const req = {};
    const res = createMockResponse();

    await getConfig(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      status: 'success',
      data: {
        cartoApiKey: 'test_carto_env_key',
      },
    });
  } finally {
    process.env.CARTO_API_KEY = originalKey;
  }
});

test('getConfig returns empty string when CARTO_API_KEY is not set', async () => {
  const originalKey = process.env.CARTO_API_KEY;
  try {
    delete process.env.CARTO_API_KEY;
    const req = {};
    const res = createMockResponse();

    await getConfig(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      status: 'success',
      data: {
        cartoApiKey: '',
      },
    });
  } finally {
    process.env.CARTO_API_KEY = originalKey;
  }
});

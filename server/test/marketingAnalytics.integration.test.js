import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as marketingController from '../src/domains/growth/marketing/marketing.controller.js';

function mockRes() {
  let capturedResponse = null;
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      capturedResponse = payload;
      return this;
    },
    getResponse() {
      return capturedResponse;
    }
  };
  return res;
}

describe('Marketing Analytics Controller Endpoints', () => {
  it('getUserGrowth returns monthly data with buyers, sellers, and creators fields', async () => {
    const req = { query: { months: '6' } };
    const res = mockRes();
    let capturedError = null;
    const next = (err) => { capturedError = err; };

    await marketingController.getUserGrowth(req, res, next);

    assert.equal(capturedError, null, 'Expected getUserGrowth to succeed without error');
    const response = res.getResponse();
    assert.ok(response, 'Expected response');
    assert.equal(response.status, 'success');
    assert.ok(Array.isArray(response.data), 'Expected data to be an array');
    assert.ok(response.data.length > 0, 'Expected at least 1 month row');

    for (const row of response.data) {
      assert.ok(typeof row.month === 'string', 'Expected row.month to be string');
      assert.ok(typeof row.buyers === 'number', 'Expected row.buyers to be number');
      assert.ok(typeof row.sellers === 'number', 'Expected row.sellers to be number');
      assert.ok(typeof row.creators === 'number', 'Expected row.creators to be number');
    }
  });

  it('getGmvTrend returns monthly data with gmvKsh, revenue, and order metrics', async () => {
    const req = { query: { months: '6' } };
    const res = mockRes();
    let capturedError = null;
    const next = (err) => { capturedError = err; };

    await marketingController.getGmvTrend(req, res, next);

    assert.equal(capturedError, null, 'Expected getGmvTrend to succeed without error');
    const response = res.getResponse();
    assert.ok(response, 'Expected response');
    assert.equal(response.status, 'success');
    assert.ok(Array.isArray(response.data), 'Expected data to be an array');
    assert.ok(response.data.length > 0, 'Expected at least 1 month row');

    for (const row of response.data) {
      assert.ok(typeof row.month === 'string', 'Expected row.month to be string');
      assert.ok(typeof row.gmvKsh === 'number', 'Expected row.gmvKsh to be number');
      assert.ok(typeof row.revenue === 'number', 'Expected row.revenue to be number');
      assert.ok(typeof row.sellerPayouts === 'number', 'Expected row.sellerPayouts to be number');
      assert.ok(typeof row.orderCount === 'number', 'Expected row.orderCount to be number');
      assert.ok(typeof row.avgOrderValue === 'number', 'Expected row.avgOrderValue to be number');
    }
  });

  it('getGeography returns both buyers and sellers geographic distributions', async () => {
    const req = { query: {} };
    const res = mockRes();
    let capturedError = null;
    const next = (err) => { capturedError = err; };

    await marketingController.getGeography(req, res, next);

    assert.equal(capturedError, null, 'Expected getGeography to succeed without error');
    const response = res.getResponse();
    assert.ok(response, 'Expected response');
    assert.equal(response.status, 'success');
    assert.ok(response.data, 'Expected data object');
    assert.ok(Array.isArray(response.data.buyers), 'Expected buyers array');
    assert.ok(Array.isArray(response.data.sellers), 'Expected sellers array');

    for (const item of response.data.buyers) {
      assert.ok(typeof item.city === 'string', 'Expected item.city string');
      assert.ok(typeof item.percentage === 'number', 'Expected item.percentage number');
      assert.ok(typeof item.count === 'number', 'Expected item.count number');
      assert.notEqual(item.city.toLowerCase(), 'unknown city', 'Expected no unknown city');
    }

    for (const item of response.data.sellers) {
      assert.ok(typeof item.city === 'string', 'Expected item.city string');
      assert.ok(typeof item.percentage === 'number', 'Expected item.percentage number');
      assert.ok(typeof item.count === 'number', 'Expected item.count number');
      assert.notEqual(item.city.toLowerCase(), 'unknown city', 'Expected no unknown city');
    }
  });

  it('getSellerLocations returns formatted seller locations', async () => {
    const req = {};
    const res = mockRes();
    let capturedError = null;
    const next = (err) => { capturedError = err; };

    await marketingController.getSellerLocations(req, res, next);

    assert.equal(capturedError, null, 'Expected getSellerLocations to succeed without error');
    const response = res.getResponse();
    assert.ok(response, 'Expected response');
    assert.equal(response.status, 'success');
    assert.ok(Array.isArray(response.data), 'Expected data array');

    for (const item of response.data) {
      assert.ok(typeof item.city === 'string', 'Expected item.city string');
      assert.ok(typeof item.percentage === 'number', 'Expected item.percentage number');
      assert.ok(typeof item.count === 'number', 'Expected item.count number');
    }
  });
});

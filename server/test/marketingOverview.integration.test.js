import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as marketingController from '../src/domains/growth/marketing/marketing.controller.js';

describe('Marketing Overview KPI Controller', () => {
  it('returns totalBuyers and newBuyersThisMonth in the overview payload', async () => {
    let capturedResponse = null;
    const req = {};
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        capturedResponse = payload;
        return this;
      }
    };
    let capturedError = null;
    const next = (err) => {
      capturedError = err;
    };

    await marketingController.getOverview(req, res, next);

    assert.equal(capturedError, null, 'Expected getOverview to succeed without error');
    assert.ok(capturedResponse, 'Expected response to be sent');
    assert.equal(capturedResponse.status, 'success');
    assert.ok(capturedResponse.data, 'Expected data object in response');

    // Assert totalBuyers is explicitly returned
    assert.equal(
      typeof capturedResponse.data.totalBuyers,
      'number',
      'Expected data.totalBuyers to be a number'
    );
    assert.ok(capturedResponse.data.totalBuyers >= 0, 'Expected data.totalBuyers to be >= 0');

    // Assert newBuyersThisMonth is returned
    assert.equal(
      typeof capturedResponse.data.newBuyersThisMonth,
      'number',
      'Expected data.newBuyersThisMonth to be a number'
    );
    assert.ok(capturedResponse.data.newBuyersThisMonth >= 0, 'Expected data.newBuyersThisMonth to be >= 0');

    // Verify consistency
    assert.equal(
      capturedResponse.data.totalUsers,
      capturedResponse.data.activeSellers + capturedResponse.data.totalBuyers + capturedResponse.data.activeCreators,
      'Expected totalUsers to equal sum of activeSellers, totalBuyers, and activeCreators'
    );
  });
});

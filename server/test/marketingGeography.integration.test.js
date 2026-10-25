import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import * as marketingAnalyticsRepository from '../src/domains/growth/marketing/marketingAnalytics.repository.js';
import * as marketingController from '../src/domains/growth/marketing/marketing.controller.js';

describe('Marketing Geography Analytics & Location Resolution', () => {
  it('never returns "Unknown City" and falls back to Nairobi for buyers with missing city and location', async () => {
    // Insert a buyer with NULL city and NULL location
    const testEmail = `test-buyer-geo-${Date.now()}@byblos.test`;
    await pool.query(
      `INSERT INTO buyers (full_name, email, mobile_payment, city, location, terms_accepted)
       VALUES ($1, $2, $3, NULL, NULL, TRUE)`,
      ['Geo Test Buyer', testEmail, '0799887766']
    );

    const locations = await marketingAnalyticsRepository.findBuyerLocations();
    assert.ok(Array.isArray(locations), 'Expected findBuyerLocations to return an array');

    // Assert that no entry has 'Unknown City'
    const unknownEntry = locations.find(l => l.location === 'Unknown City');
    assert.equal(unknownEntry, undefined, 'findBuyerLocations must never return "Unknown City"');

    // Assert that Nairobi is present and has buyers
    const nairobiEntry = locations.find(l => l.location === 'Nairobi');
    assert.ok(nairobiEntry, 'Expected Nairobi to be present as the resolved location');
    assert.ok(Number(nairobiEntry.buyer_count) > 0, 'Expected Nairobi to have buyer_count > 0');
  });

  it('correctly aggregates buyers by specific location (e.g. Nyali) and falls back to city when location is empty', async () => {
    const mombasaEmail = `test-mombasa-${Date.now()}@byblos.test`;
    await pool.query(
      `INSERT INTO buyers (full_name, email, mobile_payment, city, location, terms_accepted)
       VALUES ($1, $2, $3, 'Mombasa', 'Nyali', TRUE)`,
      ['Mombasa Buyer', mombasaEmail, '0711223344']
    );

    const kisumuEmail = `test-kisumu-${Date.now()}@byblos.test`;
    await pool.query(
      `INSERT INTO buyers (full_name, email, mobile_payment, city, location, terms_accepted)
       VALUES ($1, $2, $3, 'Kisumu', NULL, TRUE)`,
      ['Kisumu Buyer', kisumuEmail, '0711223355']
    );

    const locations = await marketingAnalyticsRepository.findBuyerLocations();
    const nyaliEntry = locations.find(l => l.location === 'Nyali');
    assert.ok(nyaliEntry, 'Expected specific location "Nyali" to take precedence over "Mombasa"');
    assert.ok(Number(nyaliEntry.buyer_count) >= 1, 'Expected at least 1 buyer in Nyali');

    const kisumuEntry = locations.find(l => l.location === 'Kisumu');
    assert.ok(kisumuEntry, 'Expected city "Kisumu" fallback when location is NULL');
    assert.ok(Number(kisumuEntry.buyer_count) >= 1, 'Expected at least 1 buyer in Kisumu');
  });

  it('getGeography controller formats location distributions without "Unknown City"', async () => {
    let capturedResponse = null;
    const req = { query: { type: 'buyers' } };
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

    await marketingController.getGeography(req, res, next);

    assert.equal(capturedError, null, 'Expected getGeography to succeed without error');
    assert.ok(capturedResponse, 'Expected getGeography to send response');
    assert.equal(capturedResponse.status, 'success');
    assert.ok(Array.isArray(capturedResponse.data), 'Expected data to be an array');

    for (const item of capturedResponse.data) {
      assert.ok(item.location, 'Response item must include location');
      assert.notEqual(item.location, 'Unknown City', 'Response item location must not be "Unknown City"');
      assert.notEqual(item.location, 'unknown city', 'Response item location must not be "unknown city"');
      assert.notEqual(item.city, 'Unknown City', 'Response item city must not be "Unknown City"');
      assert.notEqual(item.city, 'unknown city', 'Response item city must not be "unknown city"');
      assert.ok(typeof item.percentage === 'number', 'Percentage must be a number');
    }

    // Also verify combined payload when query has no type
    let combinedResponse = null;
    const combinedRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        combinedResponse = payload;
        return this;
      }
    };
    await marketingController.getGeography({}, combinedRes, next);
    assert.ok(combinedResponse?.data?.buyers, 'Expected combined response to contain buyers array');
    assert.ok(combinedResponse?.data?.sellers, 'Expected combined response to contain sellers array');
  });

  it('getSellerLocations controller returns location and backward-compatible city', async () => {
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

    await marketingController.getSellerLocations(req, res, next);
    assert.equal(capturedError, null);
    assert.equal(capturedResponse.status, 'success');
    assert.ok(Array.isArray(capturedResponse.data));
    for (const item of capturedResponse.data) {
      assert.ok(item.location, 'Response item must include location');
      assert.ok(item.city, 'Response item must include city for backward compatibility');
      assert.notEqual(item.location, 'Unknown City');
    }
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import * as marketingAnalyticsRepository from '../src/domains/growth/marketing/marketingAnalytics.repository.js';
import * as marketingController from '../src/domains/growth/marketing/marketing.controller.js';

describe('Marketing Geography Analytics & City Resolution', () => {
  it('never returns "Unknown City" and falls back to Nairobi for buyers with missing city', async () => {
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

  it('correctly aggregates buyers with explicit geographic cities like Mombasa or Kisumu', async () => {
    const mombasaEmail = `test-mombasa-${Date.now()}@byblos.test`;
    await pool.query(
      `INSERT INTO buyers (full_name, email, mobile_payment, city, location, terms_accepted)
       VALUES ($1, $2, $3, 'Mombasa', 'Nyali', TRUE)`,
      ['Mombasa Buyer', mombasaEmail, '0711223344']
    );

    const locations = await marketingAnalyticsRepository.findBuyerLocations();
    const mombasaEntry = locations.find(l => l.location === 'Mombasa');
    assert.ok(mombasaEntry, 'Expected Mombasa entry to exist in location distribution');
    assert.ok(Number(mombasaEntry.buyer_count) >= 1, 'Expected at least 1 buyer in Mombasa');
  });

  it('getGeography controller formats city distributions without "Unknown City"', async () => {
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

    await marketingController.getGeography(req, res, next);

    assert.equal(capturedError, null, 'Expected getGeography to succeed without error');
    assert.ok(capturedResponse, 'Expected getGeography to send response');
    assert.equal(capturedResponse.status, 'success');
    assert.ok(Array.isArray(capturedResponse.data), 'Expected data to be an array');

    for (const item of capturedResponse.data) {
      assert.notEqual(item.city, 'Unknown City', 'Response item city must not be "Unknown City"');
      assert.notEqual(item.city, 'unknown city', 'Response item city must not be "unknown city"');
      assert.ok(typeof item.percentage === 'number', 'Percentage must be a number');
    }
  });
});

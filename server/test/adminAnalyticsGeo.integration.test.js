import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import adminService from '../src/domains/identity/admin/admin.service.js';
import {
  NAIROBI_LOCATIONS,
  normalizeNairobiLocation,
  normalizeNairobiLocationSql
} from '../src/shared/utils/location.utils.js';

describe('Admin Analytics Geographic Reach & Nairobi Locations', () => {
  describe('Location Utility Unit Normalization', () => {
    it('normalizes canonical and freeform Nairobi neighborhoods', () => {
      assert.equal(normalizeNairobiLocation('CBD'), 'CBD');
      assert.equal(normalizeNairobiLocation('Nairobi CBD'), 'CBD');
      assert.equal(normalizeNairobiLocation('Dynamic Mall, Tom Mboya St, CBD'), 'CBD');
      assert.equal(normalizeNairobiLocation('Central Business District'), 'CBD');
      assert.equal(normalizeNairobiLocation('Westlands'), 'Westlands');
      assert.equal(normalizeNairobiLocation('Rhapta Road, Westlands, Nairobi'), 'Westlands');
      assert.equal(normalizeNairobiLocation('Karen'), 'Karen');
      assert.equal(normalizeNairobiLocation('Karen Shopping Centre'), 'Karen');
      assert.equal(normalizeNairobiLocation('Kilimani'), 'Kilimani');
      assert.equal(normalizeNairobiLocation('Kileleshwa'), 'Kileleshwa');
      assert.equal(normalizeNairobiLocation('Lavington'), 'Lavington');
      assert.equal(normalizeNairobiLocation('Parklands'), 'Parklands');
      assert.equal(normalizeNairobiLocation('Eastleigh'), 'Eastleigh');
      assert.equal(normalizeNairobiLocation('South B'), 'South B');
      assert.equal(normalizeNairobiLocation('South C'), 'South C');
      assert.equal(normalizeNairobiLocation("Lang'ata"), 'Langata');
      assert.equal(normalizeNairobiLocation('Langata Road'), 'Langata');
      assert.equal(normalizeNairobiLocation('Kasarani'), 'Kasarani');
      assert.equal(normalizeNairobiLocation('Embakasi'), 'Embakasi');
      assert.equal(normalizeNairobiLocation('Ruaraka'), 'Ruaraka');
    });

    it('rejects generic city name "Nairobi" and locations outside Nairobi', () => {
      assert.equal(normalizeNairobiLocation('Nairobi'), null, 'Generic city name Nairobi must return null');
      assert.equal(normalizeNairobiLocation('Nairobi, Kenya'), null);
      assert.equal(normalizeNairobiLocation('Unknown City'), null);
      assert.equal(normalizeNairobiLocation('Unknown'), null);
      assert.equal(normalizeNairobiLocation(''), null);
      assert.equal(normalizeNairobiLocation(null), null);
      assert.equal(normalizeNairobiLocation(undefined), null);
      assert.equal(normalizeNairobiLocation('Mombasa'), null);
      assert.equal(normalizeNairobiLocation('Kisumu'), null);
      assert.equal(normalizeNairobiLocation('Nyali'), null);
    });
  });

  describe('Database SQL Normalization Function', () => {
    it('executes normalizeNairobiLocationSql in PostgreSQL matching canonical neighborhoods', async () => {
      const sql = `
        SELECT
          ${normalizeNairobiLocationSql("'CBD'")} AS cbd,
          ${normalizeNairobiLocationSql("'Nairobi CBD'")} AS nairobi_cbd,
          ${normalizeNairobiLocationSql("'Riverside, Westlands'")} AS westlands,
          ${normalizeNairobiLocationSql("'Karen Hub'")} AS karen,
          ${normalizeNairobiLocationSql("'Nairobi'")} AS nairobi,
          ${normalizeNairobiLocationSql("'Mombasa'")} AS mombasa
      `;
      const { rows } = await pool.query(sql);
      assert.equal(rows[0].cbd, 'CBD');
      assert.equal(rows[0].nairobi_cbd, 'CBD');
      assert.equal(rows[0].westlands, 'Westlands');
      assert.equal(rows[0].karen, 'Karen');
      assert.equal(rows[0].nairobi, null, 'SQL must resolve "Nairobi" to NULL');
      assert.equal(rows[0].mombasa, null, 'SQL must resolve non-Nairobi locations to NULL');
    });
  });

  describe('Admin Analytics Geographic Reach Aggregation', () => {
    const timestamp = Date.now();
    const createdUserIds = [];

    before(async () => {
      // Create test users for buyers, sellers, creators
      const userRes = await pool.query(`
        INSERT INTO users (email, password_hash, role)
        VALUES 
          ('geo_b_cbd_${timestamp}@test.com', 'hash', 'buyer'),
          ('geo_b_westlands_${timestamp}@test.com', 'hash', 'buyer'),
          ('geo_b_nai_${timestamp}@test.com', 'hash', 'buyer'),
          ('geo_s_cbd_${timestamp}@test.com', 'hash', 'seller'),
          ('geo_c_solo_${timestamp}@test.com', 'hash', 'creator'),
          ('geo_c_linked_${timestamp}@test.com', 'hash', 'creator')
        RETURNING id, email, role;
      `);
      for (const row of userRes.rows) {
        createdUserIds.push(row.id);
      }

      const uBCBD = userRes.rows.find(r => r.email.startsWith('geo_b_cbd'));
      const uBWestlands = userRes.rows.find(r => r.email.startsWith('geo_b_westlands'));
      const uBNai = userRes.rows.find(r => r.email.startsWith('geo_b_nai'));
      const uSCBD = userRes.rows.find(r => r.email.startsWith('geo_s_cbd'));
      const uCSolo = userRes.rows.find(r => r.email.startsWith('geo_c_solo'));
      const uCLinked = userRes.rows.find(r => r.email.startsWith('geo_c_linked'));

      // Insert buyers
      await pool.query(
        `INSERT INTO buyers (user_id, email, full_name, location) VALUES ($1, $2, 'CBD Buyer', 'CBD')`,
        [uBCBD.id, uBCBD.email]
      );
      await pool.query(
        `INSERT INTO buyers (user_id, email, full_name, location) VALUES ($1, $2, 'Westlands Buyer', 'Westlands, Rhapta')`,
        [uBWestlands.id, uBWestlands.email]
      );
      await pool.query(
        `INSERT INTO buyers (user_id, email, full_name, location) VALUES ($1, $2, 'Generic Nairobi Buyer', 'Nairobi')`,
        [uBNai.id, uBNai.email]
      );

      // Solo creator has a buyer profile with location in Westlands
      await pool.query(
        `INSERT INTO buyers (user_id, email, full_name, location) VALUES ($1, $2, 'Solo Creator Buyer', 'Westlands')`,
        [uCSolo.id, uCSolo.email]
      );
      await pool.query(
        `INSERT INTO creators (user_id, email, first_name, last_name, mpesa_number, status)
         VALUES ($1, $2, 'Solo', 'Creator', '0700111222', 'active')`,
        [uCSolo.id, uCSolo.email]
      );

      // Seller in CBD
      const sCBDRes = await pool.query(
        `INSERT INTO sellers (user_id, email, full_name, shop_name, location, status, is_active)
         VALUES ($1, $2, 'CBD Seller', 'CBD Shop Test', 'CBD', 'active', true) RETURNING id`,
        [uSCBD.id, uSCBD.email]
      );
      const sellerId = sCBDRes.rows[0].id;

      // Linked creator partnered with CBD seller
      const cLinkedRes = await pool.query(
        `INSERT INTO creators (user_id, email, first_name, last_name, mpesa_number, status)
         VALUES ($1, $2, 'Linked', 'Creator', '0700333444', 'active') RETURNING id`,
        [uCLinked.id, uCLinked.email]
      );
      const linkedCreatorId = cLinkedRes.rows[0].id;

      await pool.query(
        `INSERT INTO seller_creator_links (seller_id, creator_id, code, status, commission_rate)
         VALUES ($1, $2, 'LINK_${timestamp}', 'active', 10)`,
        [sellerId, linkedCreatorId]
      );
    });

    after(async () => {
      if (createdUserIds.length > 0) {
        await pool.query(
          `DELETE FROM seller_creator_links WHERE creator_id IN (
             SELECT id FROM creators WHERE user_id = ANY($1::int[])
           )`,
          [createdUserIds]
        );
        await pool.query(`DELETE FROM creators WHERE user_id = ANY($1::int[])`, [createdUserIds]);
        await pool.query(`DELETE FROM sellers WHERE user_id = ANY($1::int[])`, [createdUserIds]);
        await pool.query(`DELETE FROM buyers WHERE user_id = ANY($1::int[])`, [createdUserIds]);
        await pool.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [createdUserIds]);
      }
    });

    it('returns only Nairobi locations and NEVER returns "Nairobi" in geoDistribution', async () => {
      const analytics = await adminService.getAnalytics();
      assert.ok(analytics.geoDistribution, 'geoDistribution should be present');
      assert.ok(Array.isArray(analytics.geoDistribution), 'geoDistribution should be an array');

      const names = analytics.geoDistribution.map(entry => entry.name.toLowerCase());
      assert.equal(
        names.includes('nairobi'),
        false,
        'geoDistribution must NEVER contain "Nairobi" as a location bar'
      );
      assert.equal(
        names.includes('unknown'),
        false,
        'geoDistribution must not contain "Unknown"'
      );
    });

    it('accurately counts buyers, sellers, and creators per Nairobi location', async () => {
      const analytics = await adminService.getAnalytics();
      const geo = analytics.geoDistribution;

      const cbd = geo.find(entry => entry.name === 'CBD');
      assert.ok(cbd, 'CBD should be present in geoDistribution');
      assert.ok(cbd.buyers >= 1, 'CBD should have at least 1 buyer');
      assert.ok(cbd.sellers >= 1, 'CBD should have at least 1 seller');
      assert.ok(cbd.creators >= 1, 'CBD should have at least 1 creator from the linked partnership');

      const westlands = geo.find(entry => entry.name === 'Westlands');
      assert.ok(westlands, 'Westlands should be present in geoDistribution');
      assert.ok(westlands.buyers >= 1, 'Westlands should have at least 1 buyer');
      assert.ok(
        westlands.creators >= 1,
        'Westlands should have at least 1 creator from solo creator profile location'
      );
    });
  });
});

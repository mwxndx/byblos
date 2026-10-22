import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { resolveCrossRoleAccess } from '../src/domains/identity/auth/crossRoleResolver.js';
import * as userRepository from '../src/domains/identity/users/user.repository.js';
import {
  generateRefreshToken,
  verifyRefreshToken,
  refreshAccessToken
} from '../src/shared/utils/refreshToken.js';
import { signToken, verifyToken } from '../src/shared/utils/jwt.js';
import {
  setCachedAuth,
  getCachedAuth,
  invalidateAuthCacheForUser,
  _authCache
} from '../src/shared/utils/authCache.js';
import { invalidateUserSessions } from '../src/shared/utils/sessionRevocation.js';
import { pool } from '../src/infrastructure/database/database.js';

describe('Track 3: Identity, Access Management & Token Security Hardening', () => {
  let testUserId;
  let testSellerId;
  let testEmail;

  before(async () => {
    // Create an isolated test user and seller profile
    testEmail = `track3-test-${Date.now()}@byblos.test`;
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active, is_verified)
       VALUES ($1, 'hash_test_123', 'seller', true, true)
       RETURNING id`,
      [testEmail]
    );
    testUserId = userRes.rows[0].id;

    const sellerRes = await pool.query(
      `INSERT INTO sellers (user_id, full_name, email, shop_name, whatsapp_number, terms_accepted, location, status)
       VALUES ($1, 'Track 3 Seller', $2, $3, '0712345678', true, 'Nairobi', 'active')
       RETURNING id`,
      [testUserId, testEmail, `shop-${Date.now()}`]
    );
    testSellerId = sellerRes.rows[0].id;
  });

  after(async () => {
    if (testSellerId) {
      await pool.query('DELETE FROM sellers WHERE id = $1', [testSellerId]);
    }
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
  });

  test('Action 3.1: Marketing user is strictly rejected from Admin portal (privilege escalation prevention)', async () => {
    const marketingUser = { id: 999991, role: 'marketing', email: 'marketer@byblos.test' };
    const dummySignToken = (id, role) => `token-${id}-${role}`;

    await assert.rejects(
      async () => {
        await resolveCrossRoleAccess({
          user: marketingUser,
          type: 'admin',
          signToken: dummySignToken,
          pool,
          Buyer: {},
          SellerModel: {}
        });
      },
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, 'WRONG_PORTAL');
        return true;
      }
    );
  });

  test('Action 3.1: findAdminAuthProfile strictly returns admin accounts and rejects non-admin accounts', async () => {
    // Non-admin seller user
    const nonAdminProfile = await userRepository.findAdminAuthProfile(testUserId);
    assert.equal(nonAdminProfile, undefined, 'Non-admin user must not be returned by findAdminAuthProfile');

    // Create an actual admin user
    const adminEmail = `admin-check-${Date.now()}@byblos.test`;
    const adminRes = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active, is_verified)
       VALUES ($1, 'admin_hash_123', 'admin', true, true)
       RETURNING id`,
      [adminEmail]
    );
    const adminId = adminRes.rows[0].id;

    try {
      const adminProfile = await userRepository.findAdminAuthProfile(adminId);
      assert.ok(adminProfile, 'Admin user must be found by findAdminAuthProfile');
      assert.equal(adminProfile.role, 'admin');
    } finally {
      await pool.query('DELETE FROM users WHERE id = $1', [adminId]);
    }
  });

  test('Action 3.2: RFC 6819 Grace Period absorbs concurrent refresh token races', async () => {
    const token = generateRefreshToken(testUserId, 'seller');

    // First call consumes and rotates the refresh token
    const firstResult = await refreshAccessToken(token);
    assert.ok(firstResult.accessToken, 'First refresh must issue access token');
    assert.ok(firstResult.refreshToken, 'First refresh must issue new refresh token');

    // Concurrent second call with the exact same token within the 30s grace window
    // MUST NOT fail with "Refresh token has been revoked", but return the replay cached result
    const secondResult = await refreshAccessToken(token);
    assert.equal(
      secondResult.accessToken,
      firstResult.accessToken,
      'Concurrent refresh within grace period must replay identical access token'
    );
    assert.equal(
      secondResult.refreshToken,
      firstResult.refreshToken,
      'Concurrent refresh within grace period must replay identical new refresh token'
    );
  });

  test('Action 3.3: Suspended seller cannot refresh access token', async () => {
    // Generate a fresh refresh token
    const token = generateRefreshToken(testUserId, 'seller');

    // Suspend seller
    await pool.query('UPDATE sellers SET status = $1 WHERE id = $2', ['suspended', testSellerId]);

    try {
      await assert.rejects(
        async () => {
          await refreshAccessToken(token);
        },
        /deactivated or suspended/
      );
    } finally {
      // Restore status to active
      await pool.query('UPDATE sellers SET status = $1 WHERE id = $2', ['active', testSellerId]);
    }
  });

  test('Action 3.4: invalidateAuthCacheForUser evicts target user tokens from memory', () => {
    const dummyToken = `test-jwt-token-${Date.now()}`;
    const userPayload = { id: 888123, email: 'test@session.local', role: 'seller' };

    setCachedAuth(dummyToken, userPayload);
    assert.ok(getCachedAuth(dummyToken), 'Token should be cached in memory');

    invalidateAuthCacheForUser(888123);
    assert.equal(getCachedAuth(dummyToken), null, 'Cached token must be evicted for user ID');
  });

  test('Action 3.4: invalidateUserSessions updates password_changed_at in database', async () => {
    const beforeRes = await pool.query('SELECT password_changed_at FROM users WHERE id = $1', [testUserId]);
    const initialTimestamp = beforeRes.rows[0].password_changed_at;

    await invalidateUserSessions(testUserId);

    const afterRes = await pool.query('SELECT password_changed_at FROM users WHERE id = $1', [testUserId]);
    const updatedTimestamp = afterRes.rows[0].password_changed_at;

    assert.ok(updatedTimestamp, 'password_changed_at must be populated');
    if (initialTimestamp) {
      assert.ok(new Date(updatedTimestamp) >= new Date(initialTimestamp));
    }
  });

  test('Action 3.5: Zero-Downtime Secret Rotation validates legacy signed JWTs', () => {
    const oldSecret = 'old-legacy-secret-2024-xyz';
    process.env.JWT_PREVIOUS_SECRETS = `some-other-secret, ${oldSecret}`;

    // Token signed with legacy secret
    const legacyToken = jwt.sign(
      { id: testUserId, role: 'seller', iss: 'byblos-auth-api', aud: 'byblos-clients' },
      oldSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const decoded = verifyToken(legacyToken);
    assert.equal(decoded.id, testUserId);
    assert.equal(decoded.role, 'seller');

    // Tampered token must still be rejected
    assert.throws(
      () => verifyToken(legacyToken + 'tamper'),
      /Invalid token/
    );

    delete process.env.JWT_PREVIOUS_SECRETS;
  });

  test('Action 3.5: Zero-Downtime Secret Rotation validates legacy refresh tokens', () => {
    const oldRefreshSecret = 'old-refresh-secret-2024-abc';
    process.env.JWT_REFRESH_PREVIOUS_SECRETS = oldRefreshSecret;

    const legacyRefreshToken = jwt.sign(
      { id: testUserId, role: 'seller', type: 'refresh' },
      oldRefreshSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const decoded = verifyRefreshToken(legacyRefreshToken);
    assert.equal(decoded.id, testUserId);
    assert.equal(decoded.role, 'seller');

    delete process.env.JWT_REFRESH_PREVIOUS_SECRETS;
  });
});

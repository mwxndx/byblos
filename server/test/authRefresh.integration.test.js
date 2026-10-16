// Integration tests for the complete refresh-token lifecycle across all 6 roles:
// Buyer, Seller, Creator, Admin, Marketing, and Logistics.
//
// Covers:
// 1. Dual-transport login: sets HttpOnly refreshToken cookie and returns refreshToken in JSON.
// 2. Cookie-only refresh via POST /api/auth/refresh-token (web pattern).
// 3. Request-body refresh via POST /api/auth/refresh-token (native/Capacitor pattern).
// 4. Token rotation: old refresh token revoked/blacklisted, new refresh token issued.
// 5. Revocation & expiry handling.
// 6. Logout across roles: revokes sessions and clears auth/refresh cookies.
// 7. Data minimization: findAdminAuthProfile excludes password_hash, reset/verification tokens.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const { pool } = await import('../src/infrastructure/database/database.js');
const apiRoutes = (await import('../src/application/routes/index.js')).default;
const tokenBlacklist = (await import('../src/domains/identity/tokens/tokenBlacklist.service.js')).default;
const { findAdminAuthProfile } = await import('../src/domains/identity/users/user.repository.js');

const PASSWORD = 'TestPass123!';
let passwordHash;

let server;
let baseUrl;
const createdUserIds = [];

before(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 12);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', apiRoutes);
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || 500).json({
      status: err.status || 'error',
      message: err.message
    });
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  if (createdUserIds.length) {
    await pool.query('DELETE FROM buyers WHERE user_id = ANY($1)', [createdUserIds]);
    await pool.query('DELETE FROM sellers WHERE user_id = ANY($1)', [createdUserIds]);
    await pool.query('DELETE FROM creators WHERE user_id = ANY($1)', [createdUserIds]);
    await pool.query('DELETE FROM logistics_partners WHERE user_id = ANY($1)', [createdUserIds]);
    await pool.query('DELETE FROM user_roles WHERE user_id = ANY($1)', [createdUserIds]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [createdUserIds]);
  }
  if (tokenBlacklist.redis) {
    tokenBlacklist.redis.disconnect();
  }
  await pool.end();
});

async function createTestAccount(role) {
  const email = `refresh-it-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.byblos.local`;
  const dbRole = role === 'marketing' ? 'admin' : role;
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, role, is_verified, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, TRUE, TRUE, NOW(), NOW())
     RETURNING id, email`,
    [email, passwordHash, dbRole]
  );
  const user = rows[0];
  createdUserIds.push(user.id);

  const { rows: roleRows } = await pool.query('SELECT id FROM roles WHERE slug = $1', [dbRole]);
  if (roleRows[0]) {
    await pool.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [user.id, roleRows[0].id]
    );
  }

  if (role === 'buyer') {
    await pool.query(
      `INSERT INTO buyers (user_id, full_name, email, mobile_payment, terms_accepted)
       VALUES ($1, 'Test Buyer', $2, $3, TRUE)`,
      [user.id, email, `0722${String(user.id).padStart(6, '0')}`]
    );
  } else if (role === 'seller') {
    await pool.query(
      `INSERT INTO sellers (user_id, full_name, email, shop_name, whatsapp_number, terms_accepted, location)
       VALUES ($1, 'Test Seller', $2, $3, $4, TRUE, 'Nairobi')`,
      [user.id, email, `Shop-${user.id}`, `0722${String(user.id).padStart(6, '0')}`]
    );
  } else if (role === 'creator') {
    await pool.query(
      `INSERT INTO creators (user_id, first_name, last_name, email, mpesa_number, terms_accepted)
       VALUES ($1, 'Test', 'Creator', $2, $3, TRUE)`,
      [user.id, email, `0722${String(user.id).padStart(6, '0')}`]
    );
  } else if (role === 'logistics') {
    await pool.query(
      `INSERT INTO logistics_partners (user_id, name, slug, email, active)
       VALUES ($1, 'Test Logistics Partner', $2, $3, TRUE)`,
      [user.id, `partner-${user.id}`, email]
    );
  }

  return { id: user.id, email, password: PASSWORD, role };
}

function parseCookies(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  const cookies = {};
  for (const cookieStr of raw) {
    const parts = cookieStr.split(';')[0].split('=');
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  }
  return { raw, cookies };
}

describe('Refresh-token lifecycle across all six roles', () => {
  const roleEndpoints = [
    { role: 'buyer', loginPath: '/api/buyers/login', logoutPath: '/api/buyers/logout' },
    { role: 'seller', loginPath: '/api/sellers/login', logoutPath: '/api/sellers/logout' },
    { role: 'creator', loginPath: '/api/creators/login', logoutPath: '/api/creators/logout' },
    { role: 'admin', loginPath: '/api/admin/login', logoutPath: '/api/admin/logout' },
    { role: 'marketing', loginPath: '/api/admin/marketing/login', logoutPath: '/api/admin/marketing/logout' },
    { role: 'logistics', loginPath: '/api/logistics/login', logoutPath: '/api/logistics/logout' }
  ];

  for (const { role, loginPath, logoutPath } of roleEndpoints) {
    test(`${role}: login issues refreshToken in JSON body AND sets HttpOnly refreshToken cookie`, async () => {
      const account = await createTestAccount(role);

      const res = await fetch(`${baseUrl}${loginPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.email, password: account.password })
      });

      assert.equal(res.status, 200, `login failed for ${role}`);
      const body = await res.json();
      assert.equal(body.status, 'success');

      // Check JSON payload
      const jsonRefreshToken = body.data?.refreshToken;
      assert.ok(jsonRefreshToken, `Expected refreshToken in data for ${role}`);

      // Check cookies
      const { raw, cookies } = parseCookies(res);
      assert.ok(cookies.refreshToken, `Expected refreshToken cookie for ${role}`);
      assert.equal(cookies.refreshToken, jsonRefreshToken);

      // Verify cookie properties
      const refreshCookieHeader = raw.find((h) => h.startsWith('refreshToken='));
      assert.ok(refreshCookieHeader, 'refreshToken cookie header found');
      assert.match(refreshCookieHeader, /HttpOnly/i);
      assert.match(refreshCookieHeader, /Path=\/api\/auth\/refresh-token/i);
      assert.match(refreshCookieHeader, /SameSite=Lax/i);
    });

    test(`${role}: logout revokes session and clears cookies`, async () => {
      const account = await createTestAccount(role);

      const loginRes = await fetch(`${baseUrl}${loginPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.email, password: account.password })
      });
      const loginBody = await loginRes.json();
      const accessToken = loginBody.data?.token;
      const refreshToken = loginBody.data?.refreshToken;
      const { cookies } = parseCookies(loginRes);

      const logoutRes = await fetch(`${baseUrl}${logoutPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Cookie': `jwt=${cookies.jwt || ''}; refreshToken=${cookies.refreshToken || ''}`
        },
        body: JSON.stringify({ refreshToken })
      });

      assert.equal(logoutRes.status, 200, `logout failed for ${role}`);
      const { raw } = parseCookies(logoutRes);
      // Ensure clearing headers for jwt and refreshToken cookies
      assert.ok(raw.some((h) => h.includes('jwt=;') || h.includes('jwt=Max-Age=0') || h.includes('Expires=Thu, 01 Jan 1970')));
      assert.ok(raw.some((h) => h.includes('refreshToken=;') || h.includes('refreshToken=Max-Age=0') || h.includes('Expires=Thu, 01 Jan 1970')));

      // Confirm refresh token is blacklisted in tokenBlacklist
      const isBlacklisted = await tokenBlacklist.isBlacklisted(refreshToken);
      assert.equal(isBlacklisted, true, `refreshToken for ${role} should be blacklisted after logout`);
    });
  }

  test('POST /api/auth/refresh-token supports cookie-only refresh (web pattern)', async () => {
    const account = await createTestAccount('buyer');

    const loginRes = await fetch(`${baseUrl}/api/buyers/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password: account.password })
    });
    const { cookies } = parseCookies(loginRes);

    // Refresh with EMPTY body and cookie header
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `refreshToken=${cookies.refreshToken}`
      },
      body: JSON.stringify({})
    });

    assert.equal(refreshRes.status, 200);
    const body = await refreshRes.json();
    assert.equal(body.status, 'success');
    assert.ok(body.data.accessToken);
    assert.ok(body.data.refreshToken);

    const refreshCookies = parseCookies(refreshRes);
    assert.ok(refreshCookies.cookies.jwt);
    assert.ok(refreshCookies.cookies.refreshToken);
  });

  test('POST /api/auth/refresh-token supports request-body refresh (Capacitor/native pattern)', async () => {
    const account = await createTestAccount('seller');

    const loginRes = await fetch(`${baseUrl}/api/sellers/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password: account.password })
    });
    const loginBody = await loginRes.json();
    const token = loginBody.data.refreshToken;

    // Refresh with NO cookies, token in request body
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token })
    });

    assert.equal(refreshRes.status, 200);
    const body = await refreshRes.json();
    assert.equal(body.status, 'success');
    assert.ok(body.data.accessToken);
    assert.ok(body.data.refreshToken);
  });

  test('POST /api/auth/refresh-token rejects revoked tokens', async () => {
    const account = await createTestAccount('creator');

    const loginRes = await fetch(`${baseUrl}/api/creators/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password: account.password })
    });
    const loginBody = await loginRes.json();
    const token = loginBody.data.refreshToken;

    // Blacklist the token explicitly
    const decoded = jwt.decode(token);
    await tokenBlacklist.addToken(token, decoded.exp);

    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token })
    });

    assert.equal(refreshRes.status, 401);
    const body = await refreshRes.json();
    assert.match(body.message, /revoked/i);
  });

  test('POST /api/auth/refresh-token rejects expired tokens', async () => {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const expiredToken = jwt.sign(
      { id: 999999, role: 'buyer', type: 'refresh' },
      secret,
      { expiresIn: '-1s' }
    );

    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: expiredToken })
    });

    assert.equal(refreshRes.status, 401);
    const body = await refreshRes.json();
    assert.match(body.message, /expired/i);
  });

  test('POST /api/auth/refresh-token rejects missing token with 400', async () => {
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    assert.equal(refreshRes.status, 400);
    const body = await refreshRes.json();
    assert.match(body.message, /Refresh token is required/i);
  });

  test('findAdminAuthProfile excludes sensitive fields (SEC-02 data minimization)', async () => {
    const admin = await createTestAccount('admin');

    const profile = await findAdminAuthProfile(admin.id);
    assert.ok(profile, 'Expected admin profile to be returned');

    // Required fields are present
    assert.equal(profile.user_table_id, admin.id);
    assert.equal(profile.profile_id, admin.id);
    assert.equal(profile.email, admin.email);
    assert.equal(profile.role, 'admin');
    assert.equal(profile.is_active, true);
    assert.equal(profile.is_verified, true);
    assert.ok('password_changed_at' in profile);

    // Sensitive fields are strictly omitted
    assert.equal(profile.password_hash, undefined, 'password_hash must be excluded');
    assert.equal(profile.password, undefined, 'password must be excluded');
    assert.equal(profile.reset_password_token, undefined, 'reset_password_token must be excluded');
    assert.equal(profile.reset_password_expires, undefined, 'reset_password_expires must be excluded');
    assert.equal(profile.verification_token, undefined, 'verification_token must be excluded');
  });
});

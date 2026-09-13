// Unit tests for the cache-hit re-authorization gate (isCachedAccountRevoked). No DB.
//
// The auth middleware caches a standardized user object for AUTH_CACHE_TTL_MS (5s) to
// absorb concurrent requests. On every cache hit it must re-apply the same revocation
// checks the fresh-path auth queries enforce (userRepository.find*AuthProfile). The
// original gate only caught status === 'suspended', so an admin who set a seller/creator
// to 'inactive' or 'deleted' left that account with a valid session for the rest of the
// 5s window — even though the fresh path (COALESCE(status,'active') = 'active') would have
// rejected it. These tests pin the gate to the fresh-path semantics for every role.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isCachedAccountRevoked } from '../src/application/middleware/auth.js';

describe('auth cache — isCachedAccountRevoked', () => {
  test('allows an active, enabled account', () => {
    assert.equal(isCachedAccountRevoked({ is_active: true, status: 'active' }), false);
  });

  test('revokes when the user row is deactivated (is_active = false)', () => {
    assert.equal(isCachedAccountRevoked({ is_active: false, status: 'active' }), true);
  });

  test("revokes 'suspended' (the case the original gate already caught)", () => {
    assert.equal(isCachedAccountRevoked({ is_active: true, status: 'suspended' }), true);
  });

  test("revokes 'inactive' — the admin deactivation value the fresh path rejects but the old gate missed", () => {
    assert.equal(isCachedAccountRevoked({ is_active: true, status: 'inactive' }), true);
  });

  test("revokes 'deleted' — soft-deleted profiles must not keep cached access", () => {
    assert.equal(isCachedAccountRevoked({ is_active: true, status: 'deleted' }), true);
  });

  test('allows accounts with no profile status (admin/marketing carry none)', () => {
    // Matches COALESCE(status,'active') / "status IS NULL" allowances in the fresh queries.
    assert.equal(isCachedAccountRevoked({ is_active: true }), false);
    assert.equal(isCachedAccountRevoked({ is_active: true, status: undefined }), false);
  });

  test('allows an active logistics partner, revokes a deactivated one', () => {
    assert.equal(isCachedAccountRevoked({ is_active: true, partner_active: true }), false);
    assert.equal(isCachedAccountRevoked({ is_active: true, partner_active: null }), false); // no partner row
    assert.equal(isCachedAccountRevoked({ is_active: true, partner_active: false }), true);
  });

  test('treats a missing user object as revoked', () => {
    assert.equal(isCachedAccountRevoked(null), true);
    assert.equal(isCachedAccountRevoked(undefined), true);
  });
});

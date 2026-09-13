// Unit tests for the admin request validators. No DB — these parse plain
// objects. Focused on the updateSellerStatus enum: sellers.status is a plain
// varchar with no DB check constraint, so before this the schema accepted any
// string (z.string().optional()) and wrote it verbatim into the column. A
// typo or wrong-casing ('Active', 'pending_review') would be stored but never
// match the exact-string auth suspension gate (auth.js: status === 'suspended'),
// silently failing to suspend while the admin UI reported success. The enum
// makes such a value a clean 400 instead.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { updateSellerStatus } from '../src/shared/validations/admin.validation.js';

describe('admin.validation — updateSellerStatus status enum', () => {
  test('accepts every status the app actually uses', () => {
    for (const status of ['active', 'inactive', 'suspended', 'deleted']) {
      const result = updateSellerStatus.safeParse({ id: '5', status });
      assert.equal(result.success, true, `"${status}" should be accepted`);
    }
  });

  test('rejects a wrong-casing typo that would silently defeat the auth gate', () => {
    const result = updateSellerStatus.safeParse({ id: '5', status: 'Active' });
    assert.equal(result.success, false, '"Active" (wrong casing) must be rejected');
    assert.match(result.error.issues[0].message, /must be one of/i);
  });

  test('rejects an unrecognized status value', () => {
    const result = updateSellerStatus.safeParse({ id: '5', status: 'pending_review' });
    assert.equal(result.success, false, 'an unknown status must be rejected, not written verbatim');
  });

  test('rejects a missing status instead of nulling the column', () => {
    const result = updateSellerStatus.safeParse({ id: '5' });
    assert.equal(result.success, false, 'status is required — a statusless request must 400');
  });

  test('still requires the id path param', () => {
    const result = updateSellerStatus.safeParse({ status: 'active' });
    assert.equal(result.success, false, 'a missing id must be rejected');
  });
});

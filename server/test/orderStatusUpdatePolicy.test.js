// Regression tests for the generic order status-update authorization policy.
//
// Audit finding (CRITICAL, IDOR / broken access control): PATCH
// /api/orders/:id/status was guarded only by `protect`, and
// OrderService.updateOrderStatus never checked whether the caller owned the
// order — so any authenticated user could drive any order's state machine,
// including into COMPLETED (which, via this path, skips escrow release and
// strands the seller's funds).
//
// Pure logic, no database.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { assertOrderStatusUpdateAuthorized } from '../src/domains/orders/order/orderStatusUpdatePolicy.js';

const order = { id: 'o1', seller_id: 'seller-1', buyer_id: 'buyer-1' };
const owningSeller = { sellerId: 'seller-1', role: 'seller' };
const otherSeller = { sellerId: 'seller-2', role: 'seller' };
const buyer = { buyerId: 'buyer-1', role: 'buyer' };
const admin = { id: 'admin-1', role: 'admin' };

function throwsForbidden(fn) {
  assert.throws(fn, (err) => err.statusCode === 403 && err.code === 'ORDER_UPDATE_FORBIDDEN');
}
function throwsNotAllowed(fn) {
  assert.throws(fn, (err) => err.statusCode === 400 && err.code === 'ORDER_STATUS_NOT_ALLOWED');
}

describe('assertOrderStatusUpdateAuthorized', () => {
  test('allows the owning seller to make an operational transition', () => {
    assert.doesNotThrow(() => assertOrderStatusUpdateAuthorized(owningSeller, order, 'READY_FOR_BUYER'));
  });

  test('allows an admin to make an operational transition', () => {
    assert.doesNotThrow(() => assertOrderStatusUpdateAuthorized(admin, order, 'FULFILLING'));
  });

  test('rejects a seller who does not own the order (IDOR)', () => {
    throwsForbidden(() => assertOrderStatusUpdateAuthorized(otherSeller, order, 'FULFILLING'));
  });

  test('rejects a buyer using the seller status endpoint', () => {
    throwsForbidden(() => assertOrderStatusUpdateAuthorized(buyer, order, 'FULFILLING'));
  });

  test('rejects a user with no seller/buyer identity', () => {
    throwsForbidden(() => assertOrderStatusUpdateAuthorized({ id: 'x' }, order, 'FULFILLING'));
  });

  test('blocks COMPLETED through this endpoint even for the owning seller (escrow-release path only)', () => {
    throwsNotAllowed(() => assertOrderStatusUpdateAuthorized(owningSeller, order, 'COMPLETED'));
  });

  test('blocks COMPLETED even for an admin (must use the dedicated completion/reversal flow)', () => {
    throwsNotAllowed(() => assertOrderStatusUpdateAuthorized(admin, order, 'COMPLETED'));
  });

  test('blocks CANCELLED through this endpoint (must use the cancellation flow that refunds + reverses)', () => {
    throwsNotAllowed(() => assertOrderStatusUpdateAuthorized(owningSeller, order, 'CANCELLED'));
  });

  test('blocks refund states through this endpoint', () => {
    throwsNotAllowed(() => assertOrderStatusUpdateAuthorized(owningSeller, order, 'REFUND_PENDING'));
    throwsNotAllowed(() => assertOrderStatusUpdateAuthorized(owningSeller, order, 'REFUNDED'));
  });
});

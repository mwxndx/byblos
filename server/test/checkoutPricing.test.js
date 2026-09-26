// Pure-logic unit tests for the authoritative checkout pricing + creator
// commission derivation (no DB). The load-bearing rule is the accounting
// invariant: buyerTotal === sellerPayout + creatorCommission + platformFee +
// deliveryFee. Commission is seller-funded and must never inflate what the
// buyer pays.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveOrderFinancials,
  computeCreatorCommission,
  computeServiceCharge,
  roundMoney,
  PLATFORM_SELLER_FEE,
  PLATFORM_COLLECTION_FEE
} from '../src/domains/payments/payments/checkoutPricing.js';

// buyerTotal === sellerPayout + creatorCommission + platformFee + deliveryFee + collectionFee.
// deliveryFee and collectionFee are both buyer-paid logistics charges owed to
// Mzigo and are mutually exclusive per order (door delivery XOR collection).
const invariantHolds = (f) =>
  roundMoney(f.buyerTotal) === roundMoney(f.sellerPayout + f.creatorCommission + f.platformFee + f.deliveryFee + f.collectionFee);

describe('computeCreatorCommission', () => {
  test('is round(subtotal × agreed rate)', () => {
    assert.equal(computeCreatorCommission(1400, 0.05), 70);
    assert.equal(computeCreatorCommission(1000, 0.1), 100);
  });
  test('is zero with no/zero/negative rate', () => {
    assert.equal(computeCreatorCommission(1000, 0), 0);
    assert.equal(computeCreatorCommission(1000, undefined), 0);
    assert.equal(computeCreatorCommission(1000, -0.5), 0);
  });
  test('uses the FULL subtotal (not subtotal − fee)', () => {
    // 5% of 2000 is 100, not 5% of (2000-10).
    assert.equal(computeCreatorCommission(2000, 0.05), 100);
  });
});

describe('deriveOrderFinancials', () => {
  test('no commission, no delivery — seller keeps subtotal minus the flat fee', () => {
    const f = deriveOrderFinancials({ subtotal: 1000 });
    const sc = computeServiceCharge(1000);
    assert.equal(f.serviceCharge, sc);
    assert.equal(f.platformFee, PLATFORM_SELLER_FEE + sc);
    assert.equal(f.sellerPayout, 1000 - PLATFORM_SELLER_FEE);
    assert.equal(f.buyerTotal, 1000 + sc);
    assert.ok(invariantHolds(f));
  });

  test('commission is deducted from the seller, NOT added to the buyer', () => {
    const withOut = deriveOrderFinancials({ subtotal: 1400 });
    const withCommission = deriveOrderFinancials({ subtotal: 1400, creatorCommission: 70 });
    // Buyer pays the same either way — commission is seller-funded.
    assert.equal(withCommission.buyerTotal, withOut.buyerTotal);
    // Seller absorbs the commission.
    assert.equal(withCommission.sellerPayout, withOut.sellerPayout - 70);
    assert.equal(withCommission.creatorCommission, 70);
    // Platform fee is unchanged — it excludes the seller-funded commission.
    assert.equal(withCommission.platformFee, withOut.platformFee);
    assert.ok(invariantHolds(withCommission));
  });

  test('delivery passes through to the buyer total and the invariant', () => {
    const f = deriveOrderFinancials({ subtotal: 1000, deliveryFee: 150, creatorCommission: 50 });
    assert.equal(f.buyerTotal, 1000 + f.serviceCharge + 150);
    assert.equal(f.sellerPayout, 1000 - 50 - PLATFORM_SELLER_FEE);
    assert.equal(f.collectionFee, 0);
    assert.ok(invariantHolds(f));
  });

  test('collection fee passes through like delivery (buyer-paid, seller unaffected)', () => {
    const noLogistics = deriveOrderFinancials({ subtotal: 1000, creatorCommission: 50 });
    const f = deriveOrderFinancials({ subtotal: 1000, collectionFee: PLATFORM_COLLECTION_FEE, creatorCommission: 50 });
    // Flat KES 100 collection fee, added to the buyer total only.
    assert.equal(PLATFORM_COLLECTION_FEE, 100);
    assert.equal(f.collectionFee, 100);
    assert.equal(f.buyerTotal, noLogistics.buyerTotal + 100);
    // Seller payout and platform fee are unchanged — the fee is Mzigo's, not the seller's or Byblos's.
    assert.equal(f.sellerPayout, noLogistics.sellerPayout);
    assert.equal(f.platformFee, noLogistics.platformFee);
    assert.ok(invariantHolds(f));
  });

  test('the accounting invariant holds across many combinations (delivery XOR collection)', () => {
    for (const subtotal of [50, 100, 333, 999, 1400, 25000]) {
      for (const rate of [0, 0.01, 0.05, 0.1, 0.25]) {
        // Mutually exclusive per order: either a delivery fee, or the flat collection fee, or neither.
        for (const [deliveryFee, collectionFee] of [[0, 0], [100, 0], [337, 0], [0, 100]]) {
          const commission = computeCreatorCommission(subtotal, rate);
          const f = deriveOrderFinancials({ subtotal, deliveryFee, collectionFee, creatorCommission: commission });
          assert.ok(
            invariantHolds(f),
            `invariant broke for subtotal=${subtotal} rate=${rate} delivery=${deliveryFee} collection=${collectionFee}`
          );
        }
      }
    }
  });
});

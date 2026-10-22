import test from 'node:test';
import assert from 'node:assert/strict';
import Fees, { toCents, roundMoney } from '../src/shared/config/fees.js';

test('Track 6: Financial Workflows, Payments & Escrow Hardening', async (t) => {
  await t.test('Action 6.1: Withdrawal fee continuous tiers with zero boundary gap', () => {
    // Under minimum
    assert.equal(Fees.calculateWithdrawalFee(0), 0);
    assert.equal(Fees.calculateWithdrawalFee(49.99), 0);
    assert.equal(Fees.calculateWithdrawalFee(-10), 0);
    assert.equal(Fees.calculateWithdrawalFee(NaN), 0);

    // Tier 1 (KES 50 - 1,500): fee = 21
    assert.equal(Fees.calculateWithdrawalFee(50), 21, 'KES 50 min should be 21');
    assert.equal(Fees.calculateWithdrawalFee(100), 21, 'KES 100 should be 21');
    assert.equal(Fees.calculateWithdrawalFee(1000), 21, 'KES 1000 should be 21');
    assert.equal(Fees.calculateWithdrawalFee(1500), 21, 'KES 1500 boundary should be 21');

    // CRITICAL FIX: Boundary gap strictly between 1,500 and 1,501 (e.g. 1500.50)
    // Previously fell through all tiers and returned 0! Now correctly assessed as tier 2.
    assert.equal(Fees.calculateWithdrawalFee(1500.01), 45, 'KES 1500.01 must be 45');
    assert.equal(Fees.calculateWithdrawalFee(1500.50), 45, 'KES 1500.50 must be 45 (plugged gap)');
    assert.equal(Fees.calculateWithdrawalFee(1500.99), 45, 'KES 1500.99 must be 45');

    // Tier 2 (KES 1,500.01 - 19,999.99): fee = 45
    assert.equal(Fees.calculateWithdrawalFee(1501), 45, 'KES 1501 should be 45');
    assert.equal(Fees.calculateWithdrawalFee(10000), 45, 'KES 10000 should be 45');
    assert.equal(Fees.calculateWithdrawalFee(19999.99), 45, 'KES 19999.99 boundary should be 45');

    // Tier 3 (KES 20,000+): fee = 63
    assert.equal(Fees.calculateWithdrawalFee(20000), 63, 'KES 20000 should be 63');
    assert.equal(Fees.calculateWithdrawalFee(20000.01), 63, 'KES 20000.01 should be 63');
    assert.equal(Fees.calculateWithdrawalFee(50000), 63, 'KES 50000 should be 63');
    assert.equal(Fees.calculateWithdrawalFee(250000), 63, 'KES 250000 max should be 63');

    // Verify cents-based helper
    assert.equal(Fees.calculateWithdrawalFeeInCents(1500.50), 4500);
    assert.equal(Fees.calculateWithdrawalFeeInCents(20000), 6300);

    // Verify string numeric coercion
    assert.equal(Fees.calculateWithdrawalFee('1500.50'), 45);
    assert.equal(Fees.calculateWithdrawalFee('20000'), 63);
  });

  await t.test('Action 6.2: Buyer product service charge computed in integer cents', () => {
    // Non-positive or invalid amounts
    assert.equal(Fees.calculateProductServiceCharge(0), 0);
    assert.equal(Fees.calculateProductServiceCharge(-50), 0);
    assert.equal(Fees.calculateProductServiceCharge(NaN), 0);

    // Authoritative Byblos examples
    // 50 KES * 2% = 1 KES -> ceil(1) = 1
    assert.equal(Fees.calculateProductServiceCharge(50), 1);
    // 999 KES * 2% = 19.98 KES -> ceil(19.98) = 20
    assert.equal(Fees.calculateProductServiceCharge(999), 20);
    // 1000 KES * 2% = 20 KES -> ceil(20) = 20
    assert.equal(Fees.calculateProductServiceCharge(1000), 20);
    // 101 KES * 2% = 2.02 KES -> ceil(2.02) = 3
    assert.equal(Fees.calculateProductServiceCharge(101), 3);

    // Cents helper
    assert.equal(Fees.calculateProductServiceChargeInCents(999), 2000);
    assert.equal(Fees.calculateProductServiceChargeInCents(50), 100);
  });

  await t.test('Action 6.3: Canonical toCents and roundMoney helpers', () => {
    // toCents pure function and on Fees object
    assert.equal(toCents(100), 10000);
    assert.equal(Fees.toCents(100), 10000);
    assert.equal(toCents(1500.50), 150050);
    assert.equal(toCents('45.25'), 4525);
    assert.equal(toCents(null), 0);
    assert.equal(toCents(undefined), 0);

    // roundMoney pure function and on Fees object
    assert.equal(roundMoney(1500.504), 1500.50);
    assert.equal(Fees.roundMoney(1500.506), 1500.51);
    assert.equal(roundMoney('99.99'), 99.99);
  });
});

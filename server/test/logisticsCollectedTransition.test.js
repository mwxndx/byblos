// Slice B: the hub "buyer collected" confirmation adds a `collected` status on
// the pickup leg (after dropped_at_hub). Pure transition/mapping logic, no DB.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertValidLegTransition,
  normalizeRequestedLogisticsStatus,
} from '../src/domains/logistics/logisticsDashboard.helpers.js';

describe('pickup "collected" status (hub confirms buyer collection)', () => {
  test('external buyer_collected maps to internal collected', () => {
    const { internalStatus } = normalizeRequestedLogisticsStatus('pickup', 'buyer_collected');
    assert.equal(internalStatus, 'collected');
  });

  test('dropped_at_hub -> collected is a valid pickup transition', () => {
    assert.doesNotThrow(() =>
      assertValidLegTransition({ legType: 'pickup', currentStatus: 'dropped_at_hub', targetStatus: 'collected', paymentComplete: true })
    );
  });

  test('collected is terminal — no onward transition', () => {
    assert.throws(() =>
      assertValidLegTransition({ legType: 'pickup', currentStatus: 'collected', targetStatus: 'dropped_at_hub', paymentComplete: true })
    );
  });

  test('cannot jump to collected before the package is dropped at the hub', () => {
    assert.throws(() =>
      assertValidLegTransition({ legType: 'pickup', currentStatus: 'picked_up', targetStatus: 'collected', paymentComplete: true })
    );
  });
});

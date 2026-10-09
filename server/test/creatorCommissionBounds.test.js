import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import Fees from '../src/shared/config/fees.js';
import CreatorService from '../src/domains/growth/creators/creator.service.js';
import { updateSeller } from '../src/domains/commerce/sellers/seller.model.js';

describe('Creator Commission Bounds (1% to 30%)', () => {
  test('Fees configuration defines 1% floor and 30% ceiling', () => {
    assert.equal(Fees.CREATOR_MIN_COMMISSION_RATE, 0.01);
    assert.equal(Fees.CREATOR_MAX_COMMISSION_RATE, 0.30);
  });

  test('CreatorService.updateSellerCreatorListing throws on rate below 1% or above 30%', async () => {
    await assert.rejects(
      async () => {
        await CreatorService.updateSellerCreatorListing(99999, { creatorCommissionRate: 0.005 });
      },
      { message: /Creator commission must be between 1% and 30%/ }
    );

    await assert.rejects(
      async () => {
        await CreatorService.updateSellerCreatorListing(99999, { creatorCommissionRate: 0.35 });
      },
      { message: /Creator commission must be between 1% and 30%/ }
    );
  });

  test('seller.model.js updateSeller throws on rate below 1% or above 30%', async () => {
    await assert.rejects(
      async () => {
        await updateSeller(99999, { creatorCommissionRate: 0.35 });
      },
      { message: /Creator commission must be between 1% and 30%/ }
    );

    await assert.rejects(
      async () => {
        await updateSeller(99999, { creatorCommissionRate: 0.005 });
      },
      { message: /Creator commission must be between 1% and 30%/ }
    );
  });
});

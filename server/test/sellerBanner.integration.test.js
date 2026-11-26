import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import {
  findActiveWithStats,
  updateSellerBanner,
} from '../src/domains/commerce/sellers/seller.repository.js';
import { findSellerByShopName, findSellerById } from '../src/domains/commerce/sellers/seller.model.js';
import { sanitizePublicSeller, sanitizeSeller } from '../src/shared/utils/sanitize.js';
import ImageService from '../src/infrastructure/storage/image.service.js';
import {
  createUser,
  createSeller,
  cleanupSeller,
  cleanupUser,
} from './helpers/factories.js';

describe('seller banner — storage, queries, and buyer ranking', () => {
  test('persists banner_url on seller, exposes it in sanitizers, and ranks bannered shops higher', async (t) => {
    let user1;
    let user2;
    let sellerWithBanner;
    let sellerWithoutBanner;

    t.after(async () => {
      if (sellerWithBanner) await cleanupSeller(sellerWithBanner.id).catch(() => {});
      if (sellerWithoutBanner) await cleanupSeller(sellerWithoutBanner.id).catch(() => {});
      if (user1) await cleanupUser(user1.id).catch(() => {});
      if (user2) await cleanupUser(user2.id).catch(() => {});
    });

    user1 = await createUser({});
    user2 = await createUser({});
    sellerWithoutBanner = await createSeller({ userId: user1.id, shopName: `NoBannerShop_${Date.now()}` });
    sellerWithBanner = await createSeller({ userId: user2.id, shopName: `BannerShop_${Date.now()}` });

    // Give both sellers identical avatar + social links so banner_url is the sole tie-breaker
    const sharedAvatar = 'https://res.cloudinary.com/byblos/image/upload/v1/profiles/avatar.jpg';
    const bannerUrl = 'https://res.cloudinary.com/byblos/image/upload/v1/banners/hero.jpg';

    await pool.query(
      `UPDATE sellers
          SET avatar_url = $1, instagram_link = 'ig_handle', tiktok_link = 'tt_handle'
        WHERE id = ANY($2::int[])`,
      [sharedAvatar, [sellerWithoutBanner.id, sellerWithBanner.id]]
    );

    const updated = await updateSellerBanner(sellerWithBanner.id, bannerUrl);
    assert.equal(updated?.bannerUrl, bannerUrl);

    const byId = await findSellerById(sellerWithBanner.id);
    assert.equal(sanitizeSeller(byId)?.bannerUrl, bannerUrl);

    const byShopName = await findSellerByShopName(sellerWithBanner.shop_name || sellerWithBanner.shopName);
    assert.equal(sanitizePublicSeller(byShopName)?.bannerUrl, bannerUrl);

    const noBannerByShop = await findSellerByShopName(sellerWithoutBanner.shop_name || sellerWithoutBanner.shopName);
    assert.equal(sanitizePublicSeller(noBannerByShop)?.bannerUrl, null);

    // Uniform ImageService.saveUploadedImage handles empty removal cleanly
    const cleared = await ImageService.saveUploadedImage({ value: '' });
    assert.equal(cleared, null);

    const ranked = await findActiveWithStats({ limit: 10000, offset: 0 });
    const idxWithBanner = ranked.findIndex((r) => Number(r.id) === Number(sellerWithBanner.id));
    const idxWithoutBanner = ranked.findIndex((r) => Number(r.id) === Number(sellerWithoutBanner.id));
    assert.ok(idxWithBanner !== -1 && idxWithoutBanner !== -1, 'both test sellers should appear in ranked list');
    assert.ok(idxWithBanner < idxWithoutBanner, 'seller with banner_url must rank ahead of seller without banner_url');
  });
});

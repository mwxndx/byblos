import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const { pool } = await import('../src/infrastructure/database/database.js');
const LogisticsQuoteService = (await import('../src/domains/logistics/logisticsQuote.service.js')).default;
const LogisticsDashboardService = (await import('../src/domains/logistics/logisticsDashboard.service.js')).default;
const LogisticsControllerDefault = (await import('../src/domains/logistics/logistics.controller.js')).default;
const LogisticsControllerNamed = await import('../src/domains/logistics/logistics.controller.js');
const LocationController = (await import('../src/application/controllers/location.controller.js')).default;
const TrackingController = (await import('../src/application/controllers/tracking.controller.js')).default;
const { createBuyer, createSeller, createCompletedOrder, cleanupOrder, cleanupSeller, cleanupBuyer } =
  await import('./helpers/factories.js');

let partnerId;

before(async () => {
  const { rows } = await pool.query(`SELECT id FROM logistics_partners WHERE slug = 'mzigo-ego' LIMIT 1`);
  partnerId = rows[0]?.id;
  if (!partnerId) {
    const { rows: inserted } = await pool.query(
      `INSERT INTO logistics_partners (name, slug, email, active)
       VALUES ('Mzigo Ego Test', 'mzigo-ego', 'mzigo-test@byblos.internal', TRUE)
       RETURNING id`
    );
    partnerId = inserted[0].id;
  }
});

async function cleanupTrack7Fixtures({ order, seller, buyer, requestId }) {
  if (requestId) {
    await pool.query('DELETE FROM logistics_tracking_events WHERE logistics_request_id = $1', [requestId]).catch(() => {});
    await pool.query('DELETE FROM logistics_legs WHERE logistics_request_id = $1', [requestId]).catch(() => {});
    await pool.query('DELETE FROM logistics_requests WHERE id = $1', [requestId]).catch(() => {});
  }
  if (order?.id) await cleanupOrder(order.id).catch(() => {});
  if (seller?.id) await cleanupSeller(seller.id).catch(() => {});
  if (buyer?.id) await cleanupBuyer(buyer.id).catch(() => {});
}

describe('Track 7 Action 7.1: Controller Architecture & Standardization', () => {
  test('LogisticsController exports all handlers as static methods and matching named functions', () => {
    assert.ok(LogisticsControllerDefault, 'LogisticsController default export must exist');
    assert.strictEqual(typeof LogisticsControllerDefault.loginLogisticsPartner, 'function');
    assert.strictEqual(typeof LogisticsControllerDefault.logoutLogisticsPartner, 'function');
    assert.strictEqual(typeof LogisticsControllerDefault.getLogisticsMe, 'function');
    assert.strictEqual(typeof LogisticsControllerDefault.getLogisticsDashboardRequests, 'function');
    assert.strictEqual(typeof LogisticsControllerDefault.updateLogisticsLegStatus, 'function');
    assert.strictEqual(typeof LogisticsControllerDefault.updateRiderLocation, 'function');

    assert.strictEqual(LogisticsControllerNamed.loginLogisticsPartner, LogisticsControllerDefault.loginLogisticsPartner);
    assert.strictEqual(LogisticsControllerNamed.updateLogisticsLegStatus, LogisticsControllerDefault.updateLogisticsLegStatus);
  });

  test('Location and Tracking controllers expose standard default exports', () => {
    assert.ok(LocationController, 'LocationController default export must exist');
    assert.strictEqual(typeof LocationController.getConfig, 'function');
    assert.strictEqual(typeof LocationController.search, 'function');

    assert.ok(TrackingController, 'TrackingController default export must exist');
    assert.strictEqual(typeof TrackingController.getPublicTrackingByToken, 'function');
  });
});

describe('Track 7 Action 7.3: Spatial Quoting & Door Minimum Floor', () => {
  test('Haversine distance calculation is robust against antipodal clamping and never returns NaN', () => {
    const origin = { latitude: 0, longitude: -180 };
    const destination = { latitude: 0, longitude: 180 };

    const distance = LogisticsQuoteService.calculateDistanceKm(origin, destination);
    assert.ok(Number.isFinite(distance), `Antipodal distance must be a finite number, got: ${distance}`);
    assert.strictEqual(isNaN(distance), false);

    // North to South poles
    const poleNorth = { latitude: 90, longitude: 0 };
    const poleSouth = { latitude: -90, longitude: 0 };
    const poleDistance = LogisticsQuoteService.calculateDistanceKm(poleNorth, poleSouth);
    assert.ok(Number.isFinite(poleDistance), 'Pole-to-pole distance must be finite');
    assert.ok(poleDistance > 19000 && poleDistance < 21000, `Expected ~20015 km, got: ${poleDistance}`);
  });

  test('quoteBuyerDoorDelivery enforces a 1 km floor and prevents 0 KES charges', () => {
    const hub = LogisticsQuoteService.getConfiguredHub();
    // Quote for exact same location as hub (distance 0)
    const quoteZero = LogisticsQuoteService.quoteBuyerDoorDelivery(hub);
    assert.strictEqual(quoteZero.distanceKm, 0);
    assert.strictEqual(quoteZero.chargeableDistanceKm, 1, 'Chargeable distance must have a 1 km floor');
    assert.strictEqual(quoteZero.feeAmount, 40, 'Fee amount must be at least 40 KES (1 km minimum rate)');

    // Quote for very close location (e.g. 200m away)
    const quoteNear = LogisticsQuoteService.quoteBuyerDoorDelivery({
      latitude: hub.latitude + 0.001,
      longitude: hub.longitude + 0.001
    });
    assert.ok(quoteNear.distanceKm < 0.5, 'Distance should be under 500m');
    assert.strictEqual(quoteNear.chargeableDistanceKm, 1);
    assert.strictEqual(quoteNear.feeAmount, 40);
  });
});

describe('Track 7 Action 7.2: Handover Sequencing & Verification Code Enforcement', () => {
  test('blocks delivery leg progression if sibling pickup leg has not completed collection from seller', async (t) => {
    let fixture;
    t.after(() => cleanupTrack7Fixtures(fixture || {}));

    const buyer = await createBuyer({});
    const seller = await createSeller({});
    const order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 2000,
      sellerPayoutAmount: 1980,
      platformFeeAmount: 20
    });
    await pool.query("UPDATE product_orders SET status = 'FULFILLING' WHERE id = $1", [order.id]);

    const { rows: [req] } = await pool.query(
      `INSERT INTO logistics_requests (order_id, partner_id, package_code, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id`,
      [order.id, partnerId, `BYB-LOG-${order.id}`]
    );

    const { rows: [pickupLeg] } = await pool.query(
      `INSERT INTO logistics_legs (logistics_request_id, leg_type, payer, status, distance_km)
       VALUES ($1, 'pickup', 'seller', 'assigned', 2.5)
       RETURNING id`,
      [req.id]
    );

    const { rows: [deliveryLeg] } = await pool.query(
      `INSERT INTO logistics_legs (logistics_request_id, leg_type, payer, status, distance_km)
       VALUES ($1, 'delivery', 'buyer', 'assigned', 3.0)
       RETURNING id`,
      [req.id]
    );

    fixture = { buyer, seller, order, requestId: req.id };

    // 1. Attempting to dispatch delivery leg when pickup is still 'assigned' must fail with 409
    await assert.rejects(
      () => LogisticsDashboardService.updateLegStatus({
        partner: { id: partnerId, name: 'Mzigo Ego' },
        partnerId,
        requestId: req.id,
        legType: 'delivery',
        status: 'out_for_delivery'
      }),
      (err) => {
        assert.strictEqual(err.statusCode, 409);
        assert.match(err.message, /Cannot dispatch or deliver package before pickup from seller is completed/i);
        return true;
      }
    );

    // 2. Complete the pickup leg
    await pool.query(`UPDATE logistics_legs SET status = 'picked_up' WHERE id = $1`, [pickupLeg.id]);

    // 3. Now dispatching the delivery leg succeeds
    const result = await LogisticsDashboardService.updateLegStatus({
      partner: { id: partnerId, name: 'Mzigo Ego' },
      partnerId,
      requestId: req.id,
      legType: 'delivery',
      status: 'out_for_delivery'
    });

    assert.strictEqual(result.updated, true);
    assert.strictEqual(result.status, 'out_for_delivery');
  });

  test('validates verificationCode against package_code during handover', async (t) => {
    let fixture;
    t.after(() => cleanupTrack7Fixtures(fixture || {}));

    const buyer = await createBuyer({});
    const seller = await createSeller({});
    const order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1800,
      sellerPayoutAmount: 1780,
      platformFeeAmount: 20
    });
    await pool.query("UPDATE product_orders SET status = 'FULFILLING' WHERE id = $1", [order.id]);

    const expectedCode = `BYB-LOG-${order.id}`;
    const { rows: [req] } = await pool.query(
      `INSERT INTO logistics_requests (order_id, partner_id, package_code, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id`,
      [order.id, partnerId, expectedCode]
    );

    const { rows: [pickupLeg] } = await pool.query(
      `INSERT INTO logistics_legs (logistics_request_id, leg_type, payer, status, distance_km)
       VALUES ($1, 'pickup', 'seller', 'assigned', 1.5)
       RETURNING id`,
      [req.id]
    );

    fixture = { buyer, seller, order, requestId: req.id };

    // 1. Invalid verification code throws 400
    await assert.rejects(
      () => LogisticsDashboardService.updateLegStatus({
        partner: { id: partnerId, name: 'Mzigo Ego' },
        partnerId,
        requestId: req.id,
        legType: 'pickup',
        status: 'picked_up',
        verificationCode: 'WRONG-CODE-999'
      }),
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /Invalid verification code for package handover/i);
        return true;
      }
    );

    // 2. Correct verification code succeeds
    const successResult = await LogisticsDashboardService.updateLegStatus({
      partner: { id: partnerId, name: 'Mzigo Ego' },
      partnerId,
      requestId: req.id,
      legType: 'pickup',
      status: 'picked_up',
      verificationCode: expectedCode
    });

    assert.strictEqual(successResult.updated, true);
    assert.strictEqual(successResult.status, 'picked_up');
  });
});

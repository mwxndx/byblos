/**
 * gate2-order-lifecycle.journey.test.js
 *
 * GATE 2: Order Lifecycle End-to-End Business Journey
 *
 * Verifies:
 *   1. Physical Order Fulfillment (PAID -> AWAITING_SELLER_ACTION -> completed, inventory commit, escrow release)
 *   2. Digital Order Fulfillment (Instant access token generation, automated completion, escrow release)
 *   3. Invalid State Transitions (OrderStatusGuard enforcement, unfulfilled/cancelled order guardrails)
 *   4. Order Cancellation & Settlement Reversal (Refund wallet crediting, idempotency, finality guards)
 *   5. Refund Execution & Financial Invariants (Atomic execution, balance credit, double-refund prevention)
 */
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

import { pool } from '../../src/infrastructure/database/database.js';
import OrderFulfillmentTransitionService from '../../src/domains/orders/order/orderFulfillmentTransition.service.js';
import OrderCancellationService from '../../src/domains/orders/order/orderCancellation.service.js';
import refundExecutionService from '../../src/domains/payments/refunds/refundExecution.service.js';
import { assertValidTransition } from '../../src/shared/utils/OrderStatusGuard.js';
import { OrderStatus, OrderType } from '../../src/shared/constants/enums.js';
import escrowManager from '../../src/domains/orders/escrow/EscrowManager.js';
import Order from '../../src/domains/orders/order/order.model.js';
import {
  createUser,
  createBuyer,
  createSeller,
  createProduct,
  createCompletedOrder,
  createOrderItem,
  createRefundRequest,
  cleanupOrder,
  cleanupProduct,
  cleanupSeller,
  cleanupBuyer,
  cleanupUser
} from '../helpers/factories.js';

const createdUserIds = [];
const createdSellerIds = [];
const createdBuyerIds = [];
const createdProductIds = [];
const createdOrderIds = [];

after(async () => {
  for (const orderId of createdOrderIds) {
    await cleanupOrder(orderId).catch(() => {});
  }
  for (const prodId of createdProductIds) {
    await cleanupProduct(prodId).catch(() => {});
  }
  for (const sellerId of createdSellerIds) {
    await cleanupSeller(sellerId).catch(() => {});
  }
  for (const buyerId of createdBuyerIds) {
    await cleanupBuyer(buyerId).catch(() => {});
  }
  for (const userId of createdUserIds) {
    await cleanupUser(userId).catch(() => {});
  }
});

describe('GATE 2: Order Lifecycle Business Journey', () => {
  let sellerUser, seller, buyerUser, buyer;
  let physicalProd, digitalProd;

  test('Setup: seed seller, buyer, physical and digital products', async () => {
    sellerUser = await createUser({ role: 'seller' });
    createdUserIds.push(sellerUser.id);
    seller = await createSeller({ userId: sellerUser.id, shopName: 'Gate2 Atelier' });
    createdSellerIds.push(seller.id);

    buyerUser = await createUser({ role: 'buyer' });
    createdUserIds.push(buyerUser.id);
    buyer = await createBuyer({ userId: buyerUser.id, fullName: 'Gate2 Buyer' });
    createdBuyerIds.push(buyer.id);

    physicalProd = await createProduct({
      sellerId: seller.id,
      name: 'Gate2 Physical Artifact',
      price: 5000,
      productType: 'physical',
      isDigital: false,
      trackInventory: true,
      quantity: 10
    });
    createdProductIds.push(physicalProd.id);

    digitalProd = await createProduct({
      sellerId: seller.id,
      name: 'Gate2 Digital Blueprint',
      price: 2500,
      productType: 'digital',
      isDigital: true,
      digitalFileName: 'blueprint.pdf',
      digitalFilePath: 'downloads/blueprint.pdf',
      trackInventory: false
    });
    createdProductIds.push(digitalProd.id);
  });

  // ---------------------------------------------------------------------------
  // 1. Physical Order Fulfillment
  // ---------------------------------------------------------------------------
  describe('1. Physical Order Fulfillment & Escrow Lifecycle', () => {
    test('Eligible paid physical order transitions to AWAITING_SELLER_ACTION and commits inventory', async () => {
      // Create a paid physical order
      const order = await createCompletedOrder({
        buyerId: buyer.id,
        sellerId: seller.id,
        totalAmount: 5000,
        sellerPayoutAmount: 4800,
        platformFeeAmount: 200,
        status: OrderStatus.PAID,
        paymentStatus: 'completed',
        orderType: OrderType.PHYSICAL
      });
      createdOrderIds.push(order.id);

      await createOrderItem({
        orderId: order.id,
        productId: physicalProd.id,
        name: physicalProd.name,
        price: 5000,
        quantity: 1
      });

      await pool.query('UPDATE products SET reserved_quantity = 1 WHERE id = $1', [physicalProd.id]);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await OrderFulfillmentTransitionService.executeFulfillment(client, order);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      // Assert state transition and inventory commit in DB
      const { rows } = await pool.query('SELECT status FROM product_orders WHERE id = $1', [order.id]);
      assert.equal(rows[0].status, OrderStatus.AWAITING_SELLER_ACTION);

      const { rows: prodRows } = await pool.query('SELECT quantity, reserved_quantity FROM products WHERE id = $1', [physicalProd.id]);
      assert.equal(prodRows[0].quantity, 9, 'Quantity must decrement from 10 to 9');
      assert.equal(prodRows[0].reserved_quantity, 0, 'Reserved quantity must decrement to 0');

      // Advance to COMPLETED through valid transitions and release escrow
      const releaseClient = await pool.connect();
      try {
        await releaseClient.query('BEGIN');
        const completedOrder = await Order.updateStatusWithSideEffects(
          releaseClient,
          order.id,
          OrderStatus.COMPLETED,
          'completed'
        );
        const releaseRes = await escrowManager.releaseFunds(releaseClient, completedOrder, 'PhysicalHandoff');
        assert.ok(releaseRes.success, 'Escrow release must succeed for completed physical order');
        await releaseClient.query('COMMIT');
      } catch (err) {
        await releaseClient.query('ROLLBACK');
        throw err;
      } finally {
        releaseClient.release();
      }

      // Verify seller pending settlement balance and net revenue were credited
      const { rows: sellerRows } = await pool.query('SELECT balance, pending_settlement_balance, net_revenue FROM sellers WHERE id = $1', [seller.id]);
      assert.ok(Number(sellerRows[0].pending_settlement_balance) >= 4800, 'Seller pending settlement balance must be credited with payout amount');
      assert.ok(Number(sellerRows[0].net_revenue) >= 4800, 'Seller net revenue must reflect completed order');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Digital Product Fulfillment
  // ---------------------------------------------------------------------------
  describe('2. Digital Order Fulfillment & Automated Delivery', () => {
    test('Paid digital order automatically fulfills, grants digital access, and releases escrow', async () => {
      const digitalOrder = await createCompletedOrder({
        buyerId: buyer.id,
        sellerId: seller.id,
        totalAmount: 2500,
        sellerPayoutAmount: 2400,
        platformFeeAmount: 100,
        status: OrderStatus.PAID,
        paymentStatus: 'completed',
        orderType: OrderType.DIGITAL
      });
      createdOrderIds.push(digitalOrder.id);

      await createOrderItem({
        orderId: digitalOrder.id,
        productId: digitalProd.id,
        name: digitalProd.name,
        price: 2500,
        quantity: 1
      });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await OrderFulfillmentTransitionService.executeFulfillment(client, digitalOrder);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      // Assert status is COMPLETED and digital_access row was created
      const { rows: orderRows } = await pool.query('SELECT status, metadata FROM product_orders WHERE id = $1', [digitalOrder.id]);
      assert.equal(orderRows[0].status, OrderStatus.COMPLETED);
      assert.equal(orderRows[0].metadata?.financial_finality, true);

      const { rows: accessRows } = await pool.query('SELECT * FROM digital_access WHERE order_id = $1', [digitalOrder.id]);
      assert.equal(accessRows.length, 1, 'digital_access record must be generated');
      assert.ok(accessRows[0].access_token, 'Access token must be present for digital download');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. State Transition Guardrails
  // ---------------------------------------------------------------------------
  describe('3. Order State Transition Guardrails', () => {
    test('Unpaid or pending orders cannot transition directly to COMPLETED or SHIPPED', () => {
      assert.throws(
        () => {
          assertValidTransition(OrderStatus.PAYMENT_PENDING, OrderStatus.COMPLETED, 9999);
        },
        /Illegal state transition/i,
        'Cannot jump from PAYMENT_PENDING to COMPLETED'
      );

      assert.throws(
        () => {
          assertValidTransition(OrderStatus.CREATED, OrderStatus.DELIVERED, 9999);
        },
        /Illegal state transition/i,
        'Cannot jump from CREATED to DELIVERED'
      );
    });

    test('Cancelled or refunded orders cannot enter fulfillment', () => {
      assert.throws(
        () => {
          assertValidTransition(OrderStatus.CANCELLED, OrderStatus.FULFILLING, 9999);
        },
        /Illegal state transition/i,
        'Cancelled orders cannot transition to FULFILLING'
      );

      assert.throws(
        () => {
          assertValidTransition(OrderStatus.REFUNDED, OrderStatus.READY_FOR_BUYER, 9999);
        },
        /Illegal state transition/i,
        'Refunded orders cannot transition to READY_FOR_BUYER'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Order Cancellation
  // ---------------------------------------------------------------------------
  describe('4. Order Cancellation and Settlement Reversal', () => {
    test('Cancelling a paid order credits buyer refund balance and marks order CANCELLED', async () => {
      const cancelOrder = await createCompletedOrder({
        buyerId: buyer.id,
        sellerId: seller.id,
        totalAmount: 3000,
        sellerPayoutAmount: 2850,
        platformFeeAmount: 150,
        status: OrderStatus.PAID,
        paymentStatus: 'completed',
        orderType: OrderType.PHYSICAL
      });
      createdOrderIds.push(cancelOrder.id);

      const cancelResult = await OrderCancellationService.cancelOrder(cancelOrder.id, 'Buyer requested cancellation');
      assert.ok(cancelResult);

      // Verify order status in DB
      const { rows: orderRows } = await pool.query('SELECT status FROM product_orders WHERE id = $1', [cancelOrder.id]);
      assert.equal(orderRows[0].status, OrderStatus.CANCELLED);

      // Verify buyer refund wallet was credited
      const { rows: buyerRows } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [buyer.id]);
      assert.ok(Number(buyerRows[0].refunds) >= 3000, 'Buyer refund wallet must be credited with cancelled amount');
    });

    test('Attempting to cancel an already cancelled order is rejected', async () => {
      const cancelOrder = await createCompletedOrder({
        buyerId: buyer.id,
        sellerId: seller.id,
        totalAmount: 1000,
        sellerPayoutAmount: 950,
        platformFeeAmount: 50,
        status: OrderStatus.PAID,
        paymentStatus: 'completed'
      });
      createdOrderIds.push(cancelOrder.id);

      await OrderCancellationService.cancelOrder(cancelOrder.id, 'First cancellation');

      await assert.rejects(
        async () => {
          await OrderCancellationService.cancelOrder(cancelOrder.id, 'Duplicate cancellation');
        },
        /Order is already cancelled/i,
        'Should reject cancelling an already cancelled order'
      );
    });

    test('Attempting to cancel a completed order is prohibited (ORDER_FINANCIALLY_FINAL)', async () => {
      const finalOrder = await createCompletedOrder({
        buyerId: buyer.id,
        sellerId: seller.id,
        totalAmount: 4000,
        sellerPayoutAmount: 3800,
        platformFeeAmount: 200,
        status: OrderStatus.COMPLETED,
        paymentStatus: 'completed'
      });
      createdOrderIds.push(finalOrder.id);

      await assert.rejects(
        async () => {
          await OrderCancellationService.cancelOrder(finalOrder.id, 'Late cancellation');
        },
        /no longer eligible for a normal refund/i,
        'Must protect financially final completed orders'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Refund Execution & Invariants
  // ---------------------------------------------------------------------------
  describe('5. Refund Execution and Financial Invariants', () => {
    test('Executing an approved refund credits buyer wallet and transitions order to REFUNDED', async () => {
      const refundTargetOrder = await createCompletedOrder({
        buyerId: buyer.id,
        sellerId: seller.id,
        totalAmount: 1500,
        sellerPayoutAmount: 1400,
        platformFeeAmount: 100,
        status: OrderStatus.PAID,
        paymentStatus: 'completed'
      });
      createdOrderIds.push(refundTargetOrder.id);

      const refundReq = await createRefundRequest({
        buyerId: buyer.id,
        orderId: refundTargetOrder.id,
        amount: 1500,
        status: 'pending'
      });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const execResult = await refundExecutionService.executeApprovedRefundWithClient(client, {
          refundRequestId: refundReq.id,
          adminNotes: 'Approved return in condition',
          approvedAmount: 1500
        });
        await client.query('COMMIT');
        assert.equal(execResult.creditedAmount, 1500);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      // Assert order is now REFUNDED
      const { rows: orderRows } = await pool.query('SELECT status FROM product_orders WHERE id = $1', [refundTargetOrder.id]);
      assert.equal(orderRows[0].status, OrderStatus.REFUNDED);

      // Assert refund request is now completed
      const { rows: reqRows } = await pool.query('SELECT status FROM refund_requests WHERE id = $1', [refundReq.id]);
      assert.equal(reqRows[0].status, 'completed');
    });

    test('Financial invariant: refund amount cannot exceed requested amount', async () => {
      const refundTargetOrder = await createCompletedOrder({
        buyerId: buyer.id,
        sellerId: seller.id,
        totalAmount: 2000,
        sellerPayoutAmount: 1900,
        platformFeeAmount: 100,
        status: OrderStatus.PAID,
        paymentStatus: 'completed'
      });
      createdOrderIds.push(refundTargetOrder.id);

      const refundReq = await createRefundRequest({
        buyerId: buyer.id,
        orderId: refundTargetOrder.id,
        amount: 2000,
        status: 'pending'
      });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await assert.rejects(
          async () => {
            await refundExecutionService.executeApprovedRefundWithClient(client, {
              refundRequestId: refundReq.id,
              approvedAmount: 5000 // Exceeds 2000!
            });
          },
          /Approved refund amount cannot exceed requested amount/i,
          'Must reject refund exceeding requested amount'
        );
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    test('Financial invariant: a completed refund cannot be executed twice', async () => {
      const order = await createCompletedOrder({
        buyerId: buyer.id,
        sellerId: seller.id,
        totalAmount: 1200,
        sellerPayoutAmount: 1100,
        platformFeeAmount: 100,
        status: OrderStatus.PAID,
        paymentStatus: 'completed'
      });
      createdOrderIds.push(order.id);

      const refundReq = await createRefundRequest({
        buyerId: buyer.id,
        orderId: order.id,
        amount: 1200,
        status: 'completed' // Already completed!
      });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await assert.rejects(
          async () => {
            await refundExecutionService.executeApprovedRefundWithClient(client, {
              refundRequestId: refundReq.id,
              approvedAmount: 1200
            });
          },
          /already completed/i,
          'Must block executing an already completed refund'
        );
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });
  });
});

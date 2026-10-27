import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import FulfillmentQueueService from '../src/domains/orders/fulfillment/fulfillmentQueue.service.js';
import ReconciliationEngine from '../src/application/cron/reconciliationEngine.js';
import OrderCancellationService from '../src/domains/orders/order/orderCancellation.service.js';
import {
  createBuyer,
  createSeller,
  createProduct,
  createOrderItem,
  createCompletedOrder,
  createPayment,
  cleanupOrder,
  cleanupProduct,
  cleanupSeller,
  cleanupBuyer
} from './helpers/factories.js';

describe('DIST-03: Fulfillment Reliability & Dead-Letter Job Recovery (Integration)', () => {

  test('1. Permanently failed fulfillment jobs transition order to MANUAL_REVIEW and log system issue', async (t) => {
    let buyer, seller, product, order;
    t.after(async () => {
      if (order) {
        await pool.query('DELETE FROM system_issues WHERE order_id = $1', [order.id]).catch(() => {});
        await pool.query('DELETE FROM fulfillment_jobs WHERE order_id = $1', [order.id]).catch(() => {});
        await cleanupOrder(order.id).catch(() => {});
      }
      if (product) await cleanupProduct(product.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    seller = await createSeller({});
    product = await createProduct({
      sellerId: seller.id,
      productType: 'physical',
      isDigital: false,
      price: 1500
    });

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1500,
      sellerPayoutAmount: 1400,
      status: 'PAID',
      paymentStatus: 'completed'
    });
    await createOrderItem({ orderId: order.id, productId: product.id, price: 1500 });
    await createPayment({ orderId: order.id, amount: 1500, status: 'completed' });

    // Enqueue job and simulate 5 failed attempts reaching max_attempts
    const job = await FulfillmentQueueService.enqueue(null, order.id);
    assert.ok(job, 'Job should be enqueued');

    // Simulate exhausting max attempts
    await pool.query(
      `UPDATE fulfillment_jobs
       SET attempts = max_attempts,
           status = 'FAILED',
           error_message = 'Simulated fatal warehouse fulfillment error'
       WHERE id = $1`,
      [job.id]
    );

    // Run reconciliation to ensure dead-letter handler catches it
    const deadLetterCount = await ReconciliationEngine.handleDeadLetterFulfillmentJobs();
    assert.ok(deadLetterCount >= 1, 'Reconciliation should identify at least 1 dead-letter job');

    // Verify order transitioned to MANUAL_REVIEW
    const { rows: [updatedOrder] } = await pool.query(
      'SELECT status FROM product_orders WHERE id = $1',
      [order.id]
    );
    assert.equal(updatedOrder.status, 'MANUAL_REVIEW', 'Order must be moved to MANUAL_REVIEW when fulfillment permanently fails');

    // Verify system issue recorded
    const { rows: issues } = await pool.query(
      `SELECT * FROM system_issues WHERE order_id = $1 AND issue_type = 'FULFILLMENT_FAILURE' AND resolved = FALSE`,
      [order.id]
    );
    assert.ok(issues.length > 0, 'A system_issue record must exist for the dead-letter fulfillment failure');
    assert.equal(issues[0].severity, 'HIGH');
  });

  test('2. Operator getDeadLetterJobs retrieves pending dead-letter jobs with complete details', async (t) => {
    let buyer, seller, product, order;
    t.after(async () => {
      if (order) {
        await pool.query('DELETE FROM system_issues WHERE order_id = $1', [order.id]).catch(() => {});
        await pool.query('DELETE FROM fulfillment_jobs WHERE order_id = $1', [order.id]).catch(() => {});
        await cleanupOrder(order.id).catch(() => {});
      }
      if (product) await cleanupProduct(product.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    seller = await createSeller({});
    product = await createProduct({
      sellerId: seller.id,
      productType: 'physical',
      isDigital: false,
      price: 2000
    });

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 2000,
      sellerPayoutAmount: 1900,
      status: 'MANUAL_REVIEW',
      paymentStatus: 'completed'
    });
    await createOrderItem({ orderId: order.id, productId: product.id, price: 2000 });

    const job = await FulfillmentQueueService.enqueue(null, order.id);
    await pool.query(
      `UPDATE fulfillment_jobs
       SET attempts = max_attempts,
           status = 'FAILED',
           error_message = 'Out of stock at supplier warehouse'
       WHERE id = $1`,
      [job.id]
    );

    const deadLetters = await FulfillmentQueueService.getDeadLetterJobs({ limit: 10 });
    assert.ok(deadLetters.length > 0, 'getDeadLetterJobs must return dead-letter jobs');
    const matched = deadLetters.find(d => d.order_id === order.id);
    assert.ok(matched, 'The dead-letter job must match the created order');
    assert.equal(matched.job_status, 'FAILED');
    assert.equal(matched.order_status, 'MANUAL_REVIEW');
    assert.equal(matched.error_message, 'Out of stock at supplier warehouse');
  });

  test('3. Operator retryFailedJob resets job to PENDING and returns order to PAID', async (t) => {
    let buyer, seller, product, order;
    t.after(async () => {
      if (order) {
        await pool.query('DELETE FROM system_issues WHERE order_id = $1', [order.id]).catch(() => {});
        await pool.query('DELETE FROM fulfillment_jobs WHERE order_id = $1', [order.id]).catch(() => {});
        await cleanupOrder(order.id).catch(() => {});
      }
      if (product) await cleanupProduct(product.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    seller = await createSeller({});
    product = await createProduct({
      sellerId: seller.id,
      productType: 'digital',
      isDigital: true,
      digitalFilePath: 'test/file.pdf',
      digitalFileName: 'file.pdf',
      price: 800
    });

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 800,
      sellerPayoutAmount: 750,
      status: 'MANUAL_REVIEW',
      paymentStatus: 'completed'
    });
    await createOrderItem({ orderId: order.id, productId: product.id, price: 800 });

    const job = await FulfillmentQueueService.enqueue(null, order.id);
    await pool.query(
      `UPDATE fulfillment_jobs
       SET attempts = max_attempts,
           status = 'FAILED',
           error_message = 'Transient network timeout'
       WHERE id = $1`,
      [job.id]
    );
    await pool.query(
      `INSERT INTO system_issues (order_id, issue_type, severity, resolved, details)
       VALUES ($1, 'FULFILLMENT_FAILURE', 'HIGH', FALSE, '{"error":"Transient network timeout"}'::jsonb)`,
      [order.id]
    );

    // Operator executes retry
    const retriedJob = await FulfillmentQueueService.retryFailedJob(job.id, { operatorId: 'test-admin' });
    assert.equal(retriedJob.status, 'PENDING');
    assert.equal(retriedJob.attempts, 0);
    assert.equal(retriedJob.error_message, null);

    // Verify order is returned to PAID
    const { rows: [updatedOrder] } = await pool.query(
      'SELECT status FROM product_orders WHERE id = $1',
      [order.id]
    );
    assert.equal(updatedOrder.status, 'PAID', 'Order must be moved back to PAID so worker can process it');

    // Verify system issue resolved
    const { rows: issues } = await pool.query(
      'SELECT resolved FROM system_issues WHERE order_id = $1',
      [order.id]
    );
    assert.equal(issues[0].resolved, true, 'System issue must be marked resolved upon retry');

    // Verify worker processes the retried job to completion
    await FulfillmentQueueService.processJobs(1);

    const { rows: [completedJob] } = await pool.query(
      'SELECT status FROM fulfillment_jobs WHERE id = $1',
      [job.id]
    );
    assert.equal(completedJob.status, 'COMPLETED', 'Worker must process retried job to COMPLETED');
  });

  test('4. Operator cancelAndRefundDeadLetter cancels order, credits buyer refund, and completes job', async (t) => {
    let buyer, seller, product, order;
    t.after(async () => {
      if (order) {
        await pool.query('DELETE FROM refund_requests WHERE order_id = $1', [order.id]).catch(() => {});
        await pool.query('DELETE FROM system_issues WHERE order_id = $1', [order.id]).catch(() => {});
        await pool.query('DELETE FROM fulfillment_jobs WHERE order_id = $1', [order.id]).catch(() => {});
        await cleanupOrder(order.id).catch(() => {});
      }
      if (product) await cleanupProduct(product.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({ refunds: 0 });
    seller = await createSeller({});
    product = await createProduct({
      sellerId: seller.id,
      productType: 'physical',
      isDigital: false,
      price: 3500
    });

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 3500,
      sellerPayoutAmount: 3300,
      status: 'MANUAL_REVIEW',
      paymentStatus: 'completed'
    });
    await createOrderItem({ orderId: order.id, productId: product.id, price: 3500 });
    await createPayment({ orderId: order.id, amount: 3500, status: 'completed' });

    const job = await FulfillmentQueueService.enqueue(null, order.id);
    await pool.query(
      `UPDATE fulfillment_jobs
       SET attempts = max_attempts,
           status = 'FAILED',
           error_message = 'Item permanently unavailable from merchant'
       WHERE id = $1`,
      [job.id]
    );

    // Operator executes cancellation & refund
    const cancelResult = await FulfillmentQueueService.cancelAndRefundDeadLetter(order.id, {
      reason: 'Item permanently unavailable — operator refund',
      operatorId: 'admin-99'
    });

    assert.ok(cancelResult, 'Cancellation result returned');

    // Verify order is CANCELLED
    const { rows: [cancelledOrder] } = await pool.query(
      'SELECT status FROM product_orders WHERE id = $1',
      [order.id]
    );
    assert.equal(cancelledOrder.status, 'CANCELLED');

    // Verify buyer wallet received full refund credit
    const { rows: [updatedBuyer] } = await pool.query(
      'SELECT refunds FROM buyers WHERE id = $1',
      [buyer.id]
    );
    assert.equal(Number(updatedBuyer.refunds), 3500, 'Buyer wallet must receive 3500 KES refund credit');

    // Verify refund_requests record created with completed status
    const { rows: refunds } = await pool.query(
      'SELECT amount, status FROM refund_requests WHERE order_id = $1',
      [order.id]
    );
    assert.equal(refunds.length, 1);
    assert.equal(Number(refunds[0].amount), 3500);
    assert.equal(refunds[0].status, 'completed');

    // Verify fulfillment_jobs status is updated to CANCELLED
    const { rows: [updatedJob] } = await pool.query(
      'SELECT status FROM fulfillment_jobs WHERE id = $1',
      [job.id]
    );
    assert.equal(updatedJob.status, 'CANCELLED');
  });
});

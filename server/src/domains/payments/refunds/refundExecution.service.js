import { pool } from '../../../infrastructure/database/database.js';
import * as refundRequestRepository from '../../orders/repositories/refundRequest.repository.js';
import settlementService from '../../orders/escrow/settlement.service.js';
import eventBus, { AppEvents } from '../../../application/events/eventBus.js';
import { AppError } from '../../../shared/utils/errorHandler.js';
import logger from '../../../shared/utils/logger.js';

class RefundExecutionService {
  /**
   * Executes a refund atomically within an active database client/transaction.
   *
   * Invariants enforced:
   * 1. Locks the refund_requests row FOR UPDATE
   * 2. Validates amount and transition eligibility (pending/manual_review)
   * 3. Credits the buyer's refund wallet balance (buyers.refunds)
   * 4. Updates refund_requests status to 'completed' with audit metadata
   * 5. If linked to an order, transitions product_orders to REFUNDED, cancelled
   * 6. Reverses seller escrow settlement (reverseOrderSettlementForRefund)
   * 7. Claws back creator commission / affiliate earnings (reverseCreatorEarningsForRefund)
   *
   * @param {import('pg').PoolClient} client
   * @param {object} params
   * @param {number|string} params.refundRequestId
   * @param {string} [params.adminNotes]
   * @param {number|null} [params.processedBy]
   * @param {string} [params.executionSource='manual_admin_refund']
   * @param {boolean} [params.autoApproved=false]
   * @param {object} [params.auditMeta={}]
   * @returns {Promise<{refundRequestId: number|string, creditedAmount: number, buyerId: number, orderId: number|null}>}
   */
  async executeApprovedRefundWithClient(client, {
    refundRequestId,
    adminNotes,
    approvedAmount = null,
    processedBy = null,
    executionSource = 'manual_admin_refund',
    autoApproved = false,
    auditMeta = {}
  }) {
    const lockedRequest = await refundRequestRepository.findByIdForUpdate(refundRequestId, client);
    if (!lockedRequest) {
      throw new AppError('Refund request not found', 404);
    }

    if (lockedRequest.status !== 'pending' && lockedRequest.status !== 'manual_review') {
      throw new AppError(`Refund request is already ${lockedRequest.status}`, 400);
    }

    const requestedAmount = Number.parseFloat(lockedRequest.amount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new AppError('Invalid refund amount', 400);
    }

    let effectiveRefundAmount = requestedAmount;
    if (approvedAmount !== null && approvedAmount !== undefined) {
      const parsedApproved = Number.parseFloat(approvedAmount);
      if (!Number.isFinite(parsedApproved) || parsedApproved <= 0) {
        throw new AppError('Invalid approved refund amount', 400);
      }
      if (parsedApproved > requestedAmount) {
        throw new AppError('Approved refund amount cannot exceed requested amount', 400);
      }
      effectiveRefundAmount = Math.round(parsedApproved * 100) / 100;
    }

    const completedNotes = adminNotes || (autoApproved ? 'Auto-approved by refund policy' : 'Refund authorized by admin');

    // 1. Credit buyer's refund balance
    await client.query(
      `UPDATE buyers
       SET refunds = COALESCE(refunds, 0) + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [effectiveRefundAmount, lockedRequest.buyer_id]
    );

    // 2. Mark refund request as completed and record credit details
    const creditDetails = {
      credited_to_buyer: true,
      credited_amount: effectiveRefundAmount,
      requested_amount: requestedAmount,
      is_partial_approval: effectiveRefundAmount < requestedAmount,
      credited_at: new Date().toISOString(),
      credited_by_admin: processedBy,
      auto_approved: autoApproved,
      execution_source: executionSource,
      ...auditMeta
    };

    await client.query(
      `UPDATE refund_requests
       SET status = 'completed',
           admin_notes = $1,
           processed_by = $2,
           payment_details = COALESCE(payment_details, '{}'::jsonb) || $3::jsonb,
           processed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4`,
      [completedNotes, processedBy, JSON.stringify(creditDetails), refundRequestId]
    );

    // 3. Update order status and reverse seller settlement & creator earnings if associated with an order
    let isOrderPartial = false;
    if (lockedRequest.order_id) {
      const { rows: orderRows } = await client.query(
        `SELECT id, total_amount, status, payment_status, metadata
         FROM product_orders
         WHERE id = $1
         FOR UPDATE`,
        [lockedRequest.order_id]
      );

      if (orderRows.length > 0) {
        const order = orderRows[0];
        const orderTotal = Number.parseFloat(order.total_amount || 0);
        let orderMeta = typeof order.metadata === 'string'
          ? (() => { try { return JSON.parse(order.metadata); } catch { return {}; } })()
          : (order.metadata || {});

        const priorRefunded = Number.parseFloat(orderMeta?.refund_summary?.total_refunded || 0);
        const remainingBalance = Math.max(0, Math.round((orderTotal - priorRefunded) * 100) / 100);

        if (effectiveRefundAmount > remainingBalance) {
          throw new AppError(
            `Refund amount (${effectiveRefundAmount}) exceeds remaining order balance (${remainingBalance})`,
            400
          );
        }

        const newTotalRefunded = Math.round((priorRefunded + effectiveRefundAmount) * 100) / 100;
        const isOrderFullyRefunded = newTotalRefunded >= orderTotal;
        isOrderPartial = !isOrderFullyRefunded;

        const refundItem = {
          refund_request_id: refundRequestId,
          amount: effectiveRefundAmount,
          admin_id: processedBy,
          admin_notes: completedNotes,
          auto_approved: autoApproved,
          execution_source: executionSource,
          completed_at: new Date().toISOString()
        };

        const priorHistory = Array.isArray(orderMeta?.refund_summary?.history)
          ? orderMeta.refund_summary.history
          : [];

        const refundSummary = {
          total_refunded: newTotalRefunded,
          refund_status: isOrderFullyRefunded ? 'FULLY_REFUNDED' : 'PARTIALLY_REFUNDED',
          history: [...priorHistory, refundItem],
          updated_at: new Date().toISOString()
        };

        const updatedOrderMeta = {
          ...orderMeta,
          refund_summary: refundSummary,
          refund_completed: isOrderFullyRefunded ? refundItem : (orderMeta.refund_completed || refundItem)
        };

        if (isOrderFullyRefunded) {
          try {
            await client.query(
              `UPDATE product_orders
               SET status = 'REFUNDED'::order_status,
                   payment_status = 'cancelled'::payment_status,
                   metadata = $2::jsonb,
                   updated_at = NOW()
               WHERE id = $1`,
              [lockedRequest.order_id, JSON.stringify(updatedOrderMeta)]
            );
          } catch (orderErr) {
            logger.warn(
              `[REFUND] Order ${lockedRequest.order_id} full status update failed, retrying minimal update:`,
              orderErr.message
            );
            await client.query(
              `UPDATE product_orders
               SET status = 'REFUNDED'::order_status,
                   updated_at = NOW()
               WHERE id = $1`,
              [lockedRequest.order_id]
            );
          }
        } else {
          // Partial refund: Preserve active operational status (COMPLETED, DELIVERED, etc.)
          await client.query(
            `UPDATE product_orders
             SET metadata = $2::jsonb,
                 updated_at = NOW()
             WHERE id = $1`,
            [lockedRequest.order_id, JSON.stringify(updatedOrderMeta)]
          );
        }

        await settlementService.reverseOrderSettlementForRefund(
          client,
          lockedRequest.order_id,
          executionSource,
          effectiveRefundAmount,
          orderTotal
        );
        await settlementService.reverseCreatorEarningsForRefund(
          client,
          lockedRequest.order_id,
          executionSource,
          effectiveRefundAmount,
          orderTotal
        );
      }
    }

    return {
      refundRequestId,
      creditedAmount: effectiveRefundAmount,
      buyerId: lockedRequest.buyer_id,
      orderId: lockedRequest.order_id || null,
      isPartial: isOrderPartial,
      completedNotes
    };
  }

  /**
   * Directly creates and executes an auto-approved refund within an active client transaction.
   * Used for clear-cut automated refund paths such as late payments on cancelled orders.
   *
   * @param {import('pg').PoolClient} client
   * @param {object} params
   * @param {number|string} params.buyerId
   * @param {number|string} params.orderId
   * @param {number|string} params.amount
   * @param {string} [params.paymentMethod='mpesa']
   * @param {object} [params.paymentDetails={}]
   * @param {string} params.reason
   * @param {string} [params.source='auto_policy_engine']
   * @returns {Promise<object>} Inserted and completed refund record
   */
  async createAndExecuteAutoRefundWithClient(client, {
    buyerId,
    orderId,
    amount,
    paymentMethod = 'mpesa',
    paymentDetails = {},
    reason,
    source = 'auto_policy_engine'
  }) {
    const numAmount = Number.parseFloat(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      throw new AppError('Invalid auto-refund amount', 400);
    }

    const initialDetails = {
      ...paymentDetails,
      auto_approved: true,
      approval_reason: reason,
      execution_source: source
    };

    const insertSql = `
      INSERT INTO refund_requests (
        buyer_id, order_id, amount, status, notes, admin_notes, payment_method, payment_details
      ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7::jsonb)
      RETURNING id
    `;
    const { rows: insertedRows } = await client.query(insertSql, [
      buyerId,
      orderId,
      numAmount,
      reason,
      `Auto-approved by policy: ${reason}`,
      paymentMethod,
      JSON.stringify(initialDetails)
    ]);

    const refundRequestId = insertedRows[0].id;

    const result = await this.executeApprovedRefundWithClient(client, {
      refundRequestId,
      adminNotes: `Auto-approved by policy: ${reason}`,
      processedBy: null,
      executionSource: source,
      autoApproved: true,
      auditMeta: {
        policy_auto_approved: true,
        auto_approved_reason: reason
      }
    });

    return {
      ...result,
      id: refundRequestId
    };
  }

  /**
   * Processes manual admin refund confirmation end-to-end with transaction and event dispatch.
   *
   * @param {object} params
   * @param {number|string} params.id
   * @param {string} [params.adminNotes]
   * @param {number|null} [params.adminId]
   * @returns {Promise<{requestId: number|string, creditedAmount: number}>}
   */
  async processAdminRefundApproval({ id, adminNotes, approvedAmount, adminId }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await this.executeApprovedRefundWithClient(client, {
        refundRequestId: id,
        adminNotes,
        approvedAmount,
        processedBy: typeof adminId === 'number' ? adminId : null,
        executionSource: 'manual_admin_refund',
        autoApproved: false
      });

      await client.query('COMMIT');

      logger.info(
        `Refund request ${id} approved/completed by admin ${adminId} (credited ${result.creditedAmount} to buyer ${result.buyerId}, partial=${result.isPartial})`
      );

      // Post-commit event notification
      const requestWithBuyer = await refundRequestRepository.findByIdWithBuyer(id);
      await this.dispatchRefundCompletedEvent({
        refundRequestId: id,
        buyerId: result.buyerId,
        amount: result.creditedAmount,
        adminNotes: result.completedNotes,
        buyerName: requestWithBuyer?.buyer_name || null,
        buyerPhone: requestWithBuyer?.buyer_phone || null
      });

      return {
        requestId: id,
        creditedAmount: result.creditedAmount,
        isPartial: result.isPartial
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Dispatches the REFUND.COMPLETED event asynchronously.
   *
   * @param {object} params
   */
  async dispatchRefundCompletedEvent({
    refundRequestId,
    buyerId,
    amount,
    adminNotes,
    buyerName,
    buyerPhone
  }) {
    await eventBus.enqueueAndDispatch(
      AppEvents.REFUND.COMPLETED,
      {
        eventId: `refund.completed:${refundRequestId}`,
        refund: {
          id: refundRequestId,
          buyer_id: buyerId,
          amount,
          status: 'completed',
          adminNotes
        },
        buyer: {
          id: buyerId,
          full_name: buyerName,
          whatsapp_number: buyerPhone
        }
      },
      'RefundExecutionService'
    ).catch((err) =>
      logger.warn(`[REFUND] Failed to dispatch REFUND.COMPLETED for ${refundRequestId}:`, err?.message)
    );
  }
}

export default new RefundExecutionService();

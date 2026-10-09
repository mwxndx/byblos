import * as refundRequestRepository from '../../orders/repositories/refundRequest.repository.js';
import { AppError } from '../../../shared/utils/errorHandler.js';
import logger from '../../../shared/utils/logger.js';
import eventBus, { AppEvents } from '../../../application/events/eventBus.js';
import refundExecutionService from './refundExecution.service.js';

/**
 * Get all refund requests (Admin only)
 */
export const getAllRefundRequests = async (req, res, next) => {
  try {
    const { status, overdue, sortBy = 'urgency', page = 1, limit = 20 } = req.query;
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const offset = (parsedPage - 1) * parsedLimit;
    const overdueOnly = overdue === 'true' || overdue === true;

    const [requests, total] = await Promise.all([
      refundRequestRepository.findAllWithBuyer({ status, overdueOnly, sortBy, limit: parsedLimit, offset }),
      refundRequestRepository.countAll({ status, overdueOnly })
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        requests,
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          pages: Math.ceil(total / parsedLimit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching refund requests:', error);
    next(error);
  }
};

/**
 * Get refund request by ID (Admin only)
 */
export const getRefundRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await refundRequestRepository.findByIdWithBuyer(id);

    if (!request) {
      return next(new AppError('Refund request not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { request }
    });
  } catch (error) {
    logger.error('Error fetching refund request:', error);
    next(error);
  }
};

/**
 * Confirm/Complete refund request (Admin only)
 */
export const confirmRefundRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminNotes, approvedAmount } = req.body;
    const adminId = req.user.id;

    const result = await refundExecutionService.processAdminRefundApproval({
      id,
      adminNotes,
      approvedAmount,
      adminId
    });

    res.status(200).json({
      status: 'success',
      message: result.isPartial
        ? 'Partial refund confirmed and credited to buyer refund balance'
        : 'Refund request confirmed and credited to buyer refund balance',
      data: {
        requestId: result.requestId,
        creditedAmount: result.creditedAmount,
        isPartial: result.isPartial
      }
    });
  } catch (error) {
    logger.error('Error confirming refund request:', error);
    next(error);
  }
};

/**
 * Reject refund request (Admin only)
 */
export const rejectRefundRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.id;

    logger.info(`Admin ${adminId} rejecting refund request ${id}`);

    const header = await refundRequestRepository.findHeaderById(id);

    if (!header) {
      return next(new AppError('Refund request not found', 404));
    }

    const { status: currentStatus, buyer_id, amount, full_name, whatsapp_number } = header;

    if (currentStatus !== 'pending' && currentStatus !== 'manual_review') {
      return next(new AppError(`Refund request is already ${currentStatus}`, 400));
    }

    const processedBy = typeof adminId === 'number' ? adminId : null;

    await refundRequestRepository.markRejected({
      id,
      adminNotes: adminNotes || 'Refund request rejected',
      processedBy
    });

    logger.info(`Refund request ${id} rejected`);

    await eventBus.enqueueAndDispatch(AppEvents.REFUND.REJECTED, {
      eventId: `refund.rejected:${id}`,
      refund: {
        id,
        buyer_id,
        amount,
        status: 'rejected',
        adminNotes
      },
      buyer: {
        id: buyer_id,
        full_name,
        whatsapp_number
      }
    }, 'RefundController.rejectRefundRequest').catch((err) => logger.warn(`[REFUND] Failed to dispatch REFUND.REJECTED for ${id}:`, err?.message));

    res.status(200).json({
      status: 'success',
      message: 'Refund request rejected',
      data: {
        requestId: id
      }
    });
  } catch (error) {
    logger.error('Error rejecting refund request:', error);
    next(error);
  }
};

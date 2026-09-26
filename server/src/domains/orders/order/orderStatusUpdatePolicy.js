import { AppError } from '../../../shared/utils/errorHandler.js';
import { OrderStatus } from '../../../shared/constants/enums.js';

/**
 * Money-terminal / finality states that must be reached only through their
 * dedicated handlers, never the generic PATCH /orders/:id/status endpoint:
 *   - COMPLETED       -> buyer confirmation (_buyerComplete), which releases escrow
 *   - CANCELLED       -> OrderCancellationService, which refunds + reverses settlement
 *   - REFUND_PENDING  -> the refund flow
 *   - REFUNDED        -> the refund flow
 * The generic endpoint performs none of that accounting, so setting COMPLETED
 * here would mark the order terminal without releasing escrow — stranding the
 * seller's funds — and setting CANCELLED would cancel without refunding.
 */
const RESTRICTED_STATUSES = new Set([
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUND_PENDING,
  OrderStatus.REFUNDED,
]);

/**
 * Authorize a generic order status update. The generic status endpoint is a
 * seller/admin operational tool; buyers complete via /confirm-receipt and
 * cancel/refund have their own endpoints.
 *
 * @param {{ sellerId?: string, buyerId?: string, role?: string, userType?: string }} user  the authenticated actor (req.user)
 * @param {{ seller_id?: string }} order  the current order row (snake_case DB shape)
 * @param {string} targetStatus  the requested next status
 * @throws {AppError} 403 if the caller is neither an admin nor the owning seller; 400 if targetStatus is a restricted money-terminal state
 */
export function assertOrderStatusUpdateAuthorized(user, order, targetStatus) {
  const role = user?.role || user?.userType;
  const isAdmin = role === 'admin';
  const isOwningSeller = Boolean(user?.sellerId) && order?.seller_id === user.sellerId;

  if (!isAdmin && !isOwningSeller) {
    throw new AppError(
      'Unauthorized: you do not have permission to update this order',
      403,
      'ORDER_UPDATE_FORBIDDEN'
    );
  }

  if (RESTRICTED_STATUSES.has(targetStatus)) {
    throw new AppError(
      `Status "${targetStatus}" cannot be set through this endpoint; use the dedicated order action.`,
      400,
      'ORDER_STATUS_NOT_ALLOWED'
    );
  }
}

export { RESTRICTED_STATUSES };

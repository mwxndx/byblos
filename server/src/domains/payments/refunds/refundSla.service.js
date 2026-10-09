import logger from '../../../shared/utils/logger.js';

export const REFUND_SLA_CONSTANTS = {
  DEFAULT_TARGET_HOURS: 48,
  WARNING_THRESHOLD_HOURS: 12
};

/**
 * Calculates Service Level Agreement (SLA) metrics for a refund request.
 *
 * @param {object} params
 * @param {string|Date} params.requestedAt
 * @param {string} [params.status='pending']
 * @param {object|string} [params.paymentDetails={}]
 * @returns {object} SLA status metrics
 */
export function calculateSla({ requestedAt, status = 'pending', paymentDetails = {} }) {
  const details = typeof paymentDetails === 'string'
    ? (() => { try { return JSON.parse(paymentDetails); } catch { return {}; } })()
    : (paymentDetails || {});

  const targetHours = Number(details.sla?.target_hours) || REFUND_SLA_CONSTANTS.DEFAULT_TARGET_HOURS;
  const requestedDate = new Date(requestedAt || Date.now());
  const deadlineDate = details.sla?.deadline_at
    ? new Date(details.sla.deadline_at)
    : new Date(requestedDate.getTime() + targetHours * 60 * 60 * 1000);

  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  const isTerminal = status === 'completed' || status === 'rejected';
  const isBreached = diffMs < 0;
  const hoursRemaining = !isBreached ? Math.max(0, Math.round(diffHours * 10) / 10) : 0;
  const hoursOverdue = isBreached ? Math.round(Math.abs(diffHours) * 10) / 10 : 0;

  let slaStatus = 'on_track';
  if (isTerminal) {
    slaStatus = details.sla?.is_breached ? 'breached' : 'met';
  } else if (isBreached) {
    slaStatus = 'breached';
  } else if (diffHours <= REFUND_SLA_CONSTANTS.WARNING_THRESHOLD_HOURS) {
    slaStatus = 'warning';
  }

  const isEscalated = Boolean(details.sla?.is_breached || (!isTerminal && isBreached));

  return {
    targetHours,
    deadlineAt: deadlineDate.toISOString(),
    hoursRemaining,
    hoursOverdue,
    isBreached,
    slaStatus,
    isEscalated,
    escalatedAt: details.sla?.escalated_at || null,
    escalationLevel: details.sla?.escalation_level || (isEscalated ? 1 : 0)
  };
}

/**
 * Enriches a refund request database record with SLA metadata.
 *
 * @param {object} row
 * @returns {object} Enriched row with sla properties
 */
export function enrichRequestWithSla(row) {
  if (!row) return row;

  const slaMetrics = calculateSla({
    requestedAt: row.requested_at,
    status: row.status,
    paymentDetails: row.payment_details
  });

  return {
    ...row,
    sla: slaMetrics,
    sla_deadline: slaMetrics.deadlineAt,
    sla_status: slaMetrics.slaStatus,
    is_sla_breached: slaMetrics.isBreached
  };
}

export default {
  calculateSla,
  enrichRequestWithSla,
  REFUND_SLA_CONSTANTS
};

import { pool } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';
import { sendFcmV1, isFcmConfigured } from '../../../shared/config/fcm.js';
import { sendEmail } from '../../../shared/utils/email.js';

const VALID_CHANNELS = new Set(['in_app', 'push', 'email']);
const VALID_PLATFORMS = new Set(['android', 'ios', 'web']);
const VALID_ROLES = new Set(['buyer', 'seller', 'creator', 'admin', 'logistics']);

function normalizeRole(role) {
    const normalized = String(role || '').toLowerCase().trim();
    if (normalized === 'mzigo' || normalized === 'partner') return 'logistics';
    return normalized;
}

function normalizeChannels(channels = ['in_app']) {
    const list = Array.isArray(channels) ? channels : [channels];
    const normalized = list
        .map(channel => String(channel || '').trim().toLowerCase())
        .filter(channel => VALID_CHANNELS.has(channel));
    return normalized.length > 0 ? [...new Set(normalized)] : ['in_app'];
}

class NotificationService {
    async registerDeviceToken({ userId, role, platform, token, deviceId = null, appVersion = null }) {
        const normalizedRole = normalizeRole(role);
        const normalizedPlatform = String(platform || '').toLowerCase();
        const trimmedToken = String(token || '').trim();

        if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) {
            throw new Error('Valid user id is required');
        }
        if (!VALID_ROLES.has(normalizedRole)) {
            throw new Error('Valid notification role is required');
        }
        if (!VALID_PLATFORMS.has(normalizedPlatform)) {
            throw new Error('Valid notification platform is required');
        }
        if (!trimmedToken) {
            throw new Error('Device token is required');
        }

        const { rows } = await pool.query(
            `INSERT INTO notification_device_tokens
                (user_id, role, platform, token, device_id, app_version, is_active, last_seen_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
             ON CONFLICT (token) DO UPDATE
             SET user_id = EXCLUDED.user_id,
                 role = EXCLUDED.role,
                 platform = EXCLUDED.platform,
                 device_id = EXCLUDED.device_id,
                 app_version = EXCLUDED.app_version,
                 is_active = TRUE,
                 last_seen_at = NOW(),
                 updated_at = NOW()
             RETURNING id, user_id, role, platform, device_id, app_version, is_active, last_seen_at`,
            [
                Number(userId),
                normalizedRole,
                normalizedPlatform,
                trimmedToken,
                deviceId ? String(deviceId).trim() : null,
                appVersion ? String(appVersion).trim() : null
            ]
        );

        return rows[0];
    }

    async unregisterDeviceToken({ userId, token }) {
        const trimmedToken = String(token || '').trim();
        if (!trimmedToken) throw new Error('Device token is required');

        const { rowCount } = await pool.query(
            `UPDATE notification_device_tokens
             SET is_active = FALSE,
                 updated_at = NOW()
             WHERE user_id = $1
               AND token = $2`,
            [Number(userId), trimmedToken]
        );

        return rowCount > 0;
    }

    async createInAppNotification({ recipientUserId, recipientRole, type, title, body, data = {}, channels = ['in_app'] }) {
        const normalizedRole = normalizeRole(recipientRole);
        if (!VALID_ROLES.has(normalizedRole)) throw new Error('Valid recipient role is required');

        const { rows } = await pool.query(
            `INSERT INTO app_notifications
                (recipient_user_id, recipient_role, type, title, body, data, channels)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::text[])
             RETURNING id, recipient_user_id, recipient_role, type, title, body, data, channels, read_at, created_at`,
            [
                Number(recipientUserId),
                normalizedRole,
                String(type || 'general'),
                String(title || '').trim(),
                String(body || '').trim(),
                JSON.stringify(data || {}),
                normalizeChannels(channels)
            ]
        );

        return rows[0];
    }

    async send(notification) {
        const channels = normalizeChannels(notification.channels);
        const results = {};

        if (channels.includes('in_app')) {
            results.in_app = await this.createInAppNotification({
                ...notification,
                channels
            });
        }

        if (channels.includes('push')) {
            results.push = await this.sendPush(notification).catch(error => {
                logger.error('[NotificationService] Push delivery failed', {
                    recipientUserId: notification.recipientUserId,
                    type: notification.type,
                    error: error.message
                });
                return { delivered: false, error: error.message };
            });
        }

        if (channels.includes('email')) {
            const toEmail = notification.recipientEmail || notification.email;
            if (toEmail) {
                results.email = await sendEmail({
                    to: toEmail,
                    subject: notification.title,
                    html: notification.emailHtml || `<p>${notification.body}</p>`,
                    text: notification.body
                }).then(res => ({ delivered: true, id: res?.id }))
                  .catch(error => {
                      logger.error('[NotificationService] Unified email dispatch failed', { error: error.message });
                      return { delivered: false, error: error.message };
                  });
            } else {
                results.email = { delivered: false, reason: 'missing_recipient_email' };
            }
        }

        return results;
    }

    async sendPush({ recipientUserId, title, body, data = {} }) {
        const { rows: tokens } = await pool.query(
            `SELECT token, platform
             FROM notification_device_tokens
             WHERE user_id = $1
               AND is_active = TRUE`,
            [Number(recipientUserId)]
        );

        if (tokens.length === 0) {
            return { delivered: false, reason: 'no_active_device_tokens' };
        }

        if (!isFcmConfigured()) {
            logger.info('[NotificationService] Push skipped: FCM service account not configured', {
                recipientUserId,
                tokenCount: tokens.length
            });
            return { delivered: false, reason: 'push_provider_not_configured', tokenCount: tokens.length };
        }

        const stringData = Object.fromEntries(
            Object.entries(data || {}).map(([key, value]) => [key, String(value ?? '')])
        );

        const pushPromises = tokens.map(async (device) => {
            const result = await sendFcmV1({ token: device.token, title, body, data: stringData, platform: device.platform });
            return { device, result };
        });

        const pushResults = await Promise.allSettled(pushPromises);
        const responses = [];
        const invalidTokens = [];

        for (const item of pushResults) {
            if (item.status === 'fulfilled') {
                const { device, result } = item.value;
                responses.push({ ok: result.ok, status: result.status });

                if (!result.ok) {
                    logger.warn('[NotificationService] Push provider returned a non-success response', {
                        recipientUserId,
                        platform: device.platform,
                        status: result.status,
                        error: result.error
                    });
                    if (result.unregistered) {
                        invalidTokens.push(device.token);
                    }
                }
            }
        }

        if (invalidTokens.length > 0) {
            await pool.query(
                `UPDATE notification_device_tokens
                 SET is_active = FALSE,
                     updated_at = NOW()
                 WHERE token = ANY($1::text[])`,
                [invalidTokens]
            ).catch(error => logger.error('[NotificationService] Failed to deactivate invalid device tokens', {
                error: error.message
            }));
        }

        return { delivered: responses.some(item => item.ok), responses };
    }

    async listForUser({ userId, role = null, limit = 50, unreadOnly = false }) {
        const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
        const normalizedRole = role ? normalizeRole(role) : null;
        let query = `
            SELECT id, recipient_role, type, title, body, data, channels, read_at, created_at
            FROM app_notifications
            WHERE recipient_user_id = $1
              AND ($2::boolean = FALSE OR read_at IS NULL)
        `;
        const params = [Number(userId), Boolean(unreadOnly)];
        if (normalizedRole && VALID_ROLES.has(normalizedRole)) {
            params.push(normalizedRole);
            query += ` AND recipient_role = $${params.length}`;
        }
        params.push(safeLimit);
        query += `
            ORDER BY created_at DESC
            LIMIT $${params.length}
        `;

        const { rows } = await pool.query(query, params);
        return rows;
    }

    async markRead({ userId, notificationId }) {
        const { rows } = await pool.query(
            `UPDATE app_notifications
             SET read_at = COALESCE(read_at, NOW())
             WHERE id = $1
               AND recipient_user_id = $2
             RETURNING id, read_at`,
            [Number(notificationId), Number(userId)]
        );
        return rows[0] || null;
    }

    async markAllRead({ userId, role = null }) {
        const normalizedRole = role ? normalizeRole(role) : null;
        let query = `
            UPDATE app_notifications
            SET read_at = COALESCE(read_at, NOW())
            WHERE recipient_user_id = $1
              AND read_at IS NULL
        `;
        const params = [Number(userId)];
        if (normalizedRole && VALID_ROLES.has(normalizedRole)) {
            params.push(normalizedRole);
            query += ` AND recipient_role = $${params.length}`;
        }
        const { rowCount } = await pool.query(query, params);
        return rowCount;
    }

    async getUnreadCount({ userId, role = null }) {
        if (!userId || !Number.isInteger(Number(userId)) || Number(userId) <= 0) {
            return 0;
        }
        const normalizedRole = role ? normalizeRole(role) : null;
        let query = `
            SELECT COUNT(*)::int AS unread_count
            FROM app_notifications
            WHERE recipient_user_id = $1
              AND read_at IS NULL
        `;
        const params = [Number(userId)];
        if (normalizedRole) {
            query += ' AND recipient_role = $2';
            params.push(normalizedRole);
        }
        const { rows } = await pool.query(query, params);
        return rows[0]?.unread_count || 0;
    }

    // One-time re-engagement blast inviting existing buyers to become members.
    // Idempotent: skips buyers who already joined or already got the invite, so
    // it is safe to re-run. Deep-links to the dashboard with ?membership=1 which
    // force-opens the opt-in popup (see MembershipGate).
    // Batched into chunks (default 50) to prevent event loop starvation and request timeouts.
    async broadcastMembershipInvite({ dryRun = false, batchSize = 50 } = {}) {
        const { rows: recipients } = await pool.query(
            `SELECT b.user_id
               FROM buyers b
              WHERE b.user_id IS NOT NULL
                AND b.is_member = FALSE
                AND NOT EXISTS (
                    SELECT 1 FROM app_notifications an
                     WHERE an.recipient_user_id = b.user_id
                       AND an.type = 'membership_invite'
                )
              GROUP BY b.user_id`
        );

        const title = 'You’re invited to become a Byblos member 🛡️';
        const body = 'Claim your founder card and show you shop protected.';
        const data = { path: '/buyer/dashboard?membership=1', type: 'membership_invite' };

        if (dryRun) {
            return { eligible: recipients.length, dryRun: true };
        }

        const safeBatchSize = Math.max(1, Math.min(Number.parseInt(batchSize, 10) || 50, 100));
        let sent = 0;
        let pushed = 0;
        let failed = 0;

        for (let i = 0; i < recipients.length; i += safeBatchSize) {
            const batch = recipients.slice(i, i + safeBatchSize);
            const settled = await Promise.allSettled(
                batch.map(recipient =>
                    this.send({
                        recipientUserId: recipient.user_id,
                        recipientRole: 'buyer',
                        type: 'membership_invite',
                        title,
                        body,
                        data,
                        channels: ['in_app', 'push'],
                    }).catch(error => {
                        logger.error('[NotificationService] Membership invite failed', {
                            userId: recipient.user_id,
                            error: error.message,
                        });
                        throw error;
                    })
                )
            );

            for (const item of settled) {
                if (item.status === 'fulfilled') {
                    sent += 1;
                    if (item.value?.push?.delivered) pushed += 1;
                } else {
                    failed += 1;
                }
            }
        }

        return { eligible: recipients.length, sent, pushed, failed };
    }

    /**
     * Resolves an internal user_id from an entity profile (buyer, seller, or creator).
     * Additive, best-effort; returns null on missing profile or query error.
     */
    async resolveEntityUserId(entityType, entityId) {
        if (!entityId) return null;
        const normalizedType = String(entityType || '').toLowerCase().trim();
        const numericId = Number(entityId);
        if (!Number.isInteger(numericId) || numericId <= 0) return null;

        const tableMap = {
            buyer: 'buyers',
            seller: 'sellers',
            creator: 'creators'
        };

        const targetTable = tableMap[normalizedType];
        if (!targetTable) return null;

        try {
            const { rows } = await pool.query(
                `SELECT user_id FROM ${targetTable} WHERE id = $1 LIMIT 1`,
                [numericId]
            );
            return rows[0]?.user_id || null;
        } catch (error) {
            logger.warn(`[NotificationService] ${normalizedType} userId lookup failed`, { entityId, error: error.message });
            return null;
        }
    }

    /**
     * Delivers an in-app and push notification to an entity profile by resolving its user_id.
     * Best-effort; safely resolves without throwing so asynchronous workflows aren't blocked.
     */
    async sendToEntity({ entityType, entityId, role = null, notification }) {
        try {
            const userId = await this.resolveEntityUserId(entityType, entityId);
            if (!userId) return null;

            const recipientRole = role || entityType;
            return await this.send({
                recipientUserId: userId,
                recipientRole,
                type: notification.type,
                title: notification.title,
                body: notification.body,
                data: notification.data || {},
                channels: notification.channels || ['in_app', 'push']
            });
        } catch (error) {
            logger.warn(`[NotificationService] sendToEntity failed for ${entityType}:${entityId}`, {
                type: notification?.type,
                error: error.message
            });
            return null;
        }
    }
}


export default new NotificationService();

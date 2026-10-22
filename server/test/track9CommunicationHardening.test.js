import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import NotificationService from '../src/domains/communication/notifications/notification.service.js';
import { cleanOrphanedTempFiles } from '../src/application/cron/cleanupCron.js';
import RecipientDelivery from '../src/application/events/recipientDelivery.js';
import * as notificationController from '../src/domains/communication/notifications/notification.controller.js';

const { pool } = await import('../src/infrastructure/database/database.js');
const { createUser } = await import('./helpers/factories.js');

describe('Track 9 Hardening: Communications, Messaging & Background Daemons', () => {
    let testUser;
    let testTempDir;

    before(async () => {
        testUser = await createUser({ role: 'buyer' });
        testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'byblos-cleanuptest-'));
    });

    after(async () => {
        if (testUser?.id) {
            await pool.query('DELETE FROM app_notifications WHERE recipient_user_id = $1', [testUser.id]);
            await pool.query('DELETE FROM notification_device_tokens WHERE user_id = $1', [testUser.id]);
            await pool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
        }
        if (testTempDir && fs.existsSync(testTempDir)) {
            fs.rmSync(testTempDir, { recursive: true, force: true });
        }
    });

    test('1. NotificationService.send safely isolates in-app failures without throwing', async () => {
        const originalCreateInApp = NotificationService.createInAppNotification;
        try {
            // Mock createInAppNotification to simulate a database query rejection
            NotificationService.createInAppNotification = async () => {
                throw new Error('Database connection pool exhausted');
            };

            const result = await NotificationService.send({
                recipientUserId: testUser.id,
                recipientRole: 'buyer',
                channels: ['in_app'],
                title: 'Test Notification',
                body: 'Testing failure isolation'
            });

            assert.ok(result);
            assert.equal(result.in_app.delivered, false);
            assert.equal(result.in_app.error, 'Database connection pool exhausted');
        } finally {
            NotificationService.createInAppNotification = originalCreateInApp;
        }
    });

    test('2. NotificationService.sendPush safely records rejected promises in Promise.allSettled', async () => {
        // Register a device token so sendPush attempts dispatch
        await NotificationService.registerDeviceToken({
            userId: testUser.id,
            role: 'buyer',
            platform: 'android',
            token: 'test-push-token-rejected-handling'
        });

        const originalPoolQuery = pool.query.bind(pool);
        // We will test sendPush directly
        const pushResult = await NotificationService.sendPush({
            recipientUserId: testUser.id,
            title: 'Push Alert',
            body: 'Testing rejected item capture'
        });

        // Even if FCM is not configured in test environment, it handles gracefully
        assert.ok(pushResult);
        assert.equal(pushResult.delivered, false);
        assert.ok(['push_provider_not_configured', 'no_active_device_tokens'].includes(pushResult.reason) || Array.isArray(pushResult.responses));
    });

    test('3. cleanOrphanedTempFiles deletes files older than threshold and preserves fresh files', async () => {
        const oldFilePath = path.join(testTempDir, 'temp_orphan_old.tmp');
        const newFilePath = path.join(testTempDir, 'temp_active_new.tmp');

        fs.writeFileSync(oldFilePath, 'stale temporary payload');
        fs.writeFileSync(newFilePath, 'fresh active upload payload');

        // Set old file's mtime to 2 hours ago (7,200,000 ms ago)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        fs.utimesSync(oldFilePath, twoHoursAgo, twoHoursAgo);

        // Run cleanup with 1 hour threshold (3,600,000 ms)
        const cleanupResult = await cleanOrphanedTempFiles(60 * 60 * 1000, [testTempDir]);

        assert.equal(cleanupResult.deletedFiles, 1, 'Only the stale temp file was deleted');
        assert.ok(cleanupResult.freedBytes > 0, 'Bytes freed was recorded');
        assert.equal(fs.existsSync(oldFilePath), false, 'Stale file is unlinked from disk');
        assert.equal(fs.existsSync(newFilePath), true, 'Fresh active file is preserved');
    });

    test('4. RecipientDelivery default channel is modernized to feed', async () => {
        let capturedChannel = null;
        const originalDeliver = RecipientDelivery.deliverRecipient;

        // Verify default channel in deliverRecipient implementation
        const testEventId = `test:event:${Date.now()}`;
        const testKey = `user:${testUser.id}:notification`;

        const result = await RecipientDelivery.deliverRecipient(
            testEventId,
            testKey,
            async () => ({ ok: true })
            // Note: options omitted so default channel is applied
        );

        assert.ok(result.delivered);

        // Verify inserted delivery in DB used 'feed' channel
        const { rows } = await pool.query(
            `SELECT channel FROM event_recipient_deliveries WHERE event_id = $1 AND recipient_key = $2`,
            [testEventId, testKey]
        );
        assert.equal(rows.length, 1);
        assert.equal(rows[0].channel, 'feed', 'Default channel in recipient deliveries must be feed');

        // Cleanup test delivery record
        await pool.query('DELETE FROM event_recipient_deliveries WHERE event_id = $1', [testEventId]);
    });

    test('5. notificationController handlers catch errors and delegate to next(err)', async () => {
        const originalList = NotificationService.listForUser;
        const originalMarkRead = NotificationService.markRead;
        const originalMarkAll = NotificationService.markAllRead;
        const originalGetCount = NotificationService.getUnreadCount;

        try {
            const simulatedErr = new Error('Simulated internal controller error');
            NotificationService.listForUser = async () => { throw simulatedErr; };
            NotificationService.markRead = async () => { throw simulatedErr; };
            NotificationService.markAllRead = async () => { throw simulatedErr; };
            NotificationService.getUnreadCount = async () => { throw simulatedErr; };

            const req = { user: { userId: testUser.id, role: 'buyer' }, query: {}, body: {}, params: {} };

            // 1. listNotifications
            let passedErr1 = null;
            await notificationController.listNotifications(req, {}, (err) => { passedErr1 = err; });
            assert.equal(passedErr1, simulatedErr);

            // 2. markNotificationRead
            let passedErr2 = null;
            req.params.notificationId = 123;
            await notificationController.markNotificationRead(req, {}, (err) => { passedErr2 = err; });
            assert.equal(passedErr2, simulatedErr);

            // 3. markAllNotificationsRead
            let passedErr3 = null;
            await notificationController.markAllNotificationsRead(req, {}, (err) => { passedErr3 = err; });
            assert.equal(passedErr3, simulatedErr);

            // 4. getUnreadNotificationCount
            let passedErr4 = null;
            await notificationController.getUnreadNotificationCount(req, {}, (err) => { passedErr4 = err; });
            assert.equal(passedErr4, simulatedErr);
        } finally {
            NotificationService.listForUser = originalList;
            NotificationService.markRead = originalMarkRead;
            NotificationService.markAllRead = originalMarkAll;
            NotificationService.getUnreadCount = originalGetCount;
        }
    });
});

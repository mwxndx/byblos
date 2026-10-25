#!/usr/bin/env node
/**
 * Byblos Android App Update Notification Broadcaster
 *
 * Usage:
 *   node server/scripts/broadcast-app-update.js
 *   node server/scripts/broadcast-app-update.js 67 "🚀 Update Byblos" "Tap to get the latest features on Google Play."
 */

import 'dotenv/config';
import NotificationService from '../src/domains/communication/notifications/notification.service.js';
import logger from '../src/shared/utils/logger.js';
import { pool } from '../src/infrastructure/database/database.js';

async function main() {
    const minVersionCode = parseInt(process.argv[2] || process.env.MIN_ANDROID_VERSION_CODE || '72', 10);
    const title = process.argv[3] || '🚀 New Byblos Update Available';
    const body = process.argv[4] || "We've released important updates. Tap to download the latest version from Google Play.";

    console.log(`[Broadcast] Targeting Android devices running versionCode < ${minVersionCode}...`);

    try {
        const result = await NotificationService.broadcastAppUpdate({
            minVersionCode,
            title,
            body,
            storeUrl: process.env.ANDROID_STORE_URL || 'market://details?id=space.bybloshq.app'
        });

        console.log('[Broadcast] Result:', result);
    } catch (err) {
        console.error('[Broadcast] Failed to send update broadcast:', err);
        process.exitCode = 1;
    } finally {
        await pool.end().catch(() => {});
    }
}

main();

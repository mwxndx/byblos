/**
 * appVersion.js
 *
 * Centralized, authoritative resolver for Byblos app version policies.
 *
 * Resolution precedence:
 * 1. Runtime admin broadcasts (dynamically applied via Admin Broadcast Modal without container restarts)
 * 2. Explicit environment overrides (MIN_ANDROID_VERSION_CODE, LATEST_ANDROID_VERSION_CODE, LATEST_ANDROID_VERSION_NAME)
 * 3. Local build artifacts (version.json in project or server root)
 * 4. Android Gradle build specification (android/app/build.gradle) when running on host / monorepo
 * 5. Built-in system defaults (78 / 1.0.78)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory policy override store (updated by Admin Broadcast or build updates)
let runtimePolicyOverride = null;

/**
 * Attempt to read build version from a version.json manifest file if present
 */
function readVersionJson() {
  const possiblePaths = [
    path.resolve(process.cwd(), 'version.json'),
    path.resolve(process.cwd(), 'server/version.json'),
    path.resolve(__dirname, '../../../version.json'),
    path.resolve(__dirname, '../../../../version.json')
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.versionCode || parsed.versionName) {
          return {
            versionCode: parsed.versionCode ? Number.parseInt(parsed.versionCode, 10) : null,
            versionName: parsed.versionName ? String(parsed.versionName) : null
          };
        }
      }
    } catch {
      // Continue to next path
    }
  }
  return null;
}

/**
 * Attempt to extract versionCode and versionName from android/app/build.gradle if on disk
 */
function readGradleBuildVersion() {
  const possiblePaths = [
    path.resolve(process.cwd(), 'android/app/build.gradle'),
    path.resolve(process.cwd(), '../android/app/build.gradle'),
    path.resolve(__dirname, '../../../../android/app/build.gradle')
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        const codeMatch = content.match(/versionCode\s+(\d+)/);
        const nameMatch = content.match(/versionName\s+['"]([^'"]+)['"]/);
        if (codeMatch || nameMatch) {
          return {
            versionCode: codeMatch ? Number.parseInt(codeMatch[1], 10) : null,
            versionName: nameMatch ? String(nameMatch[1]) : null
          };
        }
      }
    } catch {
      // Fall through
    }
  }
  return null;
}

/**
 * Get current authoritative app version policy
 */
export function getAppVersionPolicy() {
  // 1. Check runtime override (e.g. from an active Admin broadcast)
  const runtimeMin = runtimePolicyOverride?.minAndroidVersionCode ?? null;
  const runtimeLatestCode = runtimePolicyOverride?.latestAndroidVersionCode ?? null;
  const runtimeLatestName = runtimePolicyOverride?.latestVersionName ?? null;

  // 2. Environment variables
  const envMin = process.env.MIN_ANDROID_VERSION_CODE
    ? Number.parseInt(process.env.MIN_ANDROID_VERSION_CODE, 10)
    : null;
  const envLatestCode = process.env.LATEST_ANDROID_VERSION_CODE
    ? Number.parseInt(process.env.LATEST_ANDROID_VERSION_CODE, 10)
    : null;
  const envLatestName = process.env.LATEST_ANDROID_VERSION_NAME || null;

  // 3. File-based build artifact detection (version.json or build.gradle)
  const fileVersion = readVersionJson() || readGradleBuildVersion();

  // Baseline fallbacks
  const defaultCode = 79;
  const defaultName = '1.0.79';

  const latestAndroidVersionCode =
    runtimeLatestCode ?? envLatestCode ?? fileVersion?.versionCode ?? defaultCode;

  const latestVersionName =
    runtimeLatestName ?? envLatestName ?? fileVersion?.versionName ?? (latestAndroidVersionCode ? `1.0.${latestAndroidVersionCode}` : defaultName);

  const minAndroidVersionCode =
    runtimeMin ?? envMin ?? latestAndroidVersionCode ?? defaultCode;

  const forceUpdate = process.env.FORCE_ANDROID_UPDATE !== 'false';
  const storeUrl = runtimePolicyOverride?.storeUrl || process.env.ANDROID_STORE_URL || 'market://details?id=space.bybloshq.app';
  const webStoreUrl = 'https://play.google.com/store/apps/details?id=space.bybloshq.app';

  return {
    platform: 'android',
    minAndroidVersionCode,
    latestAndroidVersionCode,
    latestVersionName,
    forceUpdate,
    storeUrl,
    webStoreUrl,
    releaseNotes: [
      'Refined public seller shop page layout with a sleek, centered header and theme-consistent typography.',
      'Enhanced product and avatar image loading reliability with resilient multi-format URL resolution.',
      'Streamlined shopping bag preview and checkout responsiveness across all screen sizes and connection profiles.'
    ]
  };
}

/**
 * Update the app version policy dynamically (called when admin broadcasts an update)
 */
export function updateAppVersionPolicy({
  minVersionCode,
  latestVersionCode,
  latestVersionName,
  storeUrl
} = {}) {
  const current = getAppVersionPolicy();
  const newMin = minVersionCode ? Number.parseInt(minVersionCode, 10) : current.minAndroidVersionCode;
  const newLatestCode = latestVersionCode ? Number.parseInt(latestVersionCode, 10) : Math.max(newMin, current.latestAndroidVersionCode);
  const newLatestName = latestVersionName ? String(latestVersionName) : `1.0.${newLatestCode}`;

  runtimePolicyOverride = {
    minAndroidVersionCode: newMin,
    latestAndroidVersionCode: newLatestCode,
    latestVersionName: newLatestName,
    storeUrl: storeUrl || current.storeUrl
  };

  logger.info('[AppVersionPolicy] Runtime policy updated successfully', runtimePolicyOverride);
  return getAppVersionPolicy();
}

/**
 * Reset runtime overrides (primarily for test isolation)
 */
export function resetAppVersionPolicy() {
  runtimePolicyOverride = null;
}

export default {
  getAppVersionPolicy,
  updateAppVersionPolicy,
  resetAppVersionPolicy
};


import { useEffect } from 'react';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { isNativeApp } from './mobileApp';
import { appNavigate } from './navigationService';

/**
 * Extracts and validates an in-app route from an incoming deep link URL.
 * Handles:
 * - Standard web URLs: https://www.byblosafrica.site/verify-email?token=...
 * - Base domain URLs: https://byblosafrica.site/verify-email?token=...
 * - Custom scheme URLs: byblos://verify-email?token=... or space.bybloshq.app://...
 *
 * Security:
 * - Rejects non-HTTP / non-custom scheme protocols (e.g. javascript:)
 * - Rejects protocol-relative redirects (//evil.com)
 * - Ensures destination path begins with a single '/'
 */
export function extractDeepLinkPath(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  try {
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;

    let parsed: URL;

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      parsed = new URL(trimmed);
    } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
      // Custom scheme like byblos://path or space.bybloshq.app://path
      // Strip scheme prefix and parse as pathname + search
      const withoutScheme = trimmed.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
      const pathWithLeadingSlash = withoutScheme.startsWith('/') ? withoutScheme : `/${withoutScheme}`;
      parsed = new URL(`https://deep-link.local${pathWithLeadingSlash}`);
    } else {
      return null;
    }

    const targetPath = parsed.pathname + parsed.search + parsed.hash;

    // Must be a valid relative path starting with a single '/'
    if (!targetPath.startsWith('/') || targetPath.startsWith('//')) {
      return null;
    }

    return targetPath;
  } catch {
    return null;
  }
}

/**
 * Validates whether the extracted target path is a known safe navigable path.
 */
export function isAllowedDeepLinkPath(path: string): boolean {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return false;

  const allowedPrefixes = [
    '/verify-email',
    '/track',
    '/reset-password',
    '/buyer/reset-password',
    '/seller/reset-password',
    '/creator/reset-password',
    '/creator/register',
    '/shop',
    '/buyer',
    '/seller',
    '/creator',
    '/admin',
    '/legal',
    '/privacy',
    '/terms'
  ];

  return allowedPrefixes.some(
    prefix => path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?')
  );
}

/**
 * Listens for Capacitor appUrlOpen events and handles initial launch URLs on native platforms.
 * Safe to mount in any environment; no-ops if not running in a native Capacitor environment.
 */
export function useNativeDeepLinkHandler(navigate?: (path: string) => void): void {
  useEffect(() => {
    if (!isNativeApp()) return;

    let isSubscribed = true;

    const handleUrl = (rawUrl: string | undefined | null) => {
      if (!rawUrl || !isSubscribed) return;

      const targetPath = extractDeepLinkPath(rawUrl);
      if (targetPath && isAllowedDeepLinkPath(targetPath)) {
        if (navigate) {
          navigate(targetPath);
        } else {
          appNavigate(targetPath);
        }
      }
    };

    // 1. Handle cold launch URL if the app was opened while terminated
    App.getLaunchUrl()
      .then((launchUrl) => {
        if (isSubscribed && launchUrl?.url) {
          handleUrl(launchUrl.url);
        }
      })
      .catch((err) => {
        console.warn('[DeepLink] Failed to read launch URL:', err);
      });

    // 2. Listen for URL open events while app is running in background or foreground
    const listenerPromise = App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      handleUrl(event.url);
    });

    return () => {
      isSubscribed = false;
      listenerPromise.then(handle => handle?.remove?.()).catch(() => {});
    };
  }, [navigate]);
}

import { lazy, ComponentType } from 'react';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';

/**
 * Checks if an error is a chunk/module load error across browsers (Chromium, WebKit/Safari, Firefox).
 * WebKit on iOS/macOS reports "TypeError: Load failed" or "Importing a module script failed".
 * Chromium reports "Failed to fetch dynamically imported module".
 */
export function isDynamicImportError(error: unknown): boolean {
    if (!error) return false;
    const err = error as { name?: string; message?: string };
    const msg = typeof err?.message === 'string' ? err.message : String(error);

    return (
        err?.name === 'ChunkLoadError' ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('error loading dynamically imported module') ||
        msg.includes('Unable to preload CSS') ||
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('Load failed') ||
        msg.includes('Failed to load resource') ||
        msg.includes('Loading chunk') ||
        (err?.name === 'TypeError' && (
            msg.includes('fetch') ||
            msg.includes('import') ||
            msg.includes('module') ||
            msg.includes('Load failed')
        ))
    );
}

/**
 * Safe wrapper around sessionStorage that won't throw QuotaExceededError in iOS Safari Private Browsing.
 */
export function getSafeSessionItem(key: string): string | null {
    try {
        return typeof window !== 'undefined' && window.sessionStorage
            ? window.sessionStorage.getItem(key)
            : null;
    } catch {
        return null;
    }
}

export function setSafeSessionItem(key: string, value: string): void {
    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.setItem(key, value);
        }
    } catch {
        // Silently ignore QuotaExceededError / SecurityError in Safari Private Mode
    }
}

export interface SafeLazyOptions {
    retries?: number;
    retryDelayMs?: number;
}

/**
 * A robust version of React.lazy that retries transient chunk/CSS preload failures
 * and falls back to a guarded page reload on web when deployments swap asset hashes.
 *
 * @param importFn The dynamic import function, e.g., () => import('./MyComponent')
 * @param options Optional retry configuration
 * @returns A lazy-loaded component that automatically recovers from chunk errors
 */
export const safeLazy = <T extends ComponentType<unknown>>(
    importFn: () => Promise<{ default: T } | T>,
    options: SafeLazyOptions = {}
) => {
    const maxRetries = options.retries ?? 2;
    const retryDelayMs = options.retryDelayMs ?? 150;

    return lazy(async () => {
        let lastError: unknown;

        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
            try {
                const component = await importFn();

                // Handle both default and non-default exports
                // Some routes use .then(m => ({ default: m.ComponentName })) or .then(m => m.ComponentName)
                if (component && typeof component === 'object' && 'default' in component) {
                    return { default: (component as { default: T }).default };
                }

                return { default: component as T };
            } catch (error: unknown) {
                lastError = error;
                if (!isDynamicImportError(error) || attempt >= maxRetries) {
                    break;
                }
                if (retryDelayMs > 0) {
                    await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
                }
            }
        }

        const isChunkError = isDynamicImportError(lastError);

        if (isChunkError && !isNativeApp()) {
            // Prevent infinite reload loops by checking session storage safely
            const lastReload = getSafeSessionItem('last_chunk_reload');
            const now = Date.now();

            // Only auto-reload if we haven't reloaded in the last 10 seconds
            if (!lastReload || now - Number.parseInt(lastReload, 10) > 10000) {
                setSafeSessionItem('last_chunk_reload', now.toString());
                if (typeof window !== 'undefined' && window.location) {
                    window.location.reload();
                }

                // Return a placeholder promise that never resolves/rejects
                // while the page is reloading to avoid further errors
                return new Promise(() => { }) as Promise<{ default: T }>;
            }
        }

        // If it's not a chunk error or we already reloaded, throw it to be caught by ErrorBoundary
        throw lastError;
    });
};



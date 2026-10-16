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

/**
 * A robust version of React.lazy that handles chunk loading errors by forcing a page reload.
 * This is essential for SPAs during deployments when old entry chunks are removed from the server.
 * 
 * @param importFn The dynamic import function, e.g., () => import('./MyComponent')
 * @returns A lazy-loaded component that automatically recovers from chunk errors
 */
export const safeLazy = <T extends ComponentType<unknown>>(
    importFn: () => Promise<{ default: T } | T>
) => {
    return lazy(async () => {
        try {
            const component = await importFn();

            // Handle both default and non-default exports
            // Some routes use .then(m => ({ default: m.ComponentName })) or .then(m => m.ComponentName)
            if (component && typeof component === 'object' && 'default' in component) {
                return { default: (component as { default: T }).default };
            }

            return { default: component as T };

        } catch (error: unknown) {
            const err = error as { name?: string; message?: string } | undefined;
            console.error('safeLazy caught a chunk loading error:', err?.message || error);

            const isChunkError = isDynamicImportError(error);

            if (isChunkError && !isNativeApp()) {
                // Prevent infinite reload loops by checking session storage safely
                const lastReload = getSafeSessionItem('last_chunk_reload');
                const now = Date.now();

                // Only auto-reload if we haven't reloaded in the last 10 seconds
                if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
                    setSafeSessionItem('last_chunk_reload', now.toString());
                    console.warn('[safeLazy] Chunk loading failed. Refreshing web page...');
                    if (typeof window !== 'undefined' && window.location) {
                        window.location.reload();
                    }

                    // Return a placeholder promise that never resolves/rejects 
                    // while the page is reloading to avoid further errors
                    return new Promise(() => { }) as Promise<{ default: T }>;
                } else {
                    console.error('[safeLazy] Chunk loading failed repeatedly. Not reloading again to avoid loop.');
                }
            }

            // If it's not a chunk error or we already reloaded, throw it to be caught by ErrorBoundary
            throw error;
        }
    });
};



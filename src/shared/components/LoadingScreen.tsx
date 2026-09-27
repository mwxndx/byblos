import React from 'react';

export interface LoadingScreenProps {
    message?: string;
}

/**
 * Full-screen loading state shown during:
 * - Initial cold-start auth revalidation
 * - Lazy route loading
 *
 * Always rendered in dark mode to match the app's dark homescreen,
 * preventing a white flash before the theme is applied.
 */
export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
    return (
        <div
            // Announce app boot / lazy-route loading to assistive tech -- this
            // is the primary full-screen loader, otherwise silent to screen
            // readers on every cold start and route transition. WCAG 4.1.3.
            role="status"
            aria-live="polite"
            className="flex min-h-[100dvh] w-full items-center justify-center bg-[var(--byblos-bg,#000000)] transition-colors duration-200"
            style={{
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
        >
            <span className="sr-only">{message}</span>
            {/* Single minimal pulse — the one loading animation used app-wide. No
                pill chrome so the boot surface is just the themed background plus a
                small mark, which keeps the first paint light and flash-free. */}
            <span aria-hidden="true" className="h-2.5 w-2.5 animate-pulse motion-reduce:animate-none rounded-full bg-yellow-400" />
        </div>
    );
}

export default LoadingScreen;

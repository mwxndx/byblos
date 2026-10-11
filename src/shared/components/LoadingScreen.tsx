import React from 'react';

export interface LoadingScreenProps {
    message?: string;
}

/**
 * Full-screen loading state shown during:
 * - Initial cold-start auth revalidation
 * - Lazy route loading
 *
 * Theme-aware: renders a white or black screen with the Byblos logo centered,
 * matching the user's active app theme without any white/black flash or jarring dots.
 */
export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
    return (
        <div
            // Announce app boot / lazy-route loading to assistive tech -- this
            // is the primary full-screen loader, otherwise silent to screen
            // readers on every cold start and route transition. WCAG 4.1.3.
            role="status"
            aria-live="polite"
            className="fixed inset-0 z-50 flex h-full w-full items-center justify-center bg-white dark:bg-[#000000] transition-colors duration-200"
            style={{
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
        >
            <span className="sr-only">{message}</span>
            <div className="flex flex-col items-center justify-center p-6">
                <img
                    src="/byblos-mark-dark.png"
                    alt="Byblos"
                    className="hidden dark:block h-auto w-[min(65vw,240px)] max-w-[240px] object-contain select-none"
                />
                <img
                    src="/byblos-mark-light.png"
                    alt="Byblos"
                    className="block dark:hidden h-auto w-[min(65vw,240px)] max-w-[240px] object-contain select-none"
                />
            </div>
        </div>
    );
}

export default LoadingScreen;

import { useContext } from 'react';
import { Button } from '@/shared/ui/button';
import { Link } from 'react-router-dom';
import { isNativeApp, getDevicePlatform } from '@/infrastructure/navigation/mobileApp';
import { SEOHead } from '@/shared/components/SEOHead';
import { GlobalAuthContext } from '@/features/auth/contexts/authContextObjects';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=space.bybloshq.app';

export const isPwaStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window.navigator as unknown as { standalone?: boolean })?.standalone ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
  );
};

/**
 * Simplified Byblos landing screen:
 * - Clean solid background adapted for light & dark themes
 * - Responsive safe-area layout adapted for iOS (Dynamic Island/home bar) & Android (status/nav bars)
 * - 144px x 144px centered logo
 * - Vertically stacked buttons of equal length: View Brands, Add Brand, Creator
 * - Yellow buttons with black text
 * - Spacing between buttons increased by 3 (gap-6)
 */
const LandingHome = () => (
  <div
    className="relative flex min-h-[100dvh] min-h-[100svh] w-full flex-col items-center justify-center bg-[var(--byblos-bg,#000000)] text-[var(--byblos-text,#f5f5f5)] selection:bg-yellow-300 selection:text-black transition-colors duration-200 overflow-x-hidden overflow-y-auto"
    style={{
      paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
      paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
      paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
    }}
  >
    <Link
      to="/mzigo/login"
      className="absolute z-10"
      style={{
        top: 'max(2.5rem, calc(env(safe-area-inset-top, 0px) + 0.85rem))',
        left: 'max(1rem, calc(env(safe-area-inset-left, 0px) + 0.5rem))',
      }}
      aria-label="Mzigo Ego delivery partner login"
    >
      <Button className="flex h-10 w-10 items-center justify-center rounded-full border border-separator bg-fill p-0 hover:bg-fill-2">
        <img src="/mzigo-ego.png" alt="Mzigo Ego" className="h-6 w-6 object-contain" />
      </Button>
    </Link>

    <main className="relative z-10 my-auto flex w-full max-w-xs flex-col items-center text-center">
      {/* Logo scaled by a factor of 6 (24px * 6 = 144px -> h-36 w-36) */}
      <div className="mb-8 flex items-center justify-center">
        <img
          src="/byblos-mark-dark.png"
          alt="Byblos logo"
          className="hidden dark:block h-36 w-36 object-contain"
          width={144}
          height={144}
        />
        <img
          src="/byblos-mark-light.png"
          alt="Byblos logo"
          className="block dark:hidden h-36 w-36 object-contain"
          width={144}
          height={144}
        />
      </div>

      {/* Buttons of identical length with yellow background, black text, gap-6 spacing, and elevated lift effect */}
      <div className="flex w-full flex-col items-center gap-6">
        <Link to="/buyer/dashboard" className="w-full">
          <Button className="w-full h-11 rounded-full bg-brand text-black font-semibold shadow-[0_8px_20px_-4px_rgba(245,197,24,0.38),0_4px_8px_-2px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-4px_rgba(245,197,24,0.5),0_6px_12px_-2px_rgba(0,0,0,0.25)] hover:bg-brand-press active:translate-y-0 active:scale-[0.98] active:shadow-md transition-all duration-200 ease-ios">
            View Brands
          </Button>
        </Link>

        <Link to="/seller/register" className="w-full">
          <Button className="w-full h-11 rounded-full bg-brand text-black font-semibold shadow-[0_8px_20px_-4px_rgba(245,197,24,0.38),0_4px_8px_-2px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-4px_rgba(245,197,24,0.5),0_6px_12px_-2px_rgba(0,0,0,0.25)] hover:bg-brand-press active:translate-y-0 active:scale-[0.98] active:shadow-md transition-all duration-200 ease-ios">
            Add Brand
          </Button>
        </Link>

        <Link to="/creator/login" className="w-full">
          <Button className="w-full h-11 rounded-full bg-brand text-black font-semibold shadow-[0_8px_20px_-4px_rgba(245,197,24,0.38),0_4px_8px_-2px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-4px_rgba(245,197,24,0.5),0_6px_12px_-2px_rgba(0,0,0,0.25)] hover:bg-brand-press active:translate-y-0 active:scale-[0.98] active:shadow-md transition-all duration-200 ease-ios">
            Creator
          </Button>
        </Link>
      </div>

      {/* Play Store download: web only (native already has the app installed),
          and never on iOS — an Android store link is useless there. */}
      {!isNativeApp() && getDevicePlatform() !== 'ios' && (
        <div className="mt-8">
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Get Byblos on Google Play"
            className="inline-block rounded-2xl bg-black p-2"
          >
            <img
              src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
              alt="Get it on Google Play"
              className="h-12 w-auto"
            />
          </a>
        </div>
      )}
    </main>
  </div>
);

const IndexPage = () => {
  const auth = useContext(GlobalAuthContext);
  // When opening on Android native or iOS standalone PWA:
  // If auth is actively restoring a session (isLoading) or user is already known (isAuthenticated),
  // render the seamless dark splash mark rather than flashing the public action buttons.
  const isMobileAppShell = isNativeApp() || isPwaStandalone();
  const isSessionPending = auth ? (auth.isLoading || auth.isAuthenticated) : false;

  if (isMobileAppShell && isSessionPending) {
    return (
      <div
        data-testid="seamless-boot-splash"
        className="flex min-h-[100dvh] min-h-[100svh] w-full items-center justify-center bg-[var(--byblos-bg,#000000)]"
      >
        <img
          src="/byblos-mark-dark.png"
          alt="Byblos"
          className="h-36 w-36 object-contain"
          width={144}
          height={144}
        />
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Byblos | Start and Run Your Business in Nairobi"
        description="The safer way to buy from businesses on social media. Byblos gives Nairobi sellers a trusted shop link, secure checkout, order management, delivery, receipts, refunds, and withdrawals."
        url="https://www.byblosafrica.site/"
        canonical="https://www.byblosafrica.site/"
      />
      <LandingHome />
    </>
  );
};

export default IndexPage;

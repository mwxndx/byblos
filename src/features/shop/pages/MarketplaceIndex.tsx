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
 * Byblos landing screen:
 * - Desktop: Split layout with SVG illustration on the left half and branding + action buttons on the right half
 * - Mobile: Centered branding + action buttons
 * - Logo size increased by 30% (144px * 1.3 = 187px -> h-[187px] w-[187px])
 * - Three white buttons with black text: View Brands, Add Brand, Creator
 * - Spacing between buttons: gap-6
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
      className="absolute z-20"
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

    <div className="relative z-10 my-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center lg:flex-row lg:items-center px-4 sm:px-8">
      {/* Left side on desktop: occupies half the left side, placed in the middle */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-8 lg:p-12">
        <img
          src="/illustration.svg"
          alt="Byblos marketplace illustration"
          className="h-[203px] w-[245px] max-h-[75vh] object-contain select-none pointer-events-none"
          width={245}
          height={203}
        />
      </div>

      {/* Right side on desktop (centered on mobile): Byblos logo and three buttons */}
      <main className="my-auto flex w-full lg:w-1/2 flex-col items-center justify-center text-center p-4 lg:p-8">
        <div className="flex w-full max-w-xs flex-col items-center text-center">
          {/* Logo increased by 30% (144px * 1.30 = 187px) */}
          <div className="mb-8 flex items-center justify-center">
            <img
              src="/byblos-mark-dark.png"
              alt="Byblos logo"
              className="hidden dark:block h-[187px] w-[187px] object-contain"
              width={187}
              height={187}
            />
            <img
              src="/byblos-mark-light.png"
              alt="Byblos logo"
              className="block dark:hidden h-[187px] w-[187px] object-contain"
              width={187}
              height={187}
            />
          </div>

          {/* Three white buttons with black text, gap-6 spacing, and elevated lift effect */}
          <div className="flex w-full flex-col items-center gap-6">
            <Link to="/buyer/dashboard" className="w-full">
              <Button className="w-full h-11 rounded-full bg-white text-black font-semibold shadow-[0_8px_20px_-4px_rgba(255,255,255,0.2),0_4px_8px_-2px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-[0_12px_28px_-4px_rgba(255,255,255,0.3),0_6px_12px_-2px_rgba(0,0,0,0.25)] active:translate-y-0 active:scale-[0.98] active:shadow-md transition-all duration-200 ease-ios">
                View Brands
              </Button>
            </Link>

            <Link to="/seller/register" className="w-full">
              <Button className="w-full h-11 rounded-full bg-white text-black font-semibold shadow-[0_8px_20px_-4px_rgba(255,255,255,0.2),0_4px_8px_-2px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-[0_12px_28px_-4px_rgba(255,255,255,0.3),0_6px_12px_-2px_rgba(0,0,0,0.25)] active:translate-y-0 active:scale-[0.98] active:shadow-md transition-all duration-200 ease-ios">
                Add Brand
              </Button>
            </Link>

            <Link to="/creator/login" className="w-full">
              <Button className="w-full h-11 rounded-full bg-white text-black font-semibold shadow-[0_8px_20px_-4px_rgba(255,255,255,0.2),0_4px_8px_-2px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-[0_12px_28px_-4px_rgba(255,255,255,0.3),0_6px_12px_-2px_rgba(0,0,0,0.25)] active:translate-y-0 active:scale-[0.98] active:shadow-md transition-all duration-200 ease-ios">
                Creator
              </Button>
            </Link>
          </div>

          {/* Play Store download */}
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
        </div>
      </main>
    </div>
  </div>
);

const IndexPage = () => {
  const auth = useContext(GlobalAuthContext);
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
          className="h-[187px] w-[187px] object-contain"
          width={187}
          height={187}
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

import { Button } from '@/shared/ui/button';
import { Link } from 'react-router-dom';
import { isNativeApp, getDevicePlatform } from '@/infrastructure/navigation/mobileApp';
import { SEOHead } from '@/shared/components/SEOHead';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=space.bybloshq.app';

/**
 * Simplified Byblos landing screen:
 * - 144px x 144px centered logo (6x scale from 24px)
 * - Vertically stacked buttons of equal length: Creator, View Brands, Add Brand
 * - Yellow buttons with black text
 * - Spacing between buttons increased by 3 (gap-6)
 * - Concentric architectural rings to activate negative space
 * - Swipe-up action deleted
 */
const LandingHome = () => (
  <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[var(--byblos-bg,#000000)] px-6 py-10 text-[var(--byblos-text,#f5f5f5)] selection:bg-yellow-300 selection:text-black transition-colors duration-200">
    {/* Concentric Architectural Rings behind all buttons and content */}
    <div
      aria-hidden="true"
      data-testid="landing-concentric-rings"
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
    >
      {/* Ring 1 (innermost, warm accent hint) */}
      <div className="absolute h-[280px] w-[280px] rounded-full border border-brand/[0.08]" />
      {/* Ring 2 */}
      <div className="absolute h-[440px] w-[440px] rounded-full border border-white/[0.05]" />
      {/* Ring 3 */}
      <div className="absolute h-[620px] w-[620px] rounded-full border border-white/[0.035]" />
      {/* Ring 4 */}
      <div className="absolute h-[820px] w-[820px] rounded-full border border-white/[0.02]" />
      {/* Ring 5 (outer ambient contour) */}
      <div className="absolute h-[1040px] w-[1040px] rounded-full border border-white/[0.015]" />
      {/* Soft ambient center glow */}
      <div className="absolute h-[340px] w-[340px] rounded-full bg-brand/[0.03] blur-[100px]" />
    </div>

    <Link
      to="/mzigo/login"
      className="absolute left-5 top-[calc(1.25rem+env(safe-area-inset-top,0px))] z-10"
      aria-label="Mzigo Ego delivery partner login"
    >
      <Button className="flex h-10 w-10 items-center justify-center rounded-full border border-separator bg-fill p-0 hover:bg-fill-2">
        <img src="/mzigo-ego.png" alt="Mzigo Ego" className="h-6 w-6 object-contain" />
      </Button>
    </Link>

    <main className="relative z-10 flex w-full max-w-xs flex-col items-center text-center">
      {/* Logo scaled by a factor of 6 (24px * 6 = 144px -> h-36 w-36) above the creator button */}
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

      {/* Buttons of identical length with yellow background, black text, and gap-6 spacing */}
      <div className="flex w-full flex-col items-center gap-6">
        <Link to="/creator/login" className="w-full">
          <Button className="w-full h-11 rounded-full bg-brand text-black font-semibold hover:bg-brand-press active:scale-[0.98] transition-all">
            Creator
          </Button>
        </Link>

        <Link to="/buyer/login" className="w-full">
          <Button className="w-full h-11 rounded-full bg-brand text-black font-semibold hover:bg-brand-press active:scale-[0.98] transition-all">
            View Brands
          </Button>
        </Link>

        <Link to="/seller/register" className="w-full">
          <Button className="w-full h-11 rounded-full bg-brand text-black font-semibold hover:bg-brand-press active:scale-[0.98] transition-all">
            Add Brand
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

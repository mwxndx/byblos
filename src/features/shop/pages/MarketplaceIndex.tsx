import { Button } from '@/shared/ui/button';
import { AddBusinessCard } from '@/features/shop/components/AddBusinessCard';
import { LandingDoodles } from '@/features/shop/components/LandingDoodles';
import { Link } from 'react-router-dom';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import { SEOHead } from '@/shared/components/SEOHead';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=space.bybloshq.app';

/**
 * The single Byblos landing screen, shared by web and the Android app: a centred
 * logo that is itself the buyer entry point, with a contextual "add business"
 * card emerging from the bottom.
 */
const LandingHome = () => (
  <div className="relative flex min-h-[100svh] items-center justify-center bg-[var(--byblos-bg,#000000)] px-6 py-10 text-[var(--byblos-text,#f5f5f5)] selection:bg-yellow-300 selection:text-black transition-colors duration-200">
    {/* z-0 explicitly, so the scatter stays behind the nav buttons and main content
        regardless of DOM order — flex items paint in the same layer as position:absolute
        siblings, so relying on ordering alone here would be fragile. */}
    <LandingDoodles />
    <Link to="/mzigo/login" className="absolute left-5 top-[calc(1.25rem+env(safe-area-inset-top,0px))] z-10" aria-label="Mzigo Ego delivery partner login">
      <Button className="flex h-10 w-10 items-center justify-center rounded-full border border-separator bg-fill p-0 hover:bg-fill-2">
        <img src="/mzigo-ego.png" alt="Mzigo Ego" className="h-6 w-6 object-contain" />
      </Button>
    </Link>

    <Link to="/creator/login" className="absolute right-5 top-[calc(1.25rem+env(safe-area-inset-top,0px))] z-10">
      <Button className="h-8 rounded-full border border-separator bg-fill px-4 text-xs font-semibold text-label hover:bg-fill-2">
        Creator
      </Button>
    </Link>

    <main className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 text-center pt-[env(safe-area-inset-top,0px)] pb-28">
      {/* The centre logo is the buyer entry point — tapping it opens buyer login. */}
      <Link
        to="/buyer/login"
        aria-label="Tap the Byblos logo to get access"
        className="overflow-hidden rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-400/70"
      >
        <img
          src="/byblos-mark-dark.png"
          alt="Byblos logo"
          className="hidden dark:block h-auto w-[min(68vw,260px)] object-cover"
        />
        <img
          src="/byblos-mark-light.png"
          alt="Byblos logo"
          className="block dark:hidden h-auto w-[min(68vw,260px)] object-cover"
        />
      </Link>

      <p className="text-[15px] font-medium text-label-2 max-w-[280px] leading-relaxed">
        The safer way to buy from businesses on social media
      </p>

      <p className="text-[13px] font-semibold text-label">
        Tap logo to get access
      </p>

      {/* Play Store download is a web-only affordance — the native app already has itself installed. */}
      {!isNativeApp() && (
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Get Byblos on Google Play"
          // Rounded "frame" around the badge rather than clipping the artwork itself —
          // Google's brand guidelines ask that the official badge stay unmodified.
          className="inline-block rounded-2xl bg-black p-2"
        >
          <img
            src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
            alt="Get it on Google Play"
            className="h-16 w-auto"
          />
        </a>
      )}
    </main>

    <AddBusinessCard />
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

import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from '@/shared/ui/icons';
import { TermsContent } from '@/shared/components/TermsContent';
import { SEOHead } from '@/shared/components/SEOHead';

const SITE = 'https://www.byblosafrica.site';

/**
 * Public, standalone legal page rendering the Privacy Policy + Client Agreement.
 * Served at /privacy and /terms so the policy has a stable, publicly reachable
 * URL (required by the Google Play Console). Branded black frame with a white,
 * high-contrast document card so the policy is always legible to reviewers.
 */
export default function LegalPage() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-[100svh] bg-black">
      <SEOHead
        title="Privacy Policy & Terms"
        description="Byblos Privacy Policy and Terms of Service: how we handle your data and the rules for using the Byblos app and website."
        url={`${SITE}${pathname}`}
        canonical={`${SITE}${pathname}`}
      />
      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/95 px-4 py-3 backdrop-blur pt-safe-top">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <ArrowLeft size={16} />
            Home
          </Link>
          <div className="inline-flex rounded-full border border-white/20 p-1 bg-black/40 shadow-md overflow-hidden">
            <img src="/byblos-icon.png" alt="Byblos" className="h-7 w-7 rounded-full object-cover" />
          </div>
        </div>
      </header>

      <main className="px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 text-gray-800 shadow-[0_18px_60px_rgba(0,0,0,0.5)] sm:p-10">
          <h1 className="mb-6 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
            Privacy Policy &amp; Terms
          </h1>
          <TermsContent />
        </div>
      </main>

      <footer className="border-t border-white/10 px-4 py-6 text-center text-xs text-label-2">
        &copy; 2026 Byblos. All rights reserved.
      </footer>
    </div>
  );
}

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from '@/shared/ui/icons';
import { ByblosLogoMark } from '@/shared/ui/ByblosLogoMark';

interface PenpotAuthLayoutProps {
  roleTag?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footerLead?: string;
  footerLinkText?: string;
  footerLinkTo?: string;
  showTrustLine?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
  className?: string;
}

export function PenpotAuthLayout({
  roleTag,
  title,
  subtitle,
  children,
  footerLead,
  footerLinkText,
  footerLinkTo,
  showTrustLine = true,
  showBackButton = false,
  onBack,
  className = '',
}: PenpotAuthLayoutProps) {
  const navigate = useNavigate();

  return (
    <main
      className={`min-h-[100svh] bg-[#121214] text-white flex flex-col justify-between items-center py-8 px-4 sm:px-6 transition-colors duration-200 select-none ${className}`}
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Top Bar / Back button if requested */}
      <div className="w-full max-w-[375px] flex items-center justify-between mb-4">
        {showBackButton ? (
          <button
            type="button"
            onClick={onBack || (() => navigate(-1))}
            className="flex items-center gap-2 text-sm text-[#a1a1a6] hover:text-white px-3 py-1.5 rounded-xl hover:bg-white/10 transition-all duration-200"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        ) : (
          <div className="h-6" />
        )}
      </div>

      {/* Main Content Column (327px inner width on mobile, max 375px) */}
      <div className="w-full max-w-[375px] flex flex-col items-center flex-1 justify-center my-auto">
        {/* Header Block */}
        <div className="w-full flex flex-col items-center text-center mb-8">
          <Link to="/" className="mb-6 hover:opacity-90 transition-opacity">
            <ByblosLogoMark className="w-8 h-[52px]" />
          </Link>

          {roleTag ? (
            <>
              <h1 className="text-[#f5c518] text-[11px] font-bold tracking-[0.15em] uppercase mb-2">
                {roleTag}
              </h1>
              <h2 className="text-[28px] sm:text-[32px] font-bold text-white tracking-tight leading-tight mb-2">
                {title}
              </h2>
            </>
          ) : (
            <h1 className="text-[28px] sm:text-[32px] font-bold text-white tracking-tight leading-tight mb-2">
              {title}
            </h1>
          )}

          {subtitle && (
            <p className="text-[14px] text-[#a1a1a6] leading-relaxed max-w-[320px]">
              {subtitle}
            </p>
          )}
        </div>

        {/* Dynamic Form / View Container */}
        <div className="w-full">{children}</div>
      </div>

      {/* Footer Block */}
      <footer className="w-full max-w-[375px] flex flex-col items-center gap-4 mt-8 pt-4">
        {footerLead && footerLinkText && footerLinkTo && (
          <div className="flex items-center justify-center gap-1.5 text-[14px]">
            <span className="text-[#a1a1a6]">{footerLead}</span>
            <Link
              to={footerLinkTo}
              className="text-[#f5c518] font-semibold hover:underline transition-all"
            >
              {footerLinkText}
            </Link>
          </div>
        )}

        {showTrustLine && (
          <div className="flex items-center justify-center gap-2 text-[12px] text-[#a1a1a6] text-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f5c518] shrink-0" />
            <span>Payments are held in escrow until delivery is confirmed</span>
          </div>
        )}
      </footer>
    </main>
  );
}

export default PenpotAuthLayout;

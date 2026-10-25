import React from 'react';

export interface SectionTitleProps {
  title?: React.ReactNode;
  children?: React.ReactNode;
  subtitle?: React.ReactNode;
}

export function SectionTitle({ title, children, subtitle }: SectionTitleProps) {
  const content = title || children;
  return (
    <div className="mb-4 sm:mb-6 pt-1 sm:pt-2">
      <h2 className="text-base sm:text-xl font-semibold text-label tracking-tight flex items-center gap-2 sm:gap-3">
        {content}
        <div className="h-[1px] flex-grow bg-gradient-to-r from-white/15 to-transparent"></div>
      </h2>
      {subtitle && <p className="text-label-2 text-[11px] sm:text-xs font-medium mt-1">{subtitle}</p>}
    </div>
  );
}

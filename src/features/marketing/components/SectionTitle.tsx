import React from 'react';

export interface SectionTitleProps {
  title?: React.ReactNode;
  children?: React.ReactNode;
  subtitle?: React.ReactNode;
}

export function SectionTitle({ title, children, subtitle }: SectionTitleProps) {
  const content = title || children;
  return (
    <div className="mb-6 pt-2">
      <h2 className="text-xl font-semibold text-label tracking-tight flex items-center gap-3">
        {content}
        <div className="h-[1px] flex-grow bg-gradient-to-r from-white/15 to-transparent"></div>
      </h2>
      {subtitle && <p className="text-label-2 text-xs font-medium mt-1">{subtitle}</p>}
    </div>
  );
}

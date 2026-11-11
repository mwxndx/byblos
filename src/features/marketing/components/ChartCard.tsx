import React from 'react';

export interface ChartCardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, children, className = '' }: Readonly<ChartCardProps>) {
  return (
    <div className={`bg-surface-1 border border-transparent rounded-2xl p-3.5 sm:p-5 md:p-6 shadow-xl transition-all hover:border-yellow-500/30 w-full min-w-0 overflow-hidden ${className}`}>
      <div className="mb-3 sm:mb-4 md:mb-6 min-w-0">
        {title && <h3 className="text-xs sm:text-sm md:text-base font-semibold text-label tracking-tight leading-none mb-1 md:mb-1.5 truncate">{title}</h3>}
        {subtitle && <p className="text-label-2 text-[10px] md:text-xs font-medium truncate">{subtitle}</p>}
      </div>
      <div className="relative w-full min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

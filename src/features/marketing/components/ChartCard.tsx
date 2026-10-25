import React from 'react';

export interface ChartCardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, children, className = '' }: ChartCardProps) {
  return (
    <div className={`bg-surface-1 border border-separator rounded-2xl p-3.5 sm:p-5 md:p-6 shadow-xl transition-all hover:border-yellow-500/30 ${className}`}>
      <div className="mb-3 sm:mb-4 md:mb-6">
        {title && <h3 className="text-xs sm:text-sm md:text-base font-semibold text-label tracking-tight leading-none mb-1 md:mb-1.5">{title}</h3>}
        {subtitle && <p className="text-label-2 text-[10px] md:text-xs font-medium">{subtitle}</p>}
      </div>
      <div className="relative">
        {children}
      </div>
    </div>
  );
}

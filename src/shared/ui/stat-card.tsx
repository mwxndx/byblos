import * as React from "react";
import { cn } from "@/shared/utils/cn";

export type StatCardColor = 'yellow' | 'green' | 'blue' | 'purple' | 'red' | 'gray';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  subtitle?: string;
  sub?: string;
  trend?: string | number | null;
  label?: string;
  color?: StatCardColor;
  prefix?: string;
  suffix?: string;
  hero?: boolean;
  valueClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  layout?: 'default' | 'side-icon';
}

const colorClasses: Record<StatCardColor, string> = {
  yellow: "border-brand/30 bg-brand/10",
  green: "border-sys-green/30 bg-sys-green/10",
  blue: "border-sys-blue/30 bg-sys-blue/10",
  purple: "border-purple-400/30 bg-purple-400/10",
  red: "border-sys-red/30 bg-sys-red/10",
  gray: "border-separator bg-surface-1",
};

export function StatCard({
  title,
  value,
  icon,
  subtitle,
  sub,
  trend,
  label = "vs last month",
  color = 'gray',
  prefix = '',
  suffix = '',
  hero = false,
  className,
  valueClassName,
  titleClassName,
  subtitleClassName,
  layout = 'side-icon',
  ...props
}: StatCardProps) {
  const displaySubtitle = subtitle || sub;
  const formattedValue = typeof value === 'number'
    ? (value >= 1_000_000
      ? `${prefix}${(value / 1_000_000).toFixed(1)}M${suffix}`
      : value >= 1_000
        ? `${prefix}${(value / 1_000).toFixed(1)}K${suffix}`
        : `${prefix}${value.toLocaleString()}${suffix}`)
    : `${prefix}${value}${suffix}`;

  const numTrend = trend != null ? Number(trend) : null;
  const isPositiveTrend = numTrend != null && numTrend >= 0;

  if (layout === 'side-icon' && !hero) {
    return (
      <div
        className={cn(
          "rounded-card border p-5 shadow-sm transition-all hover:border-brand/40",
          colorClasses[color] || colorClasses.gray,
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className={cn("text-xs font-semibold text-label-2 truncate", titleClassName)}>
              {title}
            </p>
            <div className="mt-2 flex items-baseline gap-2 flex-wrap">
              <span className={cn("text-2xl sm:text-3xl font-bold tabular-nums tracking-[-0.02em] text-label", valueClassName)}>
                {formattedValue}
              </span>
              {numTrend != null && (
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded",
                    isPositiveTrend ? "bg-sys-green/20 text-sys-green" : "bg-sys-red/20 text-sys-red"
                  )}
                >
                  {isPositiveTrend ? `↑ ${numTrend}%` : `↓ ${Math.abs(numTrend)}%`}
                </span>
              )}
            </div>
            {displaySubtitle && (
              <p className={cn("mt-1 text-xs font-medium text-label-2", subtitleClassName)}>
                {displaySubtitle}
              </p>
            )}
            {numTrend != null && label && (
              <p className="mt-1 text-[10px] font-medium text-label-3">
                {label}
              </p>
            )}
          </div>
          {icon && <div className="shrink-0 ml-3">{icon}</div>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-card border shadow-sm transition-all hover:border-brand/40",
        hero ? "p-5 md:p-6" : "p-4 md:p-5",
        colorClasses[color] || colorClasses.gray,
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-label-2 truncate", hero ? "text-xs md:text-sm font-bold uppercase tracking-wider" : "text-xs font-semibold", titleClassName)}>
          {title}
        </p>
        {icon && <div className="shrink-0">{icon}</div>}
      </div>
      <p className={cn("tracking-tight font-semibold text-label mt-1.5", hero ? "text-2xl md:text-3xl" : "text-xl md:text-2xl", valueClassName)}>
        {formattedValue}
      </p>
      {displaySubtitle && (
        <p className={cn("text-label-2 text-[10px] md:text-xs mt-1 font-medium", subtitleClassName)}>
          {displaySubtitle}
        </p>
      )}
      {numTrend != null && (
        <div className="flex items-center gap-1.5 mt-2 md:mt-3">
          <span className={cn("text-[9px] md:text-[10px] font-semibold px-1.5 py-0.5 rounded", isPositiveTrend ? "bg-sys-green/20 text-sys-green" : "bg-sys-red/20 text-sys-red")}>
            {isPositiveTrend ? '↑' : '↓'} {Math.abs(numTrend)}%
          </span>
          {label && <span className="text-label-2 text-[9px] md:text-[10px] font-semibold">{label}</span>}
        </div>
      )}
    </div>
  );
}

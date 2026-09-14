import * as React from "react";
import { cn } from "@/shared/utils/formatting";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  subtitle?: string;
  trend?: string | number | null;
  valueClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  layout?: 'default' | 'side-icon';
}

export function StatCard({
  title,
  value,
  icon,
  subtitle,
  trend,
  className,
  valueClassName,
  titleClassName,
  subtitleClassName,
  layout = 'side-icon',
  ...props
}: StatCardProps) {
  if (layout === 'side-icon') {
    return (
      <div
        className={cn(
          "rounded-card border border-separator bg-surface-1 p-5 shadow-sm",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className={cn("text-xs font-medium text-label-2", titleClassName)}>
              {title}
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={cn("text-3xl font-bold tabular-nums tracking-[-0.02em] text-label", valueClassName)}>
                {value}
              </span>
              {trend != null && (
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    Number(trend) >= 0 ? "text-sys-green" : "text-sys-red"
                  )}
                >
                  {Number(trend) >= 0 ? `+${trend}%` : `${trend}%`}
                </span>
              )}
            </div>
            {subtitle && (
              <p className={cn("mt-1 text-xs font-medium text-label-2", subtitleClassName)}>
                {subtitle}
              </p>
            )}
          </div>
          {icon && <div className="shrink-0">{icon}</div>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-card border border-separator bg-surface-1 p-4 shadow-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-xs font-medium text-label-2", titleClassName)}>
          {title}
        </span>
        {icon && <div className="shrink-0">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className={cn("text-xl font-bold tabular-nums tracking-[-0.02em] text-label sm:text-2xl", valueClassName)}>
          {value}
        </span>
        {trend != null && (
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              Number(trend) >= 0 ? "text-sys-green" : "text-sys-red"
            )}
          >
            {Number(trend) >= 0 ? `+${trend}%` : `${trend}%`}
          </span>
        )}
      </div>
      {subtitle && (
        <p className={cn("mt-1 text-xs font-medium text-label-2", subtitleClassName)}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

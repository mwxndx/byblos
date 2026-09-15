import * as React from "react"

import { cn } from "@/shared/utils/formatting"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-control border border-separator-strong bg-surface-1 px-3 py-2 text-base text-label placeholder:text-label-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          // Matches Input: aria-invalid consumers get a red border + focus ring
          // for free, exposed to AT rather than color-only. WCAG 3.3.1 / 1.4.1.
          "aria-[invalid=true]:border-sys-red aria-[invalid=true]:focus-visible:ring-[color-mix(in_srgb,var(--sys-red)_50%,transparent)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }



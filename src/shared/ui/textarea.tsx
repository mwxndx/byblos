import * as React from "react"

import { cn } from "@/shared/utils/formatting"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-950 ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          // Matches Input: aria-invalid consumers get a red border + focus ring
          // for free, exposed to AT rather than color-only. WCAG 3.3.1 / 1.4.1.
          "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-500/60",
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



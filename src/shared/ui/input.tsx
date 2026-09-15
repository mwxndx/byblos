import * as React from "react"

import { cn } from "@/shared/utils/formatting"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Tokenised: resolves in both themes via the semantic layer, no dark:
          // overrides needed. Apple control radius + focus ring.
          "flex h-11 w-full rounded-control border border-separator-strong bg-surface-1 px-3 py-2 text-base text-label file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-label-2 placeholder:text-label-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          // Consistent error affordance: any consumer that sets aria-invalid
          // (e.g. `aria-invalid={!!errors.field}`) gets a red border + red
          // focus ring without re-implementing it, and the state is exposed
          // to assistive tech, not just conveyed by color. WCAG 3.3.1 / 1.4.1.
          "aria-[invalid=true]:border-sys-red aria-[invalid=true]:focus-visible:ring-[color-mix(in_srgb,var(--sys-red)_50%,transparent)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }



import * as React from "react"

import { cn } from "@/shared/utils/formatting"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-950 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-700 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "dark:border-white/10 dark:bg-[#171717] dark:text-white dark:placeholder:text-gray-500 dark:ring-offset-neutral-950",
          // Consistent error affordance: any consumer that sets aria-invalid
          // (e.g. `aria-invalid={!!errors.field}`) gets a red border + red
          // focus ring without re-implementing it, and the state is exposed
          // to assistive tech, not just conveyed by color. WCAG 3.3.1 / 1.4.1.
          "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-500/60 dark:aria-[invalid=true]:border-red-500",
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



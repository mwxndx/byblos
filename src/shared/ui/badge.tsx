import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/shared/utils/formatting"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400/60 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-[color-mix(in_srgb,var(--brand)_18%,transparent)] text-brand-text",
        secondary:
          "bg-fill text-label-2",
        destructive:
          "bg-[color-mix(in_srgb,var(--sys-red)_16%,transparent)] text-sys-red",
        outline: "border border-separator bg-transparent text-label-2",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge }



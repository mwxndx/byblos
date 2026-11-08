import { cva } from "class-variance-authority";

// Standardized role buttons: white buttons with black text in dark mode and
// black buttons with white text in light mode across all roles (Seller, Buyer, Creator, Admin).
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-semibold transition-all duration-200 ease-ios active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 dark:focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-sm",
        destructive: "bg-fill text-sys-red hover:bg-[color-mix(in_srgb,var(--sys-red)_14%,transparent)]",
        outline: "border border-separator-strong bg-surface-1 text-label hover:bg-fill",
        secondary: "bg-fill text-label hover:bg-fill-2",
        ghost: "text-label-2 hover:bg-fill hover:text-label",
        link: "text-brand-text underline-offset-4 hover:underline",
        byblos: "bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-sm",
        "secondary-byblos": "border border-separator-strong bg-surface-1 text-label hover:bg-fill",
        gradient: "bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 font-semibold shadow-sm",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-control px-3",
        lg: "h-12 rounded-control px-8",
        icon: "h-11 w-11 rounded-control",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);



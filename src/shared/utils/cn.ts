import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standard className merge utility using clsx and tailwind-merge.
 * Kept as an isolated leaf module to avoid pulling heavy dependencies into pure UI components.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

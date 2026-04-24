import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility for merging Tailwind classes gracefully without conflicts.
 */
export function cn(...inputs) {
    return twMerge(clsx(inputs))
}

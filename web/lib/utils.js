import { clsx } from "clsx";
/**
 * Merge class names with clsx.
 * Keeps a single helper so every component imports from the same place;
 * if we later add tailwind-merge we swap only this file.
 */
export function cn(...inputs) {
    return clsx(inputs);
}

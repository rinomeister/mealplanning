import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a user-entered decimal, accepting both "." and "," as the separator
 * (locale keyboards often surface a comma on the numeric pad). Returns NaN for
 * non-numeric input, so callers can guard with Number.isFinite.
 */
export function parseDecimal(value: string): number {
  return Number(value.replace(",", "."));
}

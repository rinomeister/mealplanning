import { SHARE_CODE_RE } from "@/lib/schemas";

// No 0/O, 1/I/L: codes get read aloud and typed off a phone screen.
export const SHARE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** "K7QM4XPA" → "K7QM-4XPA" for display. */
export function formatShareCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Accept whatever someone pastes — "k7qm-4xpa", "K7QM 4XPA", or the whole
 * share link — and return the bare code, or null if it can't be one.
 */
export function parseShareCode(input: string): string | null {
  let raw = input.trim();
  const fromLink = raw.match(/\/share\/([^/?#\s]+)/i);
  if (fromLink) raw = fromLink[1];
  const code = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return SHARE_CODE_RE.test(code) ? code : null;
}

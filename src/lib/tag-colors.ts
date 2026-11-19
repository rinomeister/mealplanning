/**
 * Meal tags use pale tints with ink text, so they never look like macro
 * colours. New tags store the tint name; older tags hold a hex colour, which
 * is mapped to the nearest tint by hue.
 */
export const TAG_TINTS = ["stone", "sand", "sky", "mint", "rose", "lilac"] as const;
export type TagTint = (typeof TAG_TINTS)[number];

function hue(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.08) return null; // grey
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

export function tagTint(color: string | null | undefined): TagTint {
  if (!color) return "stone";
  if ((TAG_TINTS as readonly string[]).includes(color)) return color as TagTint;
  const h = hue(color);
  if (h == null) return "stone";
  if (h < 20 || h >= 330) return "rose";
  if (h < 70) return "sand";
  if (h < 170) return "mint";
  if (h < 250) return "sky";
  return "lilac";
}

/** Inline style for a tag chip. */
export function tagStyle(color: string | null | undefined): React.CSSProperties {
  return { background: `var(--tag-${tagTint(color)})`, color: "var(--ink)" };
}

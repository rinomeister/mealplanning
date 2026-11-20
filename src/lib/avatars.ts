/** Preset avatars, drawn as SVGs in public/avatars/<key>.svg. Order = picker order. */
export const AVATARS = [
  { key: "dog", label: "Dog" },
  { key: "cat", label: "Cat" },
  { key: "pancake", label: "Pancakes" },
  { key: "avocado", label: "Avocado" },
  { key: "fried-egg", label: "Fried egg" },
  { key: "broccoli", label: "Broccoli" },
  { key: "ramen", label: "Ramen" },
  { key: "strawberry", label: "Strawberry" },
  { key: "croissant", label: "Croissant" },
  { key: "carrot", label: "Carrot" },
  { key: "salad", label: "Salad" },
  { key: "banana", label: "Banana" },
] as const;

export type AvatarKey = (typeof AVATARS)[number]["key"];

export function isAvatarKey(v: unknown): v is AvatarKey {
  return typeof v === "string" && AVATARS.some((a) => a.key === v);
}

export const avatarSrc = (key: AvatarKey) => `/avatars/${key}.svg`;

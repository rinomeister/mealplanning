// Default tags created for every new user on registration. Users can add/edit/delete their own.
export const DEFAULT_TAGS: { name: string; color: string }[] = [
  { name: "high-caloric", color: "#ef4444" },
  { name: "low-caloric", color: "#22c55e" },
  { name: "high-protein", color: "#3b82f6" },
  { name: "low-fat", color: "#06b6d4" },
  { name: "low-carb", color: "#a855f7" },
  { name: "vegetarian", color: "#84cc16" },
  { name: "vegan", color: "#16a34a" },
  { name: "quick", color: "#f59e0b" },
  { name: "meal-prep", color: "#8b5cf6" },
];

// A small palette offered when the user creates a custom tag.
export const TAG_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#64748b",
];

import Link from "next/link";

/** The round initial on Home and Today that opens Me & settings. */
export function AvatarLink({ name }: { name?: string | null }) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <Link
      href="/me"
      aria-label="Me and settings"
      className="press grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 font-semibold text-ink"
    >
      {initial}
    </Link>
  );
}

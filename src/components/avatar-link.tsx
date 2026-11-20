import Link from "next/link";
import { cn } from "@/lib/utils";
import { avatarSrc, isAvatarKey } from "@/lib/avatars";

/** The user's picked avatar, or the initial of their name when none is set. */
export function Avatar({
  avatar,
  name,
  className,
}: {
  avatar?: string | null;
  name?: string | null;
  className?: string;
}) {
  if (isAvatarKey(avatar)) {
    // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG
    return <img src={avatarSrc(avatar)} alt="" className={cn("size-11 shrink-0 rounded-full", className)} />;
  }
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <span
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 font-semibold text-ink",
        className,
      )}
      aria-hidden
    >
      {initial}
    </span>
  );
}

/** The round avatar on Home and Today that opens Me & settings. */
export function AvatarLink({ name, avatar }: { name?: string | null; avatar?: string | null }) {
  return (
    <Link href="/me" aria-label="Me and settings" className="press shrink-0 rounded-full">
      <Avatar avatar={avatar} name={name} />
    </Link>
  );
}

import { Inbox } from "lucide-react";

/** Icon tile + title + one line + one action, as in the design's States screens. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 pb-6 pt-7 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-[14px] bg-surface-2 text-ink-2 [&_svg]:size-5">{icon ?? <Inbox />}</span>
      <p className="text-[17px] font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-4 w-full max-w-xs">{action}</div>}
    </div>
  );
}

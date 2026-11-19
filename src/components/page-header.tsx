export function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description?: string;
  /** Small line above the title, e.g. the date on Home. */
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-sm text-ink-2">{eyebrow}</p>}
        <h1 className="t-title">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-ink-3">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Cold-load skeleton for the tab pages: a title, the big summary card and a
 * couple of rows. Shapes only, never a spinner.
 */
export default function Loading() {
  const block = "rounded-[10px] bg-surface-2";
  return (
    <div className="motion-safe:animate-pulse" aria-busy="true" aria-label="Loading">
      <div className={`mb-5 h-8 w-32 ${block}`} />
      <div className="card mb-3 flex items-center gap-4 p-4">
        <div className="size-28 shrink-0 rounded-full border-[12px] border-surface-2" />
        <div className="flex flex-1 flex-col gap-2.5">
          <div className={`h-4 w-2/3 ${block}`} />
          <div className={`h-3 w-full ${block}`} />
          <div className={`h-3 w-5/6 ${block}`} />
          <div className={`h-3 w-1/2 ${block}`} />
        </div>
      </div>
      <div className="card divide-y divide-line px-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 py-4">
            <div className="size-7 shrink-0 rounded-full bg-surface-2" />
            <div className="flex flex-1 flex-col gap-2">
              <div className={`h-3.5 w-1/3 ${block}`} />
              <div className={`h-3 w-1/2 ${block}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

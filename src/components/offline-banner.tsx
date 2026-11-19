"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** A quiet note at the top while the device is offline. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="mb-3 flex items-start gap-3 rounded-[14px] bg-surface-2 px-3.5 py-3 text-sm text-ink-2">
      <WifiOff className="mt-0.5 size-4 shrink-0" />
      <p>
        <b className="text-ink">Offline.</b>{" "}
        You can look around; changes won&apos;t save until you&apos;re back online.
      </p>
    </div>
  );
}

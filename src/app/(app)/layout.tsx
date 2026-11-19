import { requireUserId } from "@/lib/auth-helpers";
import { Rail, TabBar } from "@/components/app-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { ViewportSync } from "@/components/viewport-sync";
import { ToastProvider } from "@/components/toast";
import { KEYBOARD_BAR_SLOT } from "@/components/keyboard-bar";
import { AddSheet } from "@/components/add/add-sheet";
import { Suspense } from "react";
import { OfflineBanner } from "@/components/offline-banner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUserId();

  return (
    <div className="app-shell">
      <ViewportSync />
      <Rail />

      {/* The column starts below the status bar (black-translucent), so
          content never scrolls under the clock. */}
      <div className="flex min-w-0 flex-1 flex-col pt-[env(safe-area-inset-top)]">
        {/* Toasts float at the bottom of this box: above the tab bar and any
            keyboard bar. */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <ToastProvider>
            {/* The only scrolling element. Side padding clears the notch in
                landscape. */}
            <main id="app-scroll" className="app-scroll">
              <div className="mx-auto w-full max-w-3xl pb-8 desk:max-w-[1200px] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-3 desk:px-8 desk:pb-10 desk:pt-8">
                <OfflineBanner />
                {children}
              </div>
            </main>
            <Suspense>
              <AddSheet />
            </Suspense>
          </ToastProvider>
        </div>
        {/* Bottom bars: a form's keyboard bar (portalled in), then the tabs. */}
        <div id={KEYBOARD_BAR_SLOT} className="shrink-0" />
        <TabBar />
      </div>

      <InstallPrompt />
    </div>
  );
}

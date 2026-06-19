import { LogOut } from "lucide-react";
import { requireUserId } from "@/lib/auth-helpers";
import { getSessionUser } from "@/lib/auth-helpers";
import { DesktopNav, MobileNav } from "@/components/app-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { signOutAction } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUserId();
  const user = await getSessionUser();

  return (
    <div className="md:flex md:min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card p-4 md:flex">
        <div className="mb-6 px-2">
          <p className="text-lg font-bold tracking-tight text-primary">MealPlan</p>
        </div>
        <DesktopNav />
        <div className="mt-auto px-2 pt-4">
          <p className="mb-2 truncate text-xs text-muted-foreground">
            {user?.email}
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1">
        <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-5 md:px-8 md:pb-10 md:pt-8">
          {children}
        </main>
      </div>

      <MobileNav />
      <InstallPrompt />
    </div>
  );
}

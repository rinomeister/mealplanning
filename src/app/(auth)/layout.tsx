export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh justify-center bg-bg pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(1.5rem,env(safe-area-inset-top))] text-ink">
      <div className="flex w-full max-w-sm flex-col desk:justify-center">{children}</div>
    </main>
  );
}

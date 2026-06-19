export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            MealPlan
          </h1>
          <p className="text-sm text-muted-foreground">
            Plan meals · track macros · shop smart
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}

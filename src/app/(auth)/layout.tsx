export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm fade-up">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-pos-dim text-2xl">
            🌿
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Hearth</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Shared money, made clear.
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}

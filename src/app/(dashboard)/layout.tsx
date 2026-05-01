import { logoutAction } from "@/app/(auth)/login/actions";
import { DashboardNav } from "@/app/(dashboard)/dashboard-nav";
import { requireSession } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession(["super_adm", "organizador", "recepcao", "expositor"]);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-40 border-b border-[var(--outline-variant)]/20 bg-[var(--header-glass)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="font-headline text-xl font-extrabold tracking-tight text-[var(--primary)]">
              Clube do Frio
            </span>
            <DashboardNav role={session.role} />
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[var(--surface-container)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">
              {session.role}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="ghost-border rounded-lg bg-[var(--surface-container-lowest)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-container-low)]"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] px-6 py-8">{children}</main>
    </div>
  );
}

import { logoutAction } from "@/app/(auth)/login/actions";
import { DashboardNav } from "@/app/(dashboard)/dashboard-nav";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession(["super_adm", "organizador", "recepcao", "expositor"]);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-40 border-b border-[var(--outline-variant)]/20 bg-[var(--header-glass)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 md:gap-6">
            <span className="truncate font-headline text-lg font-extrabold tracking-tight text-[var(--primary)] sm:text-xl">
              Clube do Frio
            </span>
            <DashboardNav role={session.role} />
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden rounded-full bg-[var(--surface-container)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)] sm:inline-flex">
              {session.role}
            </span>
            <form action={logoutAction}>
              <SubmitButton
                pendingLabel="Saindo..."
                className="ghost-border min-h-11 rounded-xl bg-[var(--surface-container-lowest)] px-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-container-low)]"
              >
                Sair
              </SubmitButton>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { restoreEventAction } from "@/app/(dashboard)/events/actions";
import { EventMobileNav } from "@/app/(dashboard)/events/[eventId]/event-mobile-nav";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth/session";
import type { AppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type EventScopedLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
};

export default async function EventScopedLayout({ children, params }: EventScopedLayoutProps) {
  const session = await requireSession(["super_adm", "organizador", "recepcao", "expositor"]);
  const { eventId } = await params;

  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id, name, status").eq("id", eventId).maybeSingle();

  if (!event) {
    notFound();
  }

  if (event.status === "arquivado") {
    return (
      <section className="surface-card rounded-2xl p-6 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Evento arquivado</p>
        <h1 className="mt-1 font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">{event.name}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Os dados e o histórico deste evento foram preservados, mas seus módulos operacionais estão desativados.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/events?status=arquivado"
            className="rounded-xl border border-[var(--outline-variant)]/65 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--foreground)]"
          >
            Voltar aos arquivados
          </Link>
          {session.role === "super_adm" ? (
            <form action={restoreEventAction}>
              <input type="hidden" name="event_id" value={event.id} />
              <SubmitButton pendingLabel="Restaurando..." className="gradient-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white">
                Restaurar como rascunho
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </section>
    );
  }

  const navItems: { href: string; label: string; roles: AppRole[] }[] = [
    { href: `/events/${eventId}/settings`, label: "Configuração", roles: ["super_adm", "organizador"] },
    {
      href: `/events/${eventId}/certificate-settings`,
      label: "Configuração Certificado",
      roles: ["super_adm", "organizador"],
    },
    { href: `/events/${eventId}/inscricoes`, label: "Inscrições", roles: ["super_adm", "organizador"] },
    {
      href: `/events/${eventId}/checkin-recepcao`,
      label: "Check-in Recepção",
      roles: ["super_adm", "organizador", "recepcao"],
    },
    { href: `/events/${eventId}/lista-do-dia`, label: "Lista do Dia", roles: ["super_adm", "organizador", "recepcao"] },
    { href: `/events/${eventId}/checkin-expositor`, label: "Check-in Expositor", roles: ["expositor"] },
    {
      href: `/events/${eventId}/credenciais-equipe`,
      label: "Credenciais da Equipe",
      roles: ["super_adm", "organizador", "expositor"],
    },
    { href: `/events/${eventId}/participants`, label: "Participantes", roles: ["super_adm", "organizador", "recepcao", "expositor"] },
    { href: `/events/${eventId}/credentials`, label: "Credenciais", roles: ["super_adm", "organizador"] },
    { href: `/events/${eventId}/sorteio`, label: "Sorteio", roles: ["super_adm", "organizador"] },
    { href: `/events/${eventId}/certificados`, label: "Certificados", roles: ["super_adm", "organizador"] },
    { href: `/events/${eventId}/relatorios`, label: "Relatórios", roles: ["super_adm", "organizador"] },
    { href: `/events/${eventId}/auditoria`, label: "Auditoria", roles: ["super_adm"] },
  ];
  const visibleNavItems = navItems
    .filter((item) => item.roles.includes(session.role))
    .map(({ href, label }) => ({ href, label }));

  return (
    <section className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="shell-card hidden h-fit rounded-2xl p-3 lg:sticky lg:top-24 lg:block">
        <p className="px-2 pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Modulos</p>
        <nav className="space-y-1">
          {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-container-lowest)] hover:text-[var(--primary)]"
              >
                {item.label}
              </Link>
            ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <div className="shell-card mb-4 rounded-2xl p-4 sm:mb-6 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Evento em Contexto</p>
              <h1 className="mt-1 font-headline text-xl font-extrabold leading-tight tracking-tight text-[var(--foreground)] sm:text-2xl">
                {event.name}
              </h1>
            </div>
            <span className="w-fit rounded-full bg-[var(--surface-container-lowest)] px-3 py-1 text-xs font-bold uppercase text-[var(--primary)]">
              {event.status}
            </span>
          </div>
          <EventMobileNav items={visibleNavItems} />
        </div>

        {children}
      </div>
    </section>
  );
}

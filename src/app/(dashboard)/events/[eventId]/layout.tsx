import Link from "next/link";
import { notFound } from "next/navigation";
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
    { href: `/events/${eventId}/participants`, label: "Participantes", roles: ["super_adm", "organizador", "recepcao", "expositor"] },
    { href: `/events/${eventId}/credentials`, label: "Credenciais", roles: ["super_adm", "organizador"] },
    { href: `/events/${eventId}/sorteio`, label: "Sorteio", roles: ["super_adm", "organizador"] },
    { href: `/events/${eventId}/certificados`, label: "Certificados", roles: ["super_adm", "organizador"] },
    { href: `/events/${eventId}/relatorios`, label: "Relatórios", roles: ["super_adm", "organizador"] },
    { href: `/events/${eventId}/auditoria`, label: "Auditoria", roles: ["super_adm"] },
  ];

  return (
    <section className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="shell-card hidden h-fit rounded-2xl p-3 lg:sticky lg:top-24 lg:block">
        <p className="px-2 pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Modulos</p>
        <nav className="space-y-1">
          {navItems
            .filter((item) => item.roles.includes(session.role))
            .map((item) => (
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

      <div>
        <div className="shell-card mb-6 rounded-2xl p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Evento em Contexto</p>
              <h1 className="font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)]">{event.name}</h1>
            </div>
            <span className="w-fit rounded-full bg-[var(--surface-container-lowest)] px-3 py-1 text-xs font-bold uppercase text-[var(--primary)]">
              {event.status}
            </span>
          </div>
          <nav className="mt-4 flex flex-wrap gap-2 lg:hidden">
            {navItems
              .filter((item) => item.roles.includes(session.role))
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="ghost-border rounded-full bg-[var(--surface-container-lowest)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-container)]"
                >
                  {item.label}
                </Link>
              ))}
          </nav>
        </div>

        {children}
      </div>
    </section>
  );
}

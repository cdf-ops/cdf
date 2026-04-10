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
    <section>
      <div className="mb-6 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">Evento em contexto</p>
            <h1 className="font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)]">{event.name}</h1>
          </div>
          <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold uppercase text-[var(--primary)]">
            {event.status}
          </span>
        </div>
        <nav className="mt-4 flex flex-wrap gap-2">
          {navItems
            .filter((item) => item.roles.includes(session.role))
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-[var(--outline-variant)]/60 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-container)]"
              >
                {item.label}
              </Link>
            ))}
        </nav>
      </div>

      {children}
    </section>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { CopyLinkButton } from "@/app/(dashboard)/events/[eventId]/inscricoes/copy-link-button";
import { CopyEmbedCodeButton } from "@/app/(dashboard)/events/[eventId]/inscricoes/copy-embed-code-button";

type InscriptionsPageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function InscriptionsPage({ params }: InscriptionsPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const { eventId } = await params;

  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id, name").eq("id", eventId).maybeSingle();
  if (!event) {
    notFound();
  }
  const { data: rawEventDays } = await admin
    .from("event_days")
    .select("id, date")
    .eq("event_id", eventId)
    .order("date", { ascending: true });
  const eventDays = rawEventDays ?? [];
  const registrations =
    eventDays.length > 0
      ? (
          await admin
            .from("event_registrations")
            .select("event_day_id")
            .in(
              "event_day_id",
              eventDays.map((day) => day.id)
            )
        ).data ?? []
      : [];

  const countsByDay = new Map<string, number>();
  registrations.forEach((registration) => {
    countsByDay.set(registration.event_day_id, (countsByDay.get(registration.event_day_id) ?? 0) + 1);
  });

  const total = registrations.length;
  const publicLink = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/inscricao/${eventId}`;
  const embedLink = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/embed/inscricao/${eventId}`;

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)]">Gestão de Inscrições</h2>
          <p className="mt-1 text-sm text-muted">Evento: {event.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyLinkButton url={publicLink} />
          <CopyEmbedCodeButton embedUrl={embedLink} />
          <Link
            href={embedLink}
            target="_blank"
            className="rounded-xl border border-[var(--outline-variant)]/65 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-container)]"
          >
            Visualizar embed
          </Link>
          <Link
            href={publicLink}
            target="_blank"
            className="gradient-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          >
            Visualizar Formulário
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="surface-card rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">Total de Inscrições</p>
          <p className="mt-1 font-headline text-3xl font-extrabold text-[var(--foreground)]">{total}</p>
        </div>
        <div className="surface-card rounded-xl p-4 sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">Inscritos por Dia</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {eventDays.map((day) => (
              <div key={day.id} className="rounded-lg border border-[var(--outline-variant)]/40 bg-white px-3 py-2">
                <p className="text-xs text-muted">{new Date(day.date).toLocaleDateString("pt-BR")}</p>
                <p className="font-headline text-xl font-bold text-[var(--foreground)]">{countsByDay.get(day.id) ?? 0}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="surface-card rounded-xl p-5">
        <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Link público de inscrição</h3>
        <p className="mt-2 break-all rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-sm text-muted">{publicLink}</p>
        <h3 className="mt-5 font-headline text-lg font-bold text-[var(--foreground)]">Link para incorporação</h3>
        <p className="mt-2 text-sm text-muted">
          Use este endereço em um bloco <span className="font-semibold">Embed</span> do Notion ou copie o código para adicionar o formulário a uma landing page.
        </p>
        <p className="mt-2 break-all rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-sm text-muted">{embedLink}</p>
      </div>
    </section>
  );
}

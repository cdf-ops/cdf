import Link from "next/link";
import { notFound } from "next/navigation";
import { SponsorCaptureScanner } from "@/app/patrocinador/portal/eventos/[eventId]/capture-scanner";
import { getSaoPauloDateKey } from "@/lib/date-time";
import { requireSponsorSession } from "@/lib/sponsors/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function SponsorEventCapturePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await requireSponsorSession();
  const { eventId } = await params;
  const admin = createAdminClient();
  const today = getSaoPauloDateKey();
  const [{ data: event }, { data: eventDay }] = await Promise.all([
    admin.from("events").select("id, name, location, status").eq("id", eventId).maybeSingle(),
    admin.from("event_days").select("id").eq("event_id", eventId).eq("date", today).maybeSingle(),
  ]);
  if (!event || event.status !== "ativo" || !eventDay) notFound();

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--outline-variant)]/25 bg-white">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--primary)]">{session.sponsorName}</p><h1 className="mt-1 font-headline text-xl font-extrabold">{event.name}</h1><p className="text-xs text-muted">{event.location}</p></div>
          <Link href="/patrocinador/portal" className="min-h-11 rounded-xl border bg-white px-4 py-3 text-sm font-semibold">Voltar</Link>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-5 sm:px-6 sm:py-8">
        <SponsorCaptureScanner eventId={eventId} />
        <section className="surface-card hidden items-center justify-between gap-4 rounded-2xl p-5 md:flex">
          <div><h2 className="font-headline text-xl font-extrabold">Participantes capturados</h2><p className="mt-1 text-sm text-muted">Consulte e pesquise os registros deste evento em uma tela própria.</p></div>
          <Link href={`/patrocinador/portal/eventos/${eventId}/participantes`} className="min-h-11 shrink-0 rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white">Ver participantes</Link>
        </section>
      </div>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { SponsorCaptureScanner } from "@/app/patrocinador/portal/eventos/[eventId]/capture-scanner";
import { formatSaoPauloDateTime, getSaoPauloDateKey } from "@/lib/date-time";
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
  const [{ data: event }, { data: eventDay }, { data: records, count: recordCount }] = await Promise.all([
    admin.from("events").select("id, name, location, status").eq("id", eventId).maybeSingle(),
    admin.from("event_days").select("id").eq("event_id", eventId).eq("date", today).maybeSingle(),
    admin
      .from("sponsor_participant_records")
      .select("id, captured_at, participant_id", { count: "exact" })
      .eq("sponsor_id", session.sponsorId)
      .eq("event_id", eventId)
      .is("invalidated_at", null)
      .order("captured_at", { ascending: false })
      .limit(50),
  ]);
  if (!event || event.status !== "ativo" || !eventDay) notFound();

  const participantIds = [...new Set((records ?? []).map((record) => record.participant_id))];
  const { data: participants } = participantIds.length
    ? await admin.from("participants").select("id, full_name").in("id", participantIds)
    : { data: [] };
  const names = new Map((participants ?? []).map((participant) => [participant.id, participant.full_name]));

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
        <section className="surface-card hidden rounded-2xl p-5 md:block">
          <div className="flex items-center justify-between"><div><h2 className="font-headline text-xl font-extrabold">Participantes registrados</h2><p className="mt-1 text-sm text-muted">As 50 leituras mais recentes deste evento.</p></div><strong className="text-2xl">{recordCount ?? 0}</strong></div>
          <div className="mt-4 divide-y divide-[var(--outline-variant)]/25">
            {(records ?? []).map((record) => <div key={record.id} className="flex items-center justify-between gap-4 py-3"><span className="font-semibold">{names.get(record.participant_id) ?? "Participante"}</span><time className="text-sm text-muted">{formatSaoPauloDateTime(record.captured_at)}</time></div>)}
            {!records?.length ? <p className="py-8 text-center text-sm text-muted">Nenhum participante registrado até agora.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

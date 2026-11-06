import Link from "next/link";
import { notFound } from "next/navigation";
import { formatSaoPauloDateTime } from "@/lib/date-time";
import { discloseSponsorParticipantData, getSponsorDataSettings } from "@/lib/sponsors/data-sharing";
import { requireSponsorSession } from "@/lib/sponsors/session";
import { createAdminClient } from "@/lib/supabase/admin";

const FIELD_LABELS: Record<string, string> = {
  email: "E-mail",
  phone: "Telefone",
  company: "Empresa",
  profession: "Profissão",
  job_title: "Cargo",
  city: "Cidade",
  state: "Estado",
};

function searchable(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export default async function SponsorCapturedParticipantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ busca?: string | string[] }>;
}) {
  const session = await requireSponsorSession();
  const { eventId } = await params;
  const queryValue = (await searchParams).busca;
  const query = (Array.isArray(queryValue) ? queryValue[0] : queryValue)?.trim() ?? "";
  const admin = createAdminClient();

  const [{ data: event }, { data: records, count }, settings] = await Promise.all([
    admin.from("events").select("id, name, location").eq("id", eventId).maybeSingle(),
    admin
      .from("sponsor_participant_records")
      .select("id, participant_id, captured_at", { count: "exact" })
      .eq("sponsor_id", session.sponsorId)
      .eq("event_id", eventId)
      .is("invalidated_at", null)
      .order("captured_at", { ascending: false })
      .limit(1000),
    getSponsorDataSettings(admin, eventId),
  ]);
  if (!event) notFound();

  const participantIds = [...new Set((records ?? []).map((record) => record.participant_id))];
  const { data: participants } = participantIds.length
    ? await admin
        .from("participants")
        .select("id, full_name, email, phone, company, profession, job_title, city, state")
        .in("id", participantIds)
    : { data: [] };
  const participantById = new Map(
    (participants ?? []).map((participant) => [participant.id, discloseSponsorParticipantData(participant, settings)])
  );
  const normalizedQuery = searchable(query);
  const visibleRecords = (records ?? [])
    .map((record) => ({ ...record, participant: participantById.get(record.participant_id) }))
    .filter((record) => record.participant)
    .filter((record) => !normalizedQuery || Object.values(record.participant ?? {}).some((value) => searchable(value).includes(normalizedQuery)));

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-6 sm:py-8">
        <section className="surface-card rounded-2xl p-6 text-center md:hidden">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--primary)]">Consulta no computador</p>
          <h1 className="mt-2 font-headline text-2xl font-extrabold">No celular, o portal é focado na captura</h1>
          <p className="mt-2 text-sm text-muted">Abra esta consulta em um computador para pesquisar os participantes capturados.</p>
          <Link href="/patrocinador/portal" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-[var(--primary)] px-5 font-bold text-white">Voltar ao portal</Link>
        </section>

        <div className="hidden md:block">
          <header className="flex items-start justify-between gap-6">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--primary)]">{session.sponsorName}</p><h1 className="mt-2 font-headline text-3xl font-extrabold">Participantes capturados</h1><p className="mt-1 text-sm text-muted">{event.name} · {event.location}</p></div>
            <Link href="/patrocinador/portal" className="min-h-11 rounded-xl border bg-white px-5 py-3 text-sm font-semibold">Voltar ao portal</Link>
          </header>

          <section className="surface-card mt-6 rounded-2xl p-5">
            <div className="flex items-end justify-between gap-6">
              <form method="get" className="flex max-w-2xl flex-1 gap-2">
                <label className="sr-only" htmlFor="busca-participante">Buscar participante</label>
                <input id="busca-participante" name="busca" defaultValue={query} placeholder="Buscar por nome ou dado compartilhado..." className="min-h-12 min-w-0 flex-1 rounded-xl border bg-white px-4" />
                <button className="min-h-12 rounded-xl bg-[var(--primary)] px-6 font-bold text-white">Buscar</button>
              </form>
              <div className="text-right"><p className="text-sm text-muted">Participantes</p><p className="font-headline text-3xl font-extrabold">{count ?? 0}</p></div>
            </div>
            {query ? <div className="mt-3 flex items-center gap-3 text-sm"><span>{visibleRecords.length} resultado(s) para “{query}”</span><Link href={`/patrocinador/portal/eventos/${eventId}/participantes`} className="font-bold text-[var(--primary)]">Limpar busca</Link></div> : null}

            <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--outline-variant)]/35">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="bg-[var(--surface-container-lowest)] text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Participante</th><th className="px-4 py-3">Dados compartilhados</th><th className="px-4 py-3 text-right">Capturado em</th></tr></thead>
                <tbody className="divide-y divide-[var(--outline-variant)]/25">
                  {visibleRecords.map((record) => {
                    const participant = record.participant!;
                    const details = Object.entries(participant).filter(([key]) => key !== "full_name");
                    return <tr key={record.id} className="bg-white align-top"><td className="px-4 py-4 font-bold">{participant.full_name}</td><td className="px-4 py-4 text-sm">{details.length ? <dl className="grid gap-1">{details.map(([key, value]) => <div key={key}><dt className="inline font-semibold">{FIELD_LABELS[key] ?? key}: </dt><dd className="inline text-muted">{value}</dd></div>)}</dl> : <span className="text-muted">Somente o nome foi liberado.</span>}</td><td className="whitespace-nowrap px-4 py-4 text-right text-sm text-muted">{formatSaoPauloDateTime(record.captured_at)}</td></tr>;
                  })}
                </tbody>
              </table>
              {!visibleRecords.length ? <p className="bg-white px-6 py-12 text-center text-sm text-muted">{query ? "Nenhum participante corresponde à busca." : "Nenhum participante capturado neste evento."}</p> : null}
            </div>
            {(count ?? 0) > 1000 ? <p className="mt-3 text-xs text-muted">Exibindo os 1.000 registros mais recentes.</p> : null}
          </section>
        </div>
      </div>
    </main>
  );
}

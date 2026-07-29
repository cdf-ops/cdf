import Link from "next/link";
import { notFound } from "next/navigation";
import { ParticipantDetailsForm } from "@/app/(dashboard)/participantes/[participantId]/participant-details-form";
import { requireSession } from "@/lib/auth/session";
import { formatDateOnly, formatSaoPauloDateTime } from "@/lib/date-time";
import { createAdminClient } from "@/lib/supabase/admin";

type ParticipantDetailPageProps = {
  params: Promise<{ participantId: string }>;
};

type EventHistory = {
  id: string;
  name: string;
  status: string;
  registeredDays: string[];
  checkins: string[];
};

function formatDaysSince(value: string | null) {
  if (!value) return "-";
  const elapsedDays = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  return elapsedDays === 0 ? "Hoje" : `${elapsedDays} dia${elapsedDays === 1 ? "" : "s"}`;
}

export default async function ParticipantDetailPage({ params }: ParticipantDetailPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const { participantId } = await params;
  const admin = createAdminClient();

  const [{ data: participant }, { data: registrationsData }, { data: checkinsData }] = await Promise.all([
    admin
      .from("participants")
      .select("id, participant_number, full_name, document_type, document_number, email, phone, state, city, profession")
      .eq("id", participantId)
      .maybeSingle(),
    admin.from("event_registrations").select("event_day_id").eq("participant_id", participantId),
    admin
      .from("entry_checkins")
      .select("event_day_id, checked_in_at")
      .eq("participant_id", participantId)
      .is("deleted_at", null)
      .order("checked_in_at", { ascending: false }),
  ]);

  if (!participant) {
    notFound();
  }

  const registrations = registrationsData ?? [];
  const checkins = checkinsData ?? [];
  const eventDayIds = [...new Set([...registrations.map((item) => item.event_day_id), ...checkins.map((item) => item.event_day_id)])];
  const eventDays =
    eventDayIds.length > 0
      ? (
          await admin
            .from("event_days")
            .select("id, event_id, date")
            .in("id", eventDayIds)
        ).data ?? []
      : [];
  const eventIds = [...new Set(eventDays.map((item) => item.event_id))];
  const events =
    eventIds.length > 0
      ? (
          await admin
            .from("events")
            .select("id, name, status")
            .in("id", eventIds)
        ).data ?? []
      : [];

  const eventDayById = new Map(eventDays.map((item) => [item.id, item]));
  const registeredEventIds = new Set(
    registrations.map((registration) => eventDayById.get(registration.event_day_id)?.event_id).filter(Boolean)
  );
  const historyByEvent = new Map<string, EventHistory>(
    events.map((event) => [
      event.id,
      {
        id: event.id,
        name: event.name,
        status: event.status,
        registeredDays: [],
        checkins: [],
      },
    ])
  );

  registrations.forEach((registration) => {
    const day = eventDayById.get(registration.event_day_id);
    const history = day ? historyByEvent.get(day.event_id) : null;
    if (day && history) {
      history.registeredDays.push(day.date);
    }
  });
  checkins.forEach((checkin) => {
    const day = eventDayById.get(checkin.event_day_id);
    const history = day ? historyByEvent.get(day.event_id) : null;
    if (history) {
      history.checkins.push(checkin.checked_in_at);
    }
  });

  const history = [...historyByEvent.values()]
    .map((item) => ({
      ...item,
      registeredDays: [...new Set(item.registeredDays)].sort(),
      checkins: [...item.checkins].sort((a, b) => (a > b ? -1 : 1)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const lastCheckin = checkins[0]?.checked_in_at ?? null;

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-xl p-5">
        <Link href="/participantes" className="text-sm font-semibold text-[var(--primary)]">
          ← Voltar para Participantes
        </Link>
        <h1 className="mt-2 font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          {participant.full_name}
        </h1>
        <p className="mt-2 font-mono text-4xl font-black tracking-tight text-[var(--primary)]">
          {participant.participant_number}
        </p>
        <p className="mt-1 text-sm text-muted">{participant.document_type} {participant.document_number}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-[var(--outline-variant)]/40 bg-white p-3">
            <p className="text-xs text-muted">Eventos cadastrados</p>
            <p className="font-headline text-2xl font-bold">{registeredEventIds.size}</p>
          </div>
          <div className="rounded-lg border border-[var(--outline-variant)]/40 bg-white p-3">
            <p className="text-xs text-muted">Check-ins de entrada</p>
            <p className="font-headline text-2xl font-bold">{checkins.length}</p>
          </div>
          <div className="rounded-lg border border-[var(--outline-variant)]/40 bg-white p-3">
            <p className="text-xs text-muted">Desde o último check-in</p>
            <p className="font-headline text-2xl font-bold">{formatDaysSince(lastCheckin)}</p>
          </div>
        </div>
      </div>

      <ParticipantDetailsForm
        participant={{
          id: participant.id,
          fullName: participant.full_name,
          documentType: participant.document_type,
          documentNumber: participant.document_number,
          email: participant.email,
          phone: participant.phone,
          state: participant.state,
          city: participant.city,
          profession: participant.profession,
        }}
      />

      <div className="surface-card rounded-xl p-5">
        <h2 className="font-headline text-xl font-bold text-[var(--foreground)]">Histórico por Evento</h2>
        <p className="mt-1 text-sm text-muted">Eventos arquivados permanecem visíveis no histórico e nos indicadores.</p>
        <div className="mt-4 space-y-3">
          {history.map((event) => (
            <div key={event.id} className="rounded-xl border border-[var(--outline-variant)]/40 bg-white p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">{event.name}</p>
                  <span className="mt-1 inline-flex rounded-full bg-[var(--surface-container)] px-2 py-1 text-xs font-bold uppercase">
                    {event.status}
                  </span>
                </div>
                <Link href={`/events/${event.id}/participants`} className="text-sm font-semibold text-[var(--primary)]">
                  Abrir evento
                </Link>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Dias inscritos</p>
                  <p className="mt-1 text-sm">
                    {event.registeredDays.length
                      ? event.registeredDays.map((day) => formatDateOnly(day)).join(", ")
                      : "Sem inscrição registrada"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Check-ins de entrada</p>
                  <p className="mt-1 text-sm">
                    {event.checkins.length
                      ? event.checkins.map((checkin) => formatSaoPauloDateTime(checkin)).join(", ")
                      : "Sem check-in"}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {!history.length ? <p className="text-sm text-muted">Nenhum evento relacionado a este participante.</p> : null}
        </div>
      </div>
    </section>
  );
}

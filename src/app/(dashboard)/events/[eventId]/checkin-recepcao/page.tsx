import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerEntryCheckinAction } from "@/app/(dashboard)/events/[eventId]/checkin-recepcao/actions";

type ReceptionCheckinPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    q?: string;
    day?: string;
    notice?: string;
    notice_type?: "success" | "error";
  }>;
};

function getDefaultDayId(eventDays: { id: string; date: string }[]) {
  if (!eventDays.length) {
    return "";
  }
  const today = new Date().toISOString().slice(0, 10);
  return eventDays.find((day) => day.date === today)?.id ?? eventDays[0].id;
}

export default async function ReceptionCheckinPage({ params, searchParams }: ReceptionCheckinPageProps) {
  await requireSession(["super_adm", "organizador", "recepcao"]);
  const { eventId } = await params;
  const { q = "", day, notice, notice_type } = await searchParams;
  const admin = createAdminClient();

  const { data: eventDaysData } = await admin
    .from("event_days")
    .select("id, date")
    .eq("event_id", eventId)
    .order("date", { ascending: true });
  const eventDays = eventDaysData ?? [];

  if (!eventDays.length) {
    return (
      <section className="surface-card rounded-xl p-6">
        <h2 className="font-headline text-2xl font-extrabold text-[var(--foreground)]">Check-in Recepção</h2>
        <p className="mt-2 text-sm text-muted">
          Este evento ainda não possui datas. Configure primeiro em{" "}
          <Link href={`/events/${eventId}/settings`} className="font-semibold text-[var(--primary)]">
            Configuração
          </Link>
          .
        </p>
      </section>
    );
  }

  const selectedDayId = eventDays.some((item) => item.id === day) ? String(day) : getDefaultDayId(eventDays);
  const queryText = q.trim();

  const { data: latestCheckinsRaw } = await admin
    .from("entry_checkins")
    .select("id, participant_id, checked_in_at, origin")
    .eq("event_day_id", selectedDayId)
    .is("deleted_at", null)
    .order("checked_in_at", { ascending: false })
    .limit(10);
  const latestCheckins = latestCheckinsRaw ?? [];
  const latestParticipantIds = [...new Set(latestCheckins.map((item) => item.participant_id))];
  const latestParticipants =
    latestParticipantIds.length > 0
      ? (
          await admin
            .from("participants")
            .select("id, full_name, document_type, document_number")
            .in("id", latestParticipantIds)
        ).data ?? []
      : [];
  const latestParticipantMap = new Map(latestParticipants.map((participant) => [participant.id, participant]));

  let searchRows: {
    id: string;
    full_name: string;
    document_type: string;
    document_number: string;
    email: string;
    phone: string;
    registeredOnDay: boolean;
    checkedInOnDay: boolean;
  }[] = [];

  if (queryText.length >= 2) {
    const { data: participantsRaw } = await admin
      .from("participants")
      .select("id, full_name, document_type, document_number, email, phone")
      .or(
        `full_name.ilike.%${queryText}%,document_number.ilike.%${queryText}%,email.ilike.%${queryText}%,phone.ilike.%${queryText}%`
      )
      .limit(20);
    const participants = participantsRaw ?? [];
    const participantIds = participants.map((item) => item.id);

    const registrations =
      participantIds.length > 0
        ? (
            await admin
              .from("event_registrations")
              .select("participant_id")
              .eq("event_day_id", selectedDayId)
              .in("participant_id", participantIds)
          ).data ?? []
        : [];
    const registeredSet = new Set(registrations.map((item) => item.participant_id));

    const checkins =
      participantIds.length > 0
        ? (
            await admin
              .from("entry_checkins")
              .select("participant_id")
              .eq("event_day_id", selectedDayId)
              .is("deleted_at", null)
              .in("participant_id", participantIds)
          ).data ?? []
        : [];
    const checkedSet = new Set(checkins.map((item) => item.participant_id));

    searchRows = participants
      .map((participant) => ({
        ...participant,
        registeredOnDay: registeredSet.has(participant.id),
        checkedInOnDay: checkedSet.has(participant.id),
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
  }

  const returnUrl = `/events/${eventId}/checkin-recepcao?day=${selectedDayId}${queryText ? `&q=${encodeURIComponent(queryText)}` : ""}`;

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-xl p-5">
        <h2 className="font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)]">Check-in Digital (Recepção)</h2>
        <p className="mt-1 text-sm text-muted">Busque pelo documento, confirme a entrada ou inclua no dia e faça check-in.</p>

        {notice ? (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              notice_type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[var(--danger)]"
            }`}
          >
            {notice}
          </p>
        ) : null}

        <form className="mt-4 grid gap-3 md:grid-cols-4">
          <input type="hidden" name="day" value={selectedDayId} />
          <input
            name="q"
            defaultValue={queryText}
            placeholder="Buscar por documento, nome, e-mail ou telefone"
            className="md:col-span-3 rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <button className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white">Buscar</button>
        </form>

        <form className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="q" value={queryText} />
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">Dia do Evento</label>
            <select
              name="day"
              defaultValue={selectedDayId}
              className="mt-1 block rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            >
              {eventDays.map((item) => (
                <option key={item.id} value={item.id}>
                  {new Date(item.date).toLocaleDateString("pt-BR")}
                </option>
              ))}
            </select>
          </div>
          <button className="rounded-xl border border-[var(--outline-variant)]/65 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--foreground)]">
            Trocar dia
          </button>
        </form>
      </div>

      {queryText.length >= 2 ? (
        <div className="surface-card overflow-hidden rounded-xl">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="px-4 py-3">Participante</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Status no Dia</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {searchRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[var(--foreground)]">{row.full_name}</p>
                    <p className="text-xs text-muted">{row.email} | {row.phone}</p>
                  </td>
                  <td className="px-4 py-3">{row.document_type} {row.document_number}</td>
                  <td className="px-4 py-3">
                    {row.checkedInOnDay ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Check-in realizado</span>
                    ) : row.registeredOnDay ? (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">Inscrito no dia</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">Não inscrito no dia</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!row.checkedInOnDay ? (
                      <form action={registerEntryCheckinAction}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="event_day_id" value={selectedDayId} />
                        <input type="hidden" name="participant_id" value={row.id} />
                        <input type="hidden" name="include_day" value={row.registeredOnDay ? "false" : "true"} />
                        <input type="hidden" name="redirect_url" value={returnUrl} />
                        <button className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white hover:brightness-105">
                          {row.registeredOnDay ? "Confirmar Check-in" : "Incluir no dia e Fazer Check-in"}
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs font-semibold text-muted">Sem ação</span>
                    )}
                  </td>
                </tr>
              ))}
              {!searchRows.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">
                    Nenhum participante encontrado para essa busca.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs text-muted">
            Não encontrou o visitante? Cadastre em{" "}
            <Link href={`/events/${eventId}/participants`} className="font-semibold text-[var(--primary)]">
              Participantes
            </Link>
            .
          </p>
        </div>
      ) : null}

      <div className="surface-card rounded-xl p-5">
        <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Últimos Check-ins</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="px-3 py-2">Participante</th>
                <th className="px-3 py-2">Documento</th>
                <th className="px-3 py-2">Hora</th>
                <th className="px-3 py-2">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {latestCheckins.map((item) => {
                const participant = latestParticipantMap.get(item.participant_id);
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{participant?.full_name ?? "Participante"}</td>
                    <td className="px-3 py-2">
                      {participant ? `${participant.document_type} ${participant.document_number}` : "-"}
                    </td>
                    <td className="px-3 py-2">{new Date(item.checked_in_at).toLocaleTimeString("pt-BR")}</td>
                    <td className="px-3 py-2">{item.origin}</td>
                  </tr>
                );
              })}
              {!latestCheckins.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-sm text-muted">
                    Ainda não há check-ins nesse dia.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

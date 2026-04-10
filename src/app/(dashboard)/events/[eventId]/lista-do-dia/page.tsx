import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type DayListPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ day?: string }>;
};

function getDefaultDayId(eventDays: { id: string; date: string }[]) {
  if (!eventDays.length) {
    return "";
  }
  const today = new Date().toISOString().slice(0, 10);
  return eventDays.find((day) => day.date === today)?.id ?? eventDays[0].id;
}

export default async function DayListPage({ params, searchParams }: DayListPageProps) {
  await requireSession(["super_adm", "organizador", "recepcao"]);
  const { eventId } = await params;
  const { day } = await searchParams;
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
        <h2 className="font-headline text-2xl font-extrabold text-[var(--foreground)]">Lista do Dia</h2>
        <p className="mt-2 text-sm text-muted">Este evento ainda não possui datas configuradas.</p>
      </section>
    );
  }

  const selectedDayId = eventDays.some((item) => item.id === day) ? String(day) : getDefaultDayId(eventDays);

  const entryCheckins =
    (
      await admin
        .from("entry_checkins")
        .select("id, participant_id, checked_in_at, origin")
        .eq("event_day_id", selectedDayId)
        .is("deleted_at", null)
    ).data ?? [];

  const standCheckins =
    (
      await admin
        .from("stand_checkins")
        .select("id, participant_id, checked_in_at, event_exhibitor_id")
        .eq("event_day_id", selectedDayId)
        .is("deleted_at", null)
    ).data ?? [];

  const participantIds = [
    ...new Set([
      ...entryCheckins.map((item) => item.participant_id),
      ...standCheckins.map((item) => item.participant_id),
    ]),
  ];
  const participants =
    participantIds.length > 0
      ? (
          await admin
            .from("participants")
            .select("id, full_name, document_type, document_number")
            .in("id", participantIds)
        ).data ?? []
      : [];
  const participantMap = new Map(participants.map((item) => [item.id, item]));

  const eventExhibitorIds = [...new Set(standCheckins.map((item) => item.event_exhibitor_id))];
  const eventExhibitors =
    eventExhibitorIds.length > 0
      ? (
          await admin
            .from("event_exhibitors")
            .select("id, exhibitor_company_id, stand_name")
            .in("id", eventExhibitorIds)
        ).data ?? []
      : [];
  const companyIds = [...new Set(eventExhibitors.map((item) => item.exhibitor_company_id))];
  const companies =
    companyIds.length > 0
      ? (
          await admin
            .from("exhibitor_companies")
            .select("id, name")
            .in("id", companyIds)
        ).data ?? []
      : [];
  const companyMap = new Map(companies.map((item) => [item.id, item.name]));
  const eventExhibitorMap = new Map(
    eventExhibitors.map((item) => [
      item.id,
      {
        standName: item.stand_name,
        companyName: companyMap.get(item.exhibitor_company_id) ?? "Expositor",
      },
    ])
  );

  const rows = [
    ...entryCheckins.map((item) => ({
      id: `entry-${item.id}`,
      participantId: item.participant_id,
      checkedAt: item.checked_in_at,
      type: "Entrada",
      context: item.origin,
      status: "Confirmado",
    })),
    ...standCheckins.map((item) => {
      const exhibitorInfo = eventExhibitorMap.get(item.event_exhibitor_id);
      const standLabel = exhibitorInfo?.standName
        ? `${exhibitorInfo.companyName} (${exhibitorInfo.standName})`
        : exhibitorInfo?.companyName ?? "Stand";
      return {
        id: `stand-${item.id}`,
        participantId: item.participant_id,
        checkedAt: item.checked_in_at,
        type: "Stand",
        context: standLabel,
        status: "Confirmado",
      };
    }),
  ].sort((a, b) => (a.checkedAt < b.checkedAt ? 1 : -1));

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-xl p-5">
        <h2 className="font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)]">Monitoramento em Tempo Real</h2>
        <p className="mt-1 text-sm text-muted">Lista consolidada de check-ins de entrada e stands.</p>

        <form className="mt-4 flex items-end gap-2">
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

      <div className="surface-card rounded-xl p-5">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-[var(--outline-variant)]/45 bg-white p-3">
            <p className="text-xs text-muted">Check-ins Entrada</p>
            <p className="font-headline text-2xl font-bold">{entryCheckins.length}</p>
          </div>
          <div className="rounded-lg border border-[var(--outline-variant)]/45 bg-white p-3">
            <p className="text-xs text-muted">Check-ins Stand</p>
            <p className="font-headline text-2xl font-bold">{standCheckins.length}</p>
          </div>
          <div className="rounded-lg border border-[var(--outline-variant)]/45 bg-white p-3">
            <p className="text-xs text-muted">Total Registros</p>
            <p className="font-headline text-2xl font-bold">{rows.length}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="px-4 py-3">Participante</th>
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Contexto</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {rows.slice(0, 100).map((row) => {
                const participant = participantMap.get(row.participantId);
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{participant?.full_name ?? "Participante"}</p>
                      <p className="text-xs text-muted">
                        {participant ? `${participant.document_type} ${participant.document_number}` : "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3">{new Date(row.checkedAt).toLocaleTimeString("pt-BR")}</td>
                    <td className="px-4 py-3">{row.type}</td>
                    <td className="px-4 py-3">{row.context}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">{row.status}</span>
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">
                    Ainda não há registros neste dia.
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


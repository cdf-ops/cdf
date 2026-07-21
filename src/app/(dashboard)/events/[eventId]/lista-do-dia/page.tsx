import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type DayListPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ day?: string; q?: string }>;
};

type ConsolidatedRow = {
  id: string;
  participantId: string;
  checkedAt: string;
  type: "Entrada" | "Stand";
  context: string;
  kind: "Normal" | "Incluído na Hora" | "Stand";
  status: "Ativo";
};

function getDefaultDayId(eventDays: { id: string; date: string }[]) {
  if (!eventDays.length) {
    return "";
  }
  const today = new Date().toISOString().slice(0, 10);
  return eventDays.find((day) => day.date === today)?.id ?? eventDays[0].id;
}

function getInitials(name?: string) {
  if (!name) {
    return "--";
  }
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) {
    return "--";
  }
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export default async function DayListPage({ params, searchParams }: DayListPageProps) {
  await requireSession(["super_adm", "organizador", "recepcao"]);
  const { eventId } = await params;
  const { day, q = "" } = await searchParams;
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
  const queryText = q.trim().toLowerCase();

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

  const registrations =
    (
      await admin
        .from("event_registrations")
        .select("participant_id")
        .eq("event_day_id", selectedDayId)
    ).data ?? [];

  const participantIds = [
    ...new Set([...entryCheckins.map((item) => item.participant_id), ...standCheckins.map((item) => item.participant_id)]),
  ];
  const participants =
    participantIds.length > 0
      ? (
          await admin
            .from("participants")
            .select("id, participant_number, full_name, document_type, document_number")
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

  const rows: ConsolidatedRow[] = [
    ...entryCheckins.map((item) => ({
      id: `entry-${item.id}`,
      participantId: item.participant_id,
      checkedAt: item.checked_in_at,
      type: "Entrada" as const,
      context: item.origin,
      kind: item.origin === "manual_include_day" ? ("Incluído na Hora" as const) : ("Normal" as const),
      status: "Ativo" as const,
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
        type: "Stand" as const,
        context: standLabel,
        kind: "Stand" as const,
        status: "Ativo" as const,
      };
    }),
  ].sort((a, b) => (a.checkedAt < b.checkedAt ? 1 : -1));

  const expectedParticipants = new Set(registrations.map((item) => item.participant_id)).size;
  const presentParticipants = new Set(entryCheckins.map((item) => item.participant_id)).size;
  const occupancyRate = expectedParticipants > 0 ? Math.round((presentParticipants / expectedParticipants) * 100) : 0;

  const hourlyBuckets = new Set(rows.map((row) => new Date(row.checkedAt).getHours()));
  const checkinsPerHour = rows.length > 0 ? Math.round(rows.length / Math.max(1, hourlyBuckets.size)) : 0;

  const filteredRows = rows.filter((row) => {
    if (!queryText) {
      return true;
    }
    const participant = participantMap.get(row.participantId);
    const searchable = [
      participant?.full_name ?? "",
      String(participant?.participant_number ?? ""),
      participant?.document_type ?? "",
      participant?.document_number ?? "",
      row.type,
      row.context,
      row.kind,
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(queryText);
  });

  const occupancyDelta = occupancyRate - 70;

  return (
    <section className="space-y-6">
      <form className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <input type="hidden" name="q" value={q} />
        <div className="gradient-primary relative overflow-hidden rounded-2xl p-6 text-white">
          <div className="absolute -right-6 -bottom-6 text-[180px] font-headline font-extrabold text-white/10">*</div>
          <p className="font-headline text-3xl font-extrabold tracking-tight">Monitoramento em Tempo Real</p>
          <p className="mt-1 text-sm text-white/85">Contagem oficial de participantes presentes no recinto</p>
          <div className="mt-5 flex items-end gap-3">
            <span className="font-headline text-6xl font-extrabold leading-none">{presentParticipants}</span>
            <span className="pb-1 text-3xl font-medium text-white/85">/ {expectedParticipants} esperados</span>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-[var(--secondary-soft)] transition-all"
              style={{ width: `${Math.min(100, Math.max(0, occupancyRate))}%` }}
            />
          </div>
        </div>

        <div className="grid gap-4">
          <div className="surface-card rounded-2xl p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Taxa de Ocupação</p>
            <div className="mt-2 flex items-center gap-2">
              <p className="font-headline text-4xl font-extrabold text-[var(--primary)]">{occupancyRate}%</p>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
                {occupancyDelta >= 0 ? "+" : ""}
                {occupancyDelta}%
              </span>
            </div>
          </div>

          <div className="surface-card rounded-2xl p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Check-ins/Hora</p>
            <div className="mt-2 flex items-end gap-2">
              <p className="font-headline text-4xl font-extrabold text-[var(--primary)]">{checkinsPerHour}</p>
              <span className="pb-1 text-xs text-muted">média atual</span>
            </div>
          </div>
        </div>
      </form>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h2 className="font-headline text-4xl font-extrabold tracking-tight text-[var(--foreground)]">Últimos Registros</h2>

        <form className="w-full md:max-w-sm">
          <input type="hidden" name="day" value={selectedDayId} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Pesquisar por número, nome ou credencial..."
            className="input-surface w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/10"
          />
        </form>
      </div>

      <div className="surface-card overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-end gap-3 bg-[var(--surface-container-low)] px-4 py-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Dia do Evento</label>
            <select
              name="day"
              defaultValue={selectedDayId}
              className="mt-1 block rounded-lg bg-[var(--surface-container-lowest)] px-3 py-2 text-sm font-semibold outline-none"
            >
              {eventDays.map((item) => (
                <option key={item.id} value={item.id}>
                  {new Date(item.date).toLocaleDateString("pt-BR")}
                </option>
              ))}
            </select>
          </div>
          <button className="ghost-border rounded-lg bg-[var(--surface-container-lowest)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
            Trocar dia
          </button>
        </div>

        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
            <tr>
              <th className="px-4 py-3">Participante</th>
              <th className="px-4 py-3">Hora do Check-in</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-container)]">
            {filteredRows.slice(0, 100).map((row) => {
              const participant = participantMap.get(row.participantId);
              return (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-container-low)] text-xs font-bold text-[var(--primary)]">
                        {getInitials(participant?.full_name)}
                      </span>
                      <div>
                        <p className="font-semibold text-[var(--foreground)]">{participant?.full_name ?? "Participante"}</p>
                        <p className="text-xs text-muted">
                          {participant ? `${participant.participant_number} · ${participant.document_type} ${participant.document_number}` : "-"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{new Date(row.checkedAt).toLocaleTimeString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${
                          row.kind === "Incluído na Hora"
                            ? "bg-blue-100 text-blue-700"
                            : row.kind === "Stand"
                              ? "bg-violet-100 text-violet-700"
                              : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {row.kind}
                      </span>
                      <p className="text-xs text-muted">{row.context}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-600" />
                      {row.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!filteredRows.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">
                  Nenhum registro encontrado para esse filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="flex items-center justify-between bg-[var(--surface-container-low)] px-4 py-3 text-xs text-muted">
          <span>
            Exibindo {Math.min(100, filteredRows.length)} de {rows.length} check-ins
          </span>
          <span>Atualizado em tempo real</span>
        </div>
      </div>
    </section>
  );
}

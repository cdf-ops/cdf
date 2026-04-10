import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerStandCheckinAction } from "@/app/(dashboard)/events/[eventId]/checkin-expositor/actions";

type ExhibitorCheckinPageProps = {
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

export default async function ExhibitorCheckinPage({ params, searchParams }: ExhibitorCheckinPageProps) {
  const session = await requireSession(["expositor"]);
  const { eventId } = await params;
  const { q = "", day, notice, notice_type } = await searchParams;
  const queryText = q.trim();
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
        <h2 className="font-headline text-2xl font-extrabold text-[var(--foreground)]">Check-in Expositor</h2>
        <p className="mt-2 text-sm text-muted">Este evento ainda não possui datas configuradas.</p>
      </section>
    );
  }

  const selectedDayId = eventDays.some((item) => item.id === day) ? String(day) : getDefaultDayId(eventDays);

  const { data: exhibitorUserRows } = await admin
    .from("exhibitor_users")
    .select("exhibitor_company_id")
    .eq("user_id", session.userId);
  const companyIds = (exhibitorUserRows ?? []).map((item) => item.exhibitor_company_id);

  const eventExhibitor =
    companyIds.length > 0
      ? (
          await admin
            .from("event_exhibitors")
            .select("id, exhibitor_company_id, stand_name")
            .eq("event_id", eventId)
            .in("exhibitor_company_id", companyIds)
            .maybeSingle()
        ).data ?? null
      : null;

  const company =
    eventExhibitor
      ? (
          await admin
            .from("exhibitor_companies")
            .select("name")
            .eq("id", eventExhibitor.exhibitor_company_id)
            .maybeSingle()
        ).data ?? null
      : null;

  const latestStandCheckins =
    eventExhibitor
      ? (
          await admin
            .from("stand_checkins")
            .select("id, participant_id, checked_in_at")
            .eq("event_day_id", selectedDayId)
            .eq("event_exhibitor_id", eventExhibitor.id)
            .is("deleted_at", null)
            .order("checked_in_at", { ascending: false })
            .limit(10)
        ).data ?? []
      : [];

  const latestParticipantIds = [...new Set(latestStandCheckins.map((item) => item.participant_id))];
  const latestParticipants =
    latestParticipantIds.length > 0
      ? (
          await admin
            .from("participants")
            .select("id, full_name, document_type, document_number")
            .in("id", latestParticipantIds)
        ).data ?? []
      : [];
  const latestParticipantMap = new Map(latestParticipants.map((item) => [item.id, item]));

  let searchRows: {
    id: string;
    full_name: string;
    document_type: string;
    document_number: string;
    entryCheckin: boolean;
    standCheckin: boolean;
  }[] = [];

  if (eventExhibitor && queryText.length >= 2) {
    const participants =
      (
        await admin
          .from("participants")
          .select("id, full_name, document_type, document_number")
          .or(`full_name.ilike.%${queryText}%,document_number.ilike.%${queryText}%`)
          .limit(20)
      ).data ?? [];
    const participantIds = participants.map((item) => item.id);

    const entryCheckins =
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
    const entrySet = new Set(entryCheckins.map((item) => item.participant_id));

    const standCheckins =
      participantIds.length > 0
        ? (
            await admin
              .from("stand_checkins")
              .select("participant_id")
              .eq("event_day_id", selectedDayId)
              .eq("event_exhibitor_id", eventExhibitor.id)
              .is("deleted_at", null)
              .in("participant_id", participantIds)
          ).data ?? []
        : [];
    const standSet = new Set(standCheckins.map((item) => item.participant_id));

    searchRows = participants
      .map((participant) => ({
        ...participant,
        entryCheckin: entrySet.has(participant.id),
        standCheckin: standSet.has(participant.id),
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
  }

  const returnUrl = `/events/${eventId}/checkin-expositor?day=${selectedDayId}${queryText ? `&q=${encodeURIComponent(queryText)}` : ""}`;

  if (!eventExhibitor || !company) {
    return (
      <section className="surface-card rounded-xl p-6">
        <h2 className="font-headline text-2xl font-extrabold text-[var(--foreground)]">Check-in Expositor</h2>
        <p className="mt-2 text-sm text-[var(--danger)]">
          Seu usuário não está vinculado a um stand deste evento. Peça ao Super-ADM para configurar seu vínculo.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-xl p-5">
        <h2 className="font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)]">Check-in Expositor</h2>
        <p className="mt-1 text-sm text-muted">
          Stand: <span className="font-semibold text-[var(--foreground)]">{company.name}</span>
          {eventExhibitor.stand_name ? ` (${eventExhibitor.stand_name})` : ""}
        </p>
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
            placeholder="Buscar por documento ou nome"
            className="md:col-span-3 rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <button className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white">Buscar</button>
        </form>

        <form className="mt-3 flex items-end gap-2">
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
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {searchRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-semibold">{row.full_name}</td>
                  <td className="px-4 py-3">{row.document_type} {row.document_number}</td>
                  <td className="px-4 py-3">
                    {row.standCheckin ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Já registrado no stand</span>
                    ) : row.entryCheckin ? (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">Elegível (entrada confirmada)</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">Sem check-in de entrada</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!row.standCheckin && row.entryCheckin ? (
                      <form action={registerStandCheckinAction}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="event_day_id" value={selectedDayId} />
                        <input type="hidden" name="participant_id" value={row.id} />
                        <input type="hidden" name="redirect_url" value={returnUrl} />
                        <button className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white hover:brightness-105">
                          Registrar no Stand
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
        </div>
      ) : null}

      <div className="surface-card rounded-xl p-5">
        <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Últimos Registros no Stand</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="px-3 py-2">Participante</th>
                <th className="px-3 py-2">Documento</th>
                <th className="px-3 py-2">Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {latestStandCheckins.map((item) => {
                const participant = latestParticipantMap.get(item.participant_id);
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{participant?.full_name ?? "Participante"}</td>
                    <td className="px-3 py-2">
                      {participant ? `${participant.document_type} ${participant.document_number}` : "-"}
                    </td>
                    <td className="px-3 py-2">{new Date(item.checked_in_at).toLocaleTimeString("pt-BR")}</td>
                  </tr>
                );
              })}
              {!latestStandCheckins.length ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-sm text-muted">
                    Ainda não há registros no stand para esse dia.
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


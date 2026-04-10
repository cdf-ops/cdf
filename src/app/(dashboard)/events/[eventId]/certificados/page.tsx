import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueCertificateAction } from "@/app/(dashboard)/events/[eventId]/certificados/actions";

type CertificatesPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    day?: string;
    q?: string;
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

export default async function CertificatesPage({ params, searchParams }: CertificatesPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const { eventId } = await params;
  const { day, q = "", notice, notice_type } = await searchParams;
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
        <h2 className="font-headline text-2xl font-extrabold text-[var(--foreground)]">Gestão de Certificados</h2>
        <p className="mt-2 text-sm text-muted">Configure datas no evento para liberar emissão de certificados.</p>
      </section>
    );
  }

  const selectedDayId = eventDays.some((item) => item.id === day) ? String(day) : getDefaultDayId(eventDays);
  const returnUrl = `/events/${eventId}/certificados?day=${selectedDayId}${queryText ? `&q=${encodeURIComponent(queryText)}` : ""}`;

  const { data: entryCheckinsData } = await admin
    .from("entry_checkins")
    .select("participant_id")
    .eq("event_day_id", selectedDayId)
    .is("deleted_at", null);
  const eligibleIds = [...new Set((entryCheckinsData ?? []).map((item) => item.participant_id))];

  const participants =
    eligibleIds.length > 0
      ? (
          await admin
            .from("participants")
            .select("id, full_name, document_type, document_number")
            .in("id", eligibleIds)
            .or(queryText ? `full_name.ilike.%${queryText}%,document_number.ilike.%${queryText}%` : "id.not.is.null")
        ).data ?? []
      : [];

  const certificates =
    participants.length > 0
      ? (
          await admin
            .from("certificates")
            .select("id, participant_id, issued_at")
            .eq("event_day_id", selectedDayId)
            .in(
              "participant_id",
              participants.map((item) => item.id)
            )
        ).data ?? []
      : [];
  const certificateMap = new Map(certificates.map((item) => [item.participant_id, item]));

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-xl p-5">
        <h2 className="font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)]">Gestão de Certificados</h2>
        <p className="mt-1 text-sm text-muted">Emissão manual, um a um, para participantes elegíveis.</p>

        {notice ? (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              notice_type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[var(--danger)]"
            }`}
          >
            {notice}
          </p>
        ) : null}

        <form className="mt-4 grid gap-3 md:grid-cols-5">
          <input type="hidden" name="day" value={selectedDayId} />
          <input
            name="q"
            defaultValue={queryText}
            placeholder="Buscar participante"
            className="md:col-span-3 rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <select
            name="day"
            defaultValue={selectedDayId}
            className="rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          >
            {eventDays.map((item) => (
              <option key={item.id} value={item.id}>
                {new Date(item.date).toLocaleDateString("pt-BR")}
              </option>
            ))}
          </select>
          <button className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white">Aplicar</button>
        </form>
      </div>

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
            {participants
              .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"))
              .map((participant) => {
                const certificate = certificateMap.get(participant.id);
                return (
                  <tr key={participant.id}>
                    <td className="px-4 py-3 font-semibold">{participant.full_name}</td>
                    <td className="px-4 py-3">{participant.document_type} {participant.document_number}</td>
                    <td className="px-4 py-3">
                      {certificate ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
                          Emitido ({new Date(certificate.issued_at).toLocaleString("pt-BR")})
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">Pendente</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={issueCertificateAction}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="event_day_id" value={selectedDayId} />
                        <input type="hidden" name="participant_id" value={participant.id} />
                        <input type="hidden" name="redirect_url" value={returnUrl} />
                        <button className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white">
                          {certificate ? "Reemitir" : "Emitir Certificado"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            {!participants.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">
                  Nenhum participante elegível neste dia.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}


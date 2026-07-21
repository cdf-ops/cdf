import { requireSession } from "@/lib/auth/session";
import { createAssetSignedUrl } from "@/lib/certificates/assets";
import { parseParticipantNumberSearch } from "@/lib/participants/number";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueCertificateAction } from "@/app/(dashboard)/events/[eventId]/certificados/actions";
import { CopyLinkButton } from "@/app/(dashboard)/events/[eventId]/inscricoes/copy-link-button";

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
  const searchedParticipantNumber = parseParticipantNumberSearch(queryText);
  const admin = createAdminClient();

  const { data: eventDaysData } = await admin
    .from("event_days")
    .select("id, date")
    .eq("event_id", eventId)
    .order("date", { ascending: true });
  const { data: certificateSettings } = await admin
    .from("event_certificate_settings")
    .select("background_path")
    .eq("event_id", eventId)
    .maybeSingle();
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
  const publicCertificateLink = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/certificado/${eventId}`;

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
            .select("id, participant_number, full_name, document_type, document_number")
            .in("id", eligibleIds)
            .or(
              queryText
                ? `${searchedParticipantNumber ? `participant_number.eq.${searchedParticipantNumber},` : ""}full_name.ilike.%${queryText}%,document_number.ilike.%${queryText}%`
                : "id.not.is.null"
            )
        ).data ?? []
      : [];

  const certificates =
    participants.length > 0
      ? (
          await admin
            .from("certificates")
            .select("id, participant_id, issued_at, pdf_url")
            .eq("event_day_id", selectedDayId)
            .in(
              "participant_id",
              participants.map((item) => item.id)
            )
        ).data ?? []
      : [];
  const certificateUrls = new Map(
    await Promise.all(
      certificates.map(async (item) => [item.id, await createAssetSignedUrl(admin, item.pdf_url)] as const)
    )
  );
  const certificateMap = new Map(certificates.map((item) => [item.participant_id, item]));

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-xl p-5">
        <h2 className="font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)]">Gestão de Certificados</h2>
        <p className="mt-1 text-sm text-muted">Emissão manual, um a um, para participantes elegíveis.</p>
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[var(--outline-variant)]/35 bg-[var(--surface-container-low)] p-4 md:flex-row md:items-center md:justify-between">
          <p className="break-all text-sm text-muted">{publicCertificateLink}</p>
          <div className="flex shrink-0 flex-wrap gap-2">
            <CopyLinkButton url={publicCertificateLink} />
            <a
              href={publicCertificateLink}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Visualizar página pública
            </a>
          </div>
        </div>

        {notice ? (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              notice_type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[var(--danger)]"
            }`}
          >
            {notice}
          </p>
        ) : null}

        {!certificateSettings?.background_path ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Configure o layout e o background do certificado antes de emitir PDFs.
          </p>
        ) : null}

        <form className="mt-4 grid gap-3 md:grid-cols-5">
          <input type="hidden" name="day" value={selectedDayId} />
          <input
            name="q"
            defaultValue={queryText}
            placeholder="Buscar por número, nome ou documento"
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
              <th className="px-4 py-3">Número</th>
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
                    <td className="px-4 py-3 font-mono text-lg font-black text-[var(--primary)]">
                      {participant.participant_number}
                    </td>
                    <td className="px-4 py-3 font-semibold">{participant.full_name}</td>
                    <td className="px-4 py-3">{participant.document_type} {participant.document_number}</td>
                    <td className="px-4 py-3">
                      {certificate ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
                            Emitido ({new Date(certificate.issued_at).toLocaleString("pt-BR")})
                          </span>
                          {certificateUrls.get(certificate.id) ? (
                            <a
                              href={certificateUrls.get(certificate.id) ?? undefined}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-bold text-[var(--primary)]"
                            >
                              Abrir PDF
                            </a>
                          ) : null}
                        </div>
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
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">
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

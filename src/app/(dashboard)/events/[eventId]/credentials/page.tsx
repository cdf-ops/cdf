import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateBadgeAction } from "@/app/(dashboard)/events/[eventId]/credentials/actions";

type CredentialsPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function CredentialsPage({ params, searchParams }: CredentialsPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const { eventId } = await params;
  const { q = "" } = await searchParams;
  const admin = createAdminClient();

  const { data: rawEventDays } = await admin.from("event_days").select("id").eq("event_id", eventId);
  const eventDays = rawEventDays ?? [];
  const registrations =
    eventDays.length > 0
      ? (
          await admin
            .from("event_registrations")
            .select("participant_id")
            .in(
              "event_day_id",
              eventDays.map((day) => day.id)
            )
        ).data ?? []
      : [];

  const participantIds = [...new Set(registrations.map((registration) => registration.participant_id))];
  let participants: {
    id: string;
    full_name: string;
    document_type: string;
    document_number: string;
    email: string;
  }[] = [];

  if (participantIds.length) {
    const { data } = await admin
      .from("participants")
      .select("id, full_name, document_type, document_number, email")
      .in("id", participantIds)
      .or(
        q
          ? `full_name.ilike.%${q}%,document_number.ilike.%${q}%,email.ilike.%${q}%`
          : "id.not.is.null"
      );
    participants = data ?? [];
  }

  const { data: rawBadges } = await admin
    .from("badges")
    .select("id, participant_id, generated_at, qr_slug")
    .eq("event_id", eventId);
  const badges = rawBadges ?? [];

  const badgeByParticipant = new Map(badges.map((badge) => [badge.participant_id, badge]));

  return (
    <section className="surface-card rounded-xl p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)]">Painel de Credenciais</h2>
        <form className="w-full max-w-sm">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar participante"
            className="w-full rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
            <tr>
              <th className="px-4 py-3">Participante</th>
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">Status da Credencial</th>
              <th className="px-4 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-container)]">
            {participants
              .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"))
              .map((participant) => {
                const badge = badgeByParticipant.get(participant.id);
                return (
                  <tr key={participant.id} className="hover:bg-[var(--surface-container-low)]/70">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{participant.full_name}</p>
                      <p className="text-xs text-muted">{participant.email}</p>
                    </td>
                    <td className="px-4 py-3">{participant.document_type + " " + participant.document_number}</td>
                    <td className="px-4 py-3">
                      {badge ? (
                        <div>
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
                            Gerada
                          </span>
                          <p className="mt-1 text-xs text-muted">
                            {new Date(badge.generated_at).toLocaleString("pt-BR")} | QR: {badge.qr_slug}
                          </p>
                        </div>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">Pendente</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={generateBadgeAction}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="participant_id" value={participant.id} />
                        <button
                          type="submit"
                          className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white hover:brightness-105"
                        >
                          {badge ? "Reemitir" : "Gerar Credencial"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            {!participants.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">
                  Nenhum participante encontrado para geração de credencial.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

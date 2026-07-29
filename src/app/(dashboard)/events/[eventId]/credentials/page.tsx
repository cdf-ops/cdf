import Form from "next/form";
import { requireSession } from "@/lib/auth/session";
import { parseParticipantNumberSearch } from "@/lib/participants/number";
import { resolveBadgeSettings } from "@/lib/badges/settings";
import { formatSaoPauloDateTime } from "@/lib/date-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { SubmitButton } from "@/components/submit-button";
import {
  generateBadgeAction,
  saveBadgeSettingsAction,
} from "@/app/(dashboard)/events/[eventId]/credentials/actions";

type CredentialsPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function CredentialsPage({ params, searchParams }: CredentialsPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const { eventId } = await params;
  const { q = "" } = await searchParams;
  const searchedParticipantNumber = parseParticipantNumberSearch(q);
  const admin = createAdminClient();

  const [{ data: event }, { data: rawEventDays }, { data: storedSettings }] = await Promise.all([
    admin.from("events").select("id, name, location").eq("id", eventId).maybeSingle(),
    admin.from("event_days").select("id").eq("event_id", eventId),
    admin.from("event_badge_settings").select("*").eq("event_id", eventId).maybeSingle(),
  ]);
  if (!event) return null;
  const settings = resolveBadgeSettings(storedSettings);
  const eventDays = rawEventDays ?? [];
  const registrations =
    eventDays.length > 0
      ? (
          await admin
            .from("event_registrations")
            .select("participant_id")
            .in("event_day_id", eventDays.map((day) => day.id))
        ).data ?? []
      : [];

  const participantIds = [...new Set(registrations.map((registration) => registration.participant_id))];
  let participants: {
    id: string;
    participant_number: number;
    full_name: string;
    document_type: string;
    document_number: string;
    email: string;
  }[] = [];

  if (participantIds.length) {
    const participantNumberFilter = searchedParticipantNumber ? `participant_number.eq.${searchedParticipantNumber},` : "";
    const { data } = await admin
      .from("participants")
      .select("id, participant_number, full_name, document_type, document_number, email")
      .in("id", participantIds)
      .or(q ? `${participantNumberFilter}full_name.ilike.%${q}%,document_number.ilike.%${q}%,email.ilike.%${q}%` : "id.not.is.null");
    participants = data ?? [];
  }

  const { data: rawBadges } = await admin
    .from("badges")
    .select("id, participant_id, generated_at, download_slug, last_printed_at, print_count")
    .eq("event_id", eventId);
  const badgeByParticipant = new Map((rawBadges ?? []).map((badge) => [badge.participant_id, badge]));
  const sortedParticipants = participants.sort((a, b) => {
    if (searchedParticipantNumber) {
      const aExact = a.participant_number === searchedParticipantNumber ? 1 : 0;
      const bExact = b.participant_number === searchedParticipantNumber ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
    }
    return a.full_name.localeCompare(b.full_name, "pt-BR");
  });

  return (
    <section className="space-y-6">
      <details className="surface-card rounded-2xl p-5">
        <summary className="cursor-pointer font-headline text-xl font-extrabold tracking-tight text-[var(--foreground)]">
          Personalizar modelo A4 dobrável
        </summary>
        <p className="mt-2 text-sm text-muted">
          As quatro áreas são preservadas. Nome, número e QR de check-in são preenchidos automaticamente.
        </p>
        <form action={saveBadgeSettingsAction} className="mt-5 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="event_id" value={eventId} />
          <label className="text-sm font-semibold text-[var(--foreground)]">
            Cidade em destaque
            <input name="city_label" defaultValue={settings.city_label ?? event.location} className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-semibold text-[var(--foreground)]">
              Cor principal
              <input name="primary_color" type="color" defaultValue={settings.primary_color} className="mt-1.5 h-12 w-full rounded-xl border bg-white p-1" />
            </label>
            <label className="text-sm font-semibold text-[var(--foreground)]">
              Cor de fundo
              <input name="secondary_color" type="color" defaultValue={settings.secondary_color} className="mt-1.5 h-12 w-full rounded-xl border bg-white p-1" />
            </label>
          </div>
          <label className="text-sm font-semibold text-[var(--foreground)] md:col-span-2">
            Texto institucional
            <textarea name="institutional_text" rows={4} defaultValue={settings.institutional_text ?? ""} className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-[var(--foreground)] md:col-span-2">
            Programação resumida
            <textarea name="schedule_text" rows={5} defaultValue={settings.schedule_text ?? ""} className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal" placeholder="19, 20 e 21 de agosto - 18h às 22h30" />
          </label>
          <label className="text-sm font-semibold text-[var(--foreground)] md:col-span-2">
            Link do QR de redes sociais
            <input name="social_url" type="url" defaultValue={settings.social_url ?? ""} className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-mono font-normal" />
          </label>
          <label className="text-sm font-semibold text-[var(--foreground)]">
            Facebook
            <input name="facebook_label" defaultValue={settings.facebook_label ?? ""} className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-[var(--foreground)]">
            Instagram
            <input name="instagram_label" defaultValue={settings.instagram_label ?? ""} className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-[var(--foreground)]">
            YouTube
            <input name="youtube_label" defaultValue={settings.youtube_label ?? ""} className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-[var(--foreground)]">
            Link do QR de certificado
            <input name="certificate_url" type="url" defaultValue={settings.certificate_url ?? ""} className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-mono font-normal" placeholder="Usa a página de certificados quando vazio" />
          </label>
          <div className="md:col-span-2 flex justify-end">
            <SubmitButton pendingLabel="Salvando..." className="gradient-primary rounded-xl px-5 py-2.5 text-sm font-semibold text-white">
              Salvar modelo
            </SubmitButton>
          </div>
        </form>
      </details>

      <div className="surface-card rounded-xl p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)]">Credenciais dos participantes</h2>
            <p className="mt-1 text-sm text-muted">Selecione pessoas ou deixe tudo desmarcado para gerar o evento inteiro.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Form action={`/events/${eventId}/credentials`} scroll={false} className="flex w-full max-w-md gap-2">
              <input name="q" defaultValue={q} placeholder="Buscar por número, nome ou documento" className="w-full rounded-xl border bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]" />
              <SubmitButton pendingLabel="Buscando..." className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold">
                Buscar
              </SubmitButton>
            </Form>
            <form id="batch-credentials-form" method="post" action={`/api/events/${eventId}/credentials`}>
              <button className="gradient-primary whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold text-white">Baixar PDF para impressão</button>
            </form>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="px-4 py-3">Selecionar</th>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Participante</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {sortedParticipants.map((participant) => {
                const badge = badgeByParticipant.get(participant.id);
                return (
                  <tr key={participant.id} className="hover:bg-[var(--surface-container-low)]/70">
                    <td className="px-4 py-3">
                      <input type="checkbox" name="participant_ids" value={participant.id} form="batch-credentials-form" aria-label={`Selecionar ${participant.full_name}`} />
                    </td>
                    <td className="px-4 py-3 font-mono text-lg font-black text-[var(--primary)]">{participant.participant_number}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{participant.full_name}</p>
                      <p className="text-xs text-muted">{participant.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {badge ? (
                        <div>
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Gerada</span>
                          <p className="mt-1 text-xs text-muted">
                            {badge.last_printed_at ? `Impressa em ${formatSaoPauloDateTime(badge.last_printed_at)}` : "Ainda não impressa"}
                          </p>
                        </div>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">Pendente</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {badge ? (
                        <a href={`/api/events/${eventId}/credentials/${participant.id}`} className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white">Baixar PDF</a>
                      ) : (
                        <form action={generateBadgeAction}>
                          <input type="hidden" name="event_id" value={eventId} />
                          <input type="hidden" name="participant_id" value={participant.id} />
                          <SubmitButton
                            pendingLabel="Gerando..."
                            className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white"
                          >
                            Gerar credencial
                          </SubmitButton>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!sortedParticipants.length ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">Nenhum participante encontrado.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

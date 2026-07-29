import { notFound } from "next/navigation";
import { EventForm } from "@/app/(dashboard)/events/_components/event-form";
import { restoreEventAction, updateEventAction } from "@/app/(dashboard)/events/actions";
import { ArchiveEventForm } from "@/app/(dashboard)/events/[eventId]/settings/archive-event-form";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth/session";
import { createAssetSignedUrl } from "@/lib/certificates/assets";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateExhibitorDataSettingsAction } from "@/app/(dashboard)/events/[eventId]/settings/exhibitor-data-actions";
import { getExhibitorDataSettings } from "@/lib/exhibitors/data-sharing";

type EventSettingsPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    notice?: string;
    notice_type?: "success" | "error";
  }>;
};

type EventSettingsItem = {
  id: string;
  name: string;
  location: string;
  details: string | null;
  status: "rascunho" | "ativo" | "encerrado" | "arquivado";
  event_logo_path: string | null;
  event_days: { date: string }[] | null;
};

export default async function EventSettingsPage({ params, searchParams }: EventSettingsPageProps) {
  const session = await requireSession(["super_adm", "organizador"]);
  const { eventId } = await params;
  const { notice, notice_type } = await searchParams;

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, location, details, status, event_logo_path, event_days(date)")
    .eq("id", eventId)
    .maybeSingle();

  const typedEvent = event as EventSettingsItem | null;

  if (!typedEvent) {
    notFound();
  }

  const admin = createAdminClient();
  const [logoUrl, exhibitorDataSettings] = await Promise.all([
    createAssetSignedUrl(admin, typedEvent.event_logo_path),
    getExhibitorDataSettings(admin, typedEvent.id),
  ]);

  return (
    <section>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--outline)]">Configurações do Evento</p>
        <h1 className="mt-1 font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          {typedEvent.name}
        </h1>
      </div>

      {notice ? (
        <p
          className={`mb-6 rounded-xl px-4 py-3 text-sm ${
            notice_type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[var(--danger)]"
          }`}
        >
          {notice}
        </p>
      ) : null}

      {typedEvent.status === "arquivado" ? (
        <div className="surface-card rounded-2xl p-6 md:p-8">
          <h2 className="font-headline text-xl font-bold text-[var(--foreground)]">Evento arquivado</h2>
          <p className="mt-2 text-sm text-muted">
            O histórico foi preservado e o evento não aparece mais na operação diária.
          </p>
          {session.role === "super_adm" ? (
            <form action={restoreEventAction} className="mt-5">
              <input type="hidden" name="event_id" value={typedEvent.id} />
              <SubmitButton pendingLabel="Restaurando..." className="gradient-primary rounded-xl px-5 py-2.5 text-sm font-semibold text-white">
                Restaurar como rascunho
              </SubmitButton>
            </form>
          ) : null}
        </div>
      ) : (
        <>
          <EventForm
            mode="update"
            action={updateEventAction}
            initialData={{
              id: typedEvent.id,
              name: typedEvent.name,
              location: typedEvent.location,
              status: typedEvent.status,
              details: typedEvent.details,
              eventLogoUrl: logoUrl,
              dates: (typedEvent.event_days ?? []).map((day) => day.date),
            }}
          />
          {session.role === "super_adm" ? (
            <div className="surface-card mt-6 rounded-2xl p-6 md:p-8">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-wide text-[var(--outline)]">
                  Privacidade e Expositores
                </p>
                <h2 className="mt-1 font-headline text-2xl font-extrabold text-[var(--foreground)]">
                  Dados liberados após a visita ao stand
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Nome e número único são o padrão. Os campos abaixo somente aparecem quando o participante
                  autorizou dados adicionais no formulário. CPF e outros documentos nunca são compartilhados.
                </p>
              </div>
              <form action={updateExhibitorDataSettingsAction} className="mt-5">
                <input type="hidden" name="event_id" value={typedEvent.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["share_email", "E-mail", exhibitorDataSettings.share_email],
                    ["share_phone", "Telefone", exhibitorDataSettings.share_phone],
                    ["share_profession", "Profissão", exhibitorDataSettings.share_profession],
                    ["share_city", "Cidade", exhibitorDataSettings.share_city],
                    ["share_state", "Estado", exhibitorDataSettings.share_state],
                  ].map(([name, label, checked]) => (
                    <label
                      key={String(name)}
                      className="flex items-center gap-3 rounded-xl border border-[var(--outline-variant)]/45 bg-white p-4 text-sm font-semibold"
                    >
                      <input
                        type="checkbox"
                        name={String(name)}
                        defaultChecked={Boolean(checked)}
                        className="h-5 w-5 accent-[var(--primary)]"
                      />
                      {String(label)}
                    </label>
                  ))}
                </div>
                <SubmitButton
                  pendingLabel="Salvando..."
                  className="gradient-primary mt-5 rounded-xl px-5 py-3 text-sm font-semibold text-white"
                >
                  Salvar permissões
                </SubmitButton>
              </form>
            </div>
          ) : null}
          {session.role === "super_adm" ? <ArchiveEventForm eventId={typedEvent.id} eventName={typedEvent.name} /> : null}
        </>
      )}
    </section>
  );
}

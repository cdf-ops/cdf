import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { parseBadgeLayout } from "@/lib/badges/layout";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAssetSignedUrl } from "@/lib/certificates/assets";
import { BadgeLayoutEditor } from "@/app/(dashboard)/events/[eventId]/credentials/badge-layout-editor";
import { saveBadgeLayoutAction } from "@/app/(dashboard)/events/[eventId]/credentials/actions";

type CredentialsPageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function CredentialsPage({ params }: CredentialsPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const { eventId } = await params;
  const admin = createAdminClient();

  const [{ data: event }, { data: storedSettings }] = await Promise.all([
    admin.from("events").select("id, name, location").eq("id", eventId).maybeSingle(),
    admin.from("event_badge_settings").select("*").eq("event_id", eventId).maybeSingle(),
  ]);
  if (!event) return null;
  const backgroundUrl = await createAssetSignedUrl(admin, storedSettings?.background_path);

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-2xl p-5">
        <h2 className="font-headline text-xl font-extrabold tracking-tight text-[var(--foreground)]">Configuração da credencial A4 compartilhada</h2>
        <p className="mt-2 text-sm text-muted">
          A mesma arte atende participantes e patrocinadores. A geração e a impressão das credenciais dos participantes ficam na lista de Participantes deste evento.
        </p>
        <Link
          href={`/events/${eventId}/participants`}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-[var(--outline-variant)]/60 bg-white px-4 text-sm font-bold text-[var(--primary)] hover:bg-[var(--surface-container-low)]"
        >
          Ir para participantes
        </Link>
        <div className="mt-5">
          <BadgeLayoutEditor
            eventId={eventId}
            initialLayout={parseBadgeLayout(storedSettings?.layout)}
            backgroundUrl={backgroundUrl}
            participantLabel={storedSettings?.participant_label ?? "PARTICIPANTE"}
            sponsorLabel={storedSettings?.sponsor_label ?? "PATROCINADOR"}
            action={saveBadgeLayoutAction}
          />
        </div>
      </div>
    </section>
  );
}

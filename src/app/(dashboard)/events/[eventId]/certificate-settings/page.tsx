import { notFound } from "next/navigation";
import { CertificateLayoutEditor } from "@/app/(dashboard)/events/[eventId]/certificate-settings/certificate-layout-editor";
import { saveCertificateSettingsAction } from "@/app/(dashboard)/events/[eventId]/certificate-settings/actions";
import { requireSession } from "@/lib/auth/session";
import { createAssetSignedUrl } from "@/lib/certificates/assets";
import { parseCertificateLayout } from "@/lib/certificates/layout";
import { createAdminClient } from "@/lib/supabase/admin";

type CertificateSettingsPageProps = {
  params: Promise<{ eventId: string }>;
};

type CertificateSettingsEvent = {
  id: string;
  name: string;
  event_logo_path: string | null;
  event_days: { date: string }[] | null;
};

export default async function CertificateSettingsPage({ params }: CertificateSettingsPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const { eventId } = await params;
  const admin = createAdminClient();

  const { data: eventData } = await admin
    .from("events")
    .select("id, name, event_logo_path, event_days(date)")
    .eq("id", eventId)
    .maybeSingle();
  const event = eventData as CertificateSettingsEvent | null;

  if (!event) {
    notFound();
  }

  const { data: settings } = await admin
    .from("event_certificate_settings")
    .select("background_path, sponsor_image_path, layout")
    .eq("event_id", eventId)
    .maybeSingle();

  const [eventLogoUrl, backgroundUrl, sponsorImageUrl] = await Promise.all([
    createAssetSignedUrl(admin, event.event_logo_path),
    createAssetSignedUrl(admin, settings?.background_path),
    createAssetSignedUrl(admin, settings?.sponsor_image_path),
  ]);

  const firstEventDate = [...(event.event_days ?? [])].sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? "";

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--outline)]">Configuração Certificado</p>
        <h1 className="mt-1 font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">{event.name}</h1>
      </div>

      <CertificateLayoutEditor
        eventId={eventId}
        eventName={event.name}
        eventDate={firstEventDate}
        initialLayout={parseCertificateLayout(settings?.layout)}
        action={saveCertificateSettingsAction}
        eventLogoUrl={eventLogoUrl}
        backgroundUrl={backgroundUrl}
        sponsorImageUrl={sponsorImageUrl}
      />
    </section>
  );
}

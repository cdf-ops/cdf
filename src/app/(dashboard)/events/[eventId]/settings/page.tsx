import { notFound } from "next/navigation";
import { EventForm } from "@/app/(dashboard)/events/_components/event-form";
import { updateEventAction } from "@/app/(dashboard)/events/actions";
import { requireSession } from "@/lib/auth/session";
import { createAssetSignedUrl } from "@/lib/certificates/assets";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type EventSettingsPageProps = {
  params: Promise<{ eventId: string }>;
};

type EventSettingsItem = {
  id: string;
  name: string;
  location: string;
  details: string | null;
  status: "rascunho" | "ativo" | "encerrado";
  event_logo_path: string | null;
  event_days: { date: string }[] | null;
};

export default async function EventSettingsPage({ params }: EventSettingsPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const { eventId } = await params;

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
  const logoUrl = await createAssetSignedUrl(admin, typedEvent.event_logo_path);

  return (
    <section>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--outline)]">Configurações do Evento</p>
        <h1 className="mt-1 font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          {typedEvent.name}
        </h1>
      </div>

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
    </section>
  );
}

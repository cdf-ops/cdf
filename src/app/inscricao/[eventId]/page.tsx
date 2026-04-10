import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublicRegistrationForm } from "@/app/inscricao/[eventId]/public-registration-form";

type PublicRegistrationPageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function PublicRegistrationPage({ params }: PublicRegistrationPageProps) {
  const { eventId } = await params;
  const admin = createAdminClient();

  const { data: event } = await admin.from("events").select("id, name, location, status").eq("id", eventId).maybeSingle();
  if (!event) {
    notFound();
  }

  const { data: rawEventDays } = await admin
    .from("event_days")
    .select("id, date")
    .eq("event_id", event.id)
    .order("date", { ascending: true });
  const eventDays = rawEventDays ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">Clube do Frio</p>
        <h1 className="mt-1 font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">{event.name}</h1>
        <p className="mt-2 text-sm text-muted">
          Local: {event.location} | Status: {event.status}
        </p>
      </div>

      <PublicRegistrationForm eventId={event.id} eventDays={eventDays} />
    </main>
  );
}

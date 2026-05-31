import { notFound } from "next/navigation";
import { PublicRegistrationForm } from "@/app/inscricao/[eventId]/public-registration-form";
import { createAdminClient } from "@/lib/supabase/admin";

type RegistrationPageContentProps = {
  eventId: string;
  embedded?: boolean;
};

export async function RegistrationPageContent({ eventId, embedded = false }: RegistrationPageContentProps) {
  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select("id, name, location, status")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    notFound();
  }

  const { data: rawEventDays } = await admin
    .from("event_days")
    .select("id, date")
    .eq("event_id", event.id)
    .order("date", { ascending: true });
  const eventDays = rawEventDays ?? [];
  const isRegistrationOpen = event.status === "ativo";

  return (
    <main className={`mx-auto w-full max-w-3xl px-4 ${embedded ? "py-4" : "py-10"}`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">Clube do Frio</p>
        <h1 className={`${embedded ? "text-2xl" : "text-3xl"} mt-1 font-headline font-extrabold tracking-tight text-[var(--foreground)]`}>
          {event.name}
        </h1>
        <p className="mt-2 text-sm text-muted">Local: {event.location}</p>
      </div>

      {isRegistrationOpen ? (
        <PublicRegistrationForm eventId={event.id} eventDays={eventDays} embedded={embedded} />
      ) : (
        <div className="surface-card mt-6 rounded-2xl p-6">
          <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">Inscrições indisponíveis</h2>
          <p className="mt-2 text-sm text-muted">Este evento não está recebendo inscrições no momento.</p>
        </div>
      )}
    </main>
  );
}

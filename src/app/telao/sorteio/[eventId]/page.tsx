import { requireSession } from "@/lib/auth/session";
import { getSaoPauloDateKey } from "@/lib/date-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { RaffleStage } from "@/app/telao/sorteio/[eventId]/raffle-stage";

type RaffleTeleprompterPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ day?: string }>;
};

function getDefaultDayId(eventDays: { id: string; date: string }[]) {
  if (!eventDays.length) {
    return "";
  }
  const today = getSaoPauloDateKey();
  return eventDays.find((day) => day.date === today)?.id ?? eventDays[0].id;
}

export default async function RaffleTeleprompterPage({ params, searchParams }: RaffleTeleprompterPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const { eventId } = await params;
  const { day } = await searchParams;
  const admin = createAdminClient();

  const { data: eventDaysData } = await admin
    .from("event_days")
    .select("id, date")
    .eq("event_id", eventId)
    .order("date", { ascending: true });
  const eventDays = eventDaysData ?? [];
  const selectedDayId = eventDays.some((item) => item.id === day) ? String(day) : getDefaultDayId(eventDays);
  const selectedDay = eventDays.find((item) => item.id === selectedDayId);

  const [{ data: event }, { data: entryCheckinsData }] = await Promise.all([
    admin.from("events").select("name").eq("id", eventId).maybeSingle(),
    selectedDayId
      ? admin.from("entry_checkins").select("participant_id").eq("event_day_id", selectedDayId).is("deleted_at", null)
      : Promise.resolve({ data: [] as { participant_id: string }[] }),
  ]);
  const eligibleCount = [...new Set((entryCheckinsData ?? []).map((item) => item.participant_id))].length;

  if (!selectedDayId || !selectedDay) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <div className="surface-card max-w-lg rounded-2xl p-8 text-center">
          <h1 className="font-headline text-3xl font-extrabold text-[var(--foreground)]">Evento sem data configurada</h1>
          <p className="mt-2 text-sm text-muted">Configure uma data no evento antes de abrir o telão do sorteio.</p>
        </div>
      </main>
    );
  }

  return (
    <RaffleStage
      eventId={eventId}
      eventDayId={selectedDayId}
      eventName={event?.name ?? "Evento"}
      eventDate={selectedDay.date}
      eligibleCount={eligibleCount}
    />
  );
}

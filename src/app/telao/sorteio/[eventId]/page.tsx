import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type RaffleTeleprompterPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ day?: string }>;
};

function getDefaultDayId(eventDays: { id: string; date: string }[]) {
  if (!eventDays.length) {
    return "";
  }
  const today = new Date().toISOString().slice(0, 10);
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

  const { data: event } = await admin.from("events").select("name").eq("id", eventId).maybeSingle();
  const { data: raffle } = await admin
    .from("raffles")
    .select("id, prize_description, executed_at, deleted_at")
    .eq("event_day_id", selectedDayId)
    .is("deleted_at", null)
    .order("executed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const winnerIds =
    raffle
      ? [
          ...new Set(
            (
              await admin
                .from("raffle_winners")
                .select("participant_id")
                .eq("raffle_id", raffle.id)
            ).data?.map((item) => item.participant_id) ?? []
          ),
        ]
      : [];
  const { data: winners } =
    winnerIds.length > 0
      ? await admin
          .from("participants")
          .select("id, full_name")
          .in("id", winnerIds)
      : { data: [] as { id: string; full_name: string }[] };
  const winnerMap = new Map((winners ?? []).map((item) => [item.id, item]));

  return (
    <main className="min-h-screen bg-[#0b1220] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/80">Modo Telão</p>
        <h1 className="mt-2 font-headline text-5xl font-extrabold tracking-tight">{event?.name ?? "Evento"}</h1>
        <p className="mt-2 text-lg text-cyan-100/80">
          Sorteio do dia{" "}
          {eventDays.find((item) => item.id === selectedDayId)?.date
            ? new Date(eventDays.find((item) => item.id === selectedDayId)!.date).toLocaleDateString("pt-BR")
            : "-"}
        </p>

        <section className="mt-10 rounded-2xl border border-cyan-200/20 bg-cyan-200/5 p-8">
          {raffle ? (
            <>
              <p className="text-center text-xl font-medium text-cyan-100/80">Prêmio do Dia</p>
              <h2 className="mt-2 text-center font-headline text-4xl font-extrabold">{raffle.prize_description}</h2>
              <div className="mt-10 grid gap-6 md:grid-cols-2">
                {winnerIds.map((winnerId) => (
                  <div key={winnerId} className="rounded-xl border border-cyan-100/20 bg-cyan-100/10 p-6 text-center">
                    <p className="text-sm uppercase tracking-wide text-cyan-200/90">Ganhador</p>
                    <p className="mt-2 font-headline text-3xl font-extrabold">{winnerMap.get(winnerId)?.full_name ?? "Participante"}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-16 text-center">
              <p className="text-xl text-cyan-100/80">Nenhum sorteio executado para este dia.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

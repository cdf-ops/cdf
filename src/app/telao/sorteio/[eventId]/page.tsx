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

  const winnerRows =
    raffle
      ? (
          await admin
            .from("raffle_winners")
            .select("participant_id")
            .eq("raffle_id", raffle.id)
        ).data ?? []
      : [];

  const winnerIds = [...new Set(winnerRows.map((item) => item.participant_id))];
  const { data: winners } =
    winnerIds.length > 0
      ? await admin
          .from("participants")
          .select("id, full_name, document_number")
          .in("id", winnerIds)
      : { data: [] as { id: string; full_name: string; document_number: string }[] };
  const winnerMap = new Map((winners ?? []).map((item) => [item.id, item]));

  const leadWinner = winnerIds.length > 0 ? winnerMap.get(winnerIds[0]) : null;
  const secondaryWinners = winnerIds.slice(1).map((id) => winnerMap.get(id)).filter(Boolean) as {
    id: string;
    full_name: string;
    document_number: string;
  }[];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)] px-6 py-10 text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,94,164,0.09),transparent_40%),radial-gradient(circle_at_90%_30%,rgba(129,243,229,0.18),transparent_42%)]" />

      <div className="relative mx-auto max-w-6xl rounded-2xl bg-white/45 p-8 backdrop-blur-sm md:p-10">
        <p className="text-center font-headline text-4xl font-extrabold tracking-tight text-[var(--primary)]">CLUBE DO FRIO</p>
        <div className="mx-auto mt-5 w-fit rounded-full bg-[var(--secondary-soft)]/85 px-6 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--secondary)]">
          Vencedor(a) do Sorteio
        </div>

        {leadWinner ? (
          <>
            <p className="mt-10 text-center font-headline text-8xl font-extrabold uppercase leading-[0.9] tracking-tight text-[#111820] md:text-[11rem]">
              {leadWinner.full_name}
            </p>

            <div className="mx-auto mt-8 max-w-2xl rounded-xl bg-white/80 p-6 text-center shadow-[0_18px_40px_-28px_rgba(0,96,168,0.45)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Prêmio Ganho</p>
              <p className="mt-2 font-headline text-5xl font-extrabold leading-tight text-[var(--primary)]">
                {raffle?.prize_description ?? "Prêmio"}
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <span className="rounded bg-[var(--surface-container-low)] px-2 py-1 text-xs font-semibold text-[var(--foreground)]">
                  Evento: {event?.name ?? "Evento"}
                </span>
                <span className="rounded bg-[var(--surface-container-low)] px-2 py-1 text-xs font-semibold text-[var(--foreground)]">
                  Ticket: {leadWinner.document_number || leadWinner.id.slice(0, 8)}
                </span>
              </div>
            </div>

            {secondaryWinners.length ? (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {secondaryWinners.map((winner) => (
                  <span key={winner.id} className="rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-[var(--foreground)]">
                    {winner.full_name}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="py-20 text-center">
            <p className="font-headline text-5xl font-extrabold tracking-tight text-[var(--foreground)]">Aguardando Sorteio</p>
            <p className="mt-3 text-lg text-muted">Nenhum sorteio executado para este dia.</p>
          </div>
        )}

        <p className="mt-10 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--outline)]">
          {eventDays.find((item) => item.id === selectedDayId)?.date
            ? `Dia ${new Date(eventDays.find((item) => item.id === selectedDayId)!.date).toLocaleDateString("pt-BR")}`
            : "Dia não definido"}
        </p>

        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center">
          <span className="-translate-x-8 font-headline text-[11rem] font-extrabold tracking-tight text-[var(--primary)]/8">CLUB</span>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteRaffleAction } from "@/app/(dashboard)/events/[eventId]/sorteio/actions";

type RafflePageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    day?: string;
    notice?: string;
    notice_type?: "success" | "error";
  }>;
};

function getDefaultDayId(eventDays: { id: string; date: string }[]) {
  if (!eventDays.length) {
    return "";
  }
  const today = new Date().toISOString().slice(0, 10);
  return eventDays.find((day) => day.date === today)?.id ?? eventDays[0].id;
}

export default async function RafflePage({ params, searchParams }: RafflePageProps) {
  const session = await requireSession(["super_adm", "organizador"]);
  const { eventId } = await params;
  const { day, notice, notice_type } = await searchParams;
  const admin = createAdminClient();

  const { data: eventDaysData } = await admin
    .from("event_days")
    .select("id, date")
    .eq("event_id", eventId)
    .order("date", { ascending: true });
  const eventDays = eventDaysData ?? [];

  if (!eventDays.length) {
    return (
      <section className="surface-card rounded-xl p-6">
        <h2 className="font-headline text-2xl font-extrabold text-[var(--foreground)]">Central de Sorteios</h2>
        <p className="mt-2 text-sm text-muted">Configure datas no evento antes de executar sorteios.</p>
      </section>
    );
  }

  const selectedDayId = eventDays.some((item) => item.id === day) ? String(day) : getDefaultDayId(eventDays);
  const returnUrl = `/events/${eventId}/sorteio?day=${selectedDayId}`;

  const { data: entryCheckinsData } = await admin
    .from("entry_checkins")
    .select("participant_id")
    .eq("event_day_id", selectedDayId)
    .is("deleted_at", null);
  const eligibleParticipantIds = [...new Set((entryCheckinsData ?? []).map((item) => item.participant_id))];
  const eligibleCount = eligibleParticipantIds.length;

  const { data: rafflesData } = await admin
    .from("raffles")
    .select("id, winners_count, executed_at, deleted_at")
    .eq("event_day_id", selectedDayId)
    .order("executed_at", { ascending: true, nullsFirst: false });
  const raffles = (rafflesData ?? []).filter((item) => !item.deleted_at);
  const roundNumberByRaffleId = new Map(raffles.map((raffle, index) => [raffle.id, index + 1]));
  const raffleIds = raffles.map((raffle) => raffle.id);

  const winnerRows =
    raffleIds.length > 0
      ? (
          await admin
            .from("raffle_winners")
            .select("id, raffle_id, participant_id, created_at")
            .in("raffle_id", raffleIds)
            .order("created_at", { ascending: true })
        ).data ?? []
      : [];
  const winnerParticipantIds = [...new Set(winnerRows.map((item) => item.participant_id))];
  const { data: winnersData } =
    winnerParticipantIds.length > 0
      ? await admin
          .from("participants")
          .select("id, participant_number, full_name, document_type, document_number")
          .in("id", winnerParticipantIds)
      : { data: [] as { id: string; participant_number: number; full_name: string; document_type: string; document_number: string }[] };
  const winnerMap = new Map((winnersData ?? []).map((item) => [item.id, item]));
  const winnersByRaffleId = new Map<string, typeof winnerRows>();
  winnerRows.forEach((winner) => {
    winnersByRaffleId.set(winner.raffle_id, [...(winnersByRaffleId.get(winner.raffle_id) ?? []), winner]);
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-headline text-5xl font-extrabold tracking-tight text-[var(--foreground)]">Central de Sorteios</h2>
          <p className="mt-2 max-w-2xl text-base text-muted">
            Abra o telão para conduzir rodadas ao vivo. O histórico fica registrado automaticamente.
          </p>
        </div>

        <Link
          href={`/telao/sorteio/${eventId}?day=${selectedDayId}`}
          target="_blank"
          className="gradient-primary rounded-xl px-5 py-3 text-center text-sm font-bold text-white"
        >
          Abrir Telão
        </Link>
      </div>

      {notice ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            notice_type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[var(--danger)]"
          }`}
        >
          {notice}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="surface-card rounded-2xl p-6">
          <h3 className="font-headline text-2xl font-bold tracking-tight text-[var(--foreground)]">Dia do Sorteio</h3>
          <form className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Selecionar Dia do Evento</label>
              <select
                name="day"
                defaultValue={selectedDayId}
                className="mt-1 block w-full rounded-xl bg-[var(--surface-container-low)] px-4 py-3 text-sm font-semibold outline-none"
              >
                {eventDays.map((item) => (
                  <option key={item.id} value={item.id}>
                    {new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")}
                  </option>
                ))}
              </select>
            </div>
            <button className="ghost-border mt-5 rounded-xl bg-[var(--surface-container-lowest)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
              Carregar Dia
            </button>
          </form>

          <div className="mt-5 rounded-xl border border-[var(--outline-variant)]/35 bg-[var(--surface-container-low)] p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">Como operar durante o evento</p>
            <p className="mt-1 text-sm text-muted">
              A equipe abre o telão, escolhe a quantidade de ganhadores da rodada e clica em sortear. O sistema faz a contagem e registra
              a rodada automaticamente.
            </p>
          </div>
        </div>

        <div className="gradient-primary rounded-2xl p-6 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">Status da Base</p>
          <p className="mt-2 font-headline text-4xl font-extrabold leading-tight">{eligibleCount.toLocaleString("pt-BR")} Participantes</p>
          <p className="mt-1 text-sm text-white/90">Aptos para o sorteio atual</p>
          <div className="mt-6 rounded-lg bg-white/15 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/80">Rodadas no dia</p>
            <p className="mt-1 text-2xl font-extrabold">{raffles.length}</p>
          </div>
        </div>
      </div>

      <div className="surface-card rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-headline text-2xl font-bold tracking-tight text-[var(--foreground)]">Histórico de Rodadas</h3>
          <Link href={`/events/${eventId}/relatorios`} className="text-sm font-semibold text-[var(--primary)]">
            Exportar Relatório
          </Link>
        </div>

        <div className="mt-4 grid gap-3">
          {[...raffles].reverse().map((raffle) => {
            const roundWinners = winnersByRaffleId.get(raffle.id) ?? [];
            return (
              <article key={raffle.id} className="rounded-xl border border-[var(--outline-variant)]/35 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--outline)]">
                      Rodada {roundNumberByRaffleId.get(raffle.id) ?? "-"}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {raffle.executed_at ? new Date(raffle.executed_at).toLocaleString("pt-BR") : "-"} | {raffle.winners_count} ganhador(es)
                    </p>
                  </div>

                  {session.role === "super_adm" ? (
                    <form action={deleteRaffleAction}>
                      <input type="hidden" name="raffle_id" value={raffle.id} />
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="redirect_url" value={returnUrl} />
                      <button className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">Excluir rodada</button>
                    </form>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {roundWinners.map((winnerRow) => {
                    const winner = winnerMap.get(winnerRow.participant_id);
                    return (
                      <span key={winnerRow.id} className="rounded-full bg-[var(--surface-container-low)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]">
                        {winner ? `${winner.participant_number} — ${winner.full_name}` : "Participante"}
                      </span>
                    );
                  })}
                </div>
              </article>
            );
          })}

          {!raffles.length ? (
            <p className="rounded-xl bg-[var(--surface-container-low)] px-4 py-6 text-center text-sm text-muted">
              Nenhuma rodada registrada para este dia.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

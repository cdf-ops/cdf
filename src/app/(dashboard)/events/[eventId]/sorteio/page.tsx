import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteRaffleAction, executeRaffleAction } from "@/app/(dashboard)/events/[eventId]/sorteio/actions";

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
        <h2 className="font-headline text-2xl font-extrabold text-[var(--foreground)]">Central de Prêmios</h2>
        <p className="mt-2 text-sm text-muted">Configure datas no evento antes de executar sorteio.</p>
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
  const eligibleCount = new Set((entryCheckinsData ?? []).map((item) => item.participant_id)).size;

  const { data: rafflesData } = await admin
    .from("raffles")
    .select("id, prize_description, winners_count, executed_at, deleted_at")
    .eq("event_day_id", selectedDayId)
    .order("executed_at", { ascending: false, nullsFirst: false });
  const activeRaffle = (rafflesData ?? []).find((item) => !item.deleted_at) ?? null;
  const winnerParticipantIds =
    activeRaffle
      ? [
          ...new Set(
            (
              await admin
                .from("raffle_winners")
                .select("participant_id")
                .eq("raffle_id", activeRaffle.id)
            ).data?.map((item) => item.participant_id) ?? []
          ),
        ]
      : [];
  const { data: winnersData } =
    winnerParticipantIds.length > 0
      ? await admin
          .from("participants")
          .select("id, full_name, document_type, document_number")
          .in("id", winnerParticipantIds)
      : { data: [] as { id: string; full_name: string; document_type: string; document_number: string }[] };
  const winnerMap = new Map((winnersData ?? []).map((item) => [item.id, item]));

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)]">Central de Prêmios</h2>
            <p className="mt-1 text-sm text-muted">Sorteio por dia com histórico e controle por perfil.</p>
          </div>
          <Link
            href={`/telao/sorteio/${eventId}?day=${selectedDayId}`}
            target="_blank"
            className="rounded-xl border border-[var(--outline-variant)]/70 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--foreground)]"
          >
            Abrir Telão
          </Link>
        </div>

        {notice ? (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              notice_type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[var(--danger)]"
            }`}
          >
            {notice}
          </p>
        ) : null}

        <form className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">Dia do Evento</label>
            <select
              name="day"
              defaultValue={selectedDayId}
              className="mt-1 block rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            >
              {eventDays.map((item) => (
                <option key={item.id} value={item.id}>
                  {new Date(item.date).toLocaleDateString("pt-BR")}
                </option>
              ))}
            </select>
          </div>
          <button className="rounded-xl border border-[var(--outline-variant)]/65 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--foreground)]">
            Trocar dia
          </button>
        </form>
      </div>

      <div className="surface-card rounded-xl p-5">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-[var(--outline-variant)]/45 bg-white p-3">
            <p className="text-xs text-muted">Elegíveis no dia</p>
            <p className="font-headline text-2xl font-bold">{eligibleCount}</p>
          </div>
          <div className="rounded-lg border border-[var(--outline-variant)]/45 bg-white p-3">
            <p className="text-xs text-muted">Sorteio ativo</p>
            <p className="font-headline text-2xl font-bold">{activeRaffle ? "Sim" : "Não"}</p>
          </div>
          <div className="rounded-lg border border-[var(--outline-variant)]/45 bg-white p-3">
            <p className="text-xs text-muted">Ganhadores do dia</p>
            <p className="font-headline text-2xl font-bold">{winnerParticipantIds.length}</p>
          </div>
        </div>

        {!activeRaffle ? (
          <form action={executeRaffleAction} className="grid gap-3 md:grid-cols-4">
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="event_day_id" value={selectedDayId} />
            <input type="hidden" name="redirect_url" value={returnUrl} />
            <input
              name="prize_description"
              required
              placeholder="Descrição do prêmio"
              className="md:col-span-2 rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            />
            <input
              name="winners_count"
              type="number"
              min={1}
              defaultValue={1}
              className="rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            />
            <button className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white">Executar Sorteio</button>
          </form>
        ) : (
          <div className="rounded-xl border border-[var(--outline-variant)]/40 bg-white p-4">
            <p className="text-sm text-muted">Sorteio já executado para este dia.</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">Prêmio: {activeRaffle.prize_description}</p>
            <p className="text-xs text-muted">
              Executado em {activeRaffle.executed_at ? new Date(activeRaffle.executed_at).toLocaleString("pt-BR") : "-"}
            </p>
            {session.role === "super_adm" ? (
              <form action={deleteRaffleAction} className="mt-3">
                <input type="hidden" name="raffle_id" value={activeRaffle.id} />
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="redirect_url" value={returnUrl} />
                <button className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">Excluir Sorteio (Lógico)</button>
              </form>
            ) : null}
          </div>
        )}
      </div>

      <div className="surface-card rounded-xl p-5">
        <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Histórico de Ganhadores (Dia)</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="px-3 py-2">Vencedor</th>
                <th className="px-3 py-2">Documento</th>
                <th className="px-3 py-2">Prêmio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {winnerParticipantIds.map((participantId) => {
                const winner = winnerMap.get(participantId);
                return (
                  <tr key={participantId}>
                    <td className="px-3 py-2 font-semibold">{winner?.full_name ?? "Participante"}</td>
                    <td className="px-3 py-2">
                      {winner ? `${winner.document_type} ${winner.document_number}` : "-"}
                    </td>
                    <td className="px-3 py-2">{activeRaffle?.prize_description ?? "-"}</td>
                  </tr>
                );
              })}
              {!winnerParticipantIds.length ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-sm text-muted">
                    Nenhum ganhador registrado para este dia.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

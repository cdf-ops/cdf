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
  const eligibleParticipantIds = [...new Set((entryCheckinsData ?? []).map((item) => item.participant_id))];
  const eligibleCount = eligibleParticipantIds.length;

  const { data: rafflesData } = await admin
    .from("raffles")
    .select("id, prize_description, winners_count, executed_at, deleted_at")
    .eq("event_day_id", selectedDayId)
    .order("executed_at", { ascending: false, nullsFirst: false });
  const activeRaffle = (rafflesData ?? []).find((item) => !item.deleted_at) ?? null;

  const winnerRows =
    activeRaffle
      ? (
          await admin
            .from("raffle_winners")
            .select("id, participant_id, created_at")
            .eq("raffle_id", activeRaffle.id)
            .order("created_at", { ascending: false })
        ).data ?? []
      : [];

  const winnerParticipantIds = [...new Set(winnerRows.map((item) => item.participant_id))];
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-headline text-5xl font-extrabold tracking-tight text-[var(--foreground)]">Central de Prêmios</h2>
          <p className="mt-2 max-w-2xl text-base text-muted">
            Gerencie os sorteios em tempo real e mantenha a transparência editorial do evento.
          </p>
        </div>

        <div className="shell-card flex max-w-md items-start gap-3 rounded-xl p-4">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--secondary-soft)]/70 text-[var(--secondary)]">*</span>
          <div>
            <p className="text-sm font-bold text-[var(--secondary)]">Aviso Importante</p>
            <p className="mt-0.5 text-sm text-[var(--foreground)]">Abra o modo Telão em outra aba para os participantes.</p>
          </div>
          <Link
            href={`/telao/sorteio/${eventId}?day=${selectedDayId}`}
            target="_blank"
            className="ml-auto text-xs font-bold uppercase tracking-[0.2em] text-[var(--primary)]"
          >
            Abrir Telão
          </Link>
        </div>
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
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)]/10 text-sm font-bold text-[var(--primary)]">
              1
            </span>
            <h3 className="font-headline text-3xl font-bold tracking-tight text-[var(--foreground)]">Configurar Sorteio</h3>
          </div>

          <form className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Selecionar Dia do Evento</label>
              <select
                name="day"
                defaultValue={selectedDayId}
                className="mt-1 block w-full rounded-xl bg-[var(--surface-container-low)] px-4 py-3 text-sm font-semibold outline-none"
              >
                {eventDays.map((item) => (
                  <option key={item.id} value={item.id}>
                    {new Date(item.date).toLocaleDateString("pt-BR")}
                  </option>
                ))}
              </select>
            </div>
            <button className="ghost-border mt-5 rounded-xl bg-[var(--surface-container-lowest)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
              Carregar Dia
            </button>
          </form>

          {!activeRaffle ? (
            <form action={executeRaffleAction} className="mt-4 grid gap-4 md:grid-cols-3">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="event_day_id" value={selectedDayId} />
              <input type="hidden" name="redirect_url" value={returnUrl} />

              <div className="md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Descrição do Prêmio</label>
                <input
                  name="prize_description"
                  required
                  placeholder="Ex.: Kit Ar Condicionado X"
                  className="input-surface mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/10"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Qtde. Ganhadores</label>
                <input
                  name="winners_count"
                  type="number"
                  min={1}
                  defaultValue={1}
                  className="input-surface mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/10"
                />
              </div>

              <button className="gradient-primary md:col-span-3 rounded-xl px-4 py-3 text-base font-semibold text-white">
                Executar Sorteio
              </button>
            </form>
          ) : (
            <div className="mt-4 rounded-xl bg-[var(--surface-container-low)] p-4">
              <p className="text-sm text-muted">Sorteio já executado para este dia.</p>
              <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">Prêmio: {activeRaffle.prize_description}</p>
              <p className="mt-1 text-xs text-muted">
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

        <div className="gradient-primary rounded-2xl p-6 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">Status da Base</p>
          <p className="mt-2 font-headline text-4xl font-extrabold leading-tight">{eligibleCount.toLocaleString("pt-BR")} Participantes</p>
          <p className="mt-1 text-sm text-white/90">Aptos para o sorteio atual</p>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/15 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/80">Auditoria</p>
              <p className="mt-1 text-sm font-semibold">Verificada</p>
            </div>
            <div className="rounded-lg bg-white/15 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/80">Transmissão</p>
              <p className="mt-1 text-sm font-semibold">Ao vivo</p>
            </div>
          </div>
        </div>
      </div>

      <div className="surface-card rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-headline text-2xl font-bold tracking-tight text-[var(--foreground)]">Histórico de Ganhadores</h3>
          <Link href={`/events/${eventId}/relatorios`} className="text-sm font-semibold text-[var(--primary)]">
            Exportar Relatório
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="px-4 py-3">Vencedor</th>
                <th className="px-4 py-3">Horário</th>
                <th className="px-4 py-3">Prêmio</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {winnerRows.map((winnerRow) => {
                const winner = winnerMap.get(winnerRow.participant_id);
                return (
                  <tr key={winnerRow.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--foreground)]">{winner?.full_name ?? "Participante"}</p>
                      <p className="text-xs text-muted">{winner ? `${winner.document_type} ${winner.document_number}` : "-"}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--foreground)]">
                      {new Date(winnerRow.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">{activeRaffle?.prize_description ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Entregue</span>
                    </td>
                  </tr>
                );
              })}
              {!winnerRows.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">
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

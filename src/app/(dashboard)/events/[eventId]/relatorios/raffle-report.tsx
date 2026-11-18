import Form from "next/form";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { formatDateOnly, formatSaoPauloDateTime } from "@/lib/date-time";
import type { EventReportFoundation, ReportParticipant } from "@/lib/reports/event-report-foundation";
import { buildReportHref, type ReportNavigation } from "@/lib/reports/report-navigation";
import { createAdminClient } from "@/lib/supabase/admin";

type RaffleStatusFilter = "active" | "cancelled" | "all";

type RaffleReportProps = {
  navigation: ReportNavigation;
  foundation: EventReportFoundation;
  selectedDayId: string;
  searchText: string;
  statusFilter: RaffleStatusFilter;
  requestedPage: number;
  pageSize: number;
};

type RaffleRow = {
  id: string;
  eventDayId: string;
  prizeDescription: string;
  winnersCount: number;
  executedAt: string | null;
  createdAt: string;
  deletedAt: string | null;
};

type WinnerRow = {
  id: string;
  raffleId: string;
  participantId: string;
  createdAt: string;
};

function buildRaffleHref(
  navigation: ReportNavigation,
  values: { day: string; q: string; status: RaffleStatusFilter; page: number; pageSize: number }
) {
  const params = new URLSearchParams({
    tab: "sorteados",
    day: values.day,
    status: values.status,
    page: String(values.page),
    pageSize: String(values.pageSize),
  });
  if (values.q.trim()) params.set("q", values.q.trim());
  return `${navigation.basePath}?${params.toString()}`;
}

function matchesParticipant(participant: ReportParticipant | undefined, searchText: string) {
  if (!searchText.trim()) return true;
  if (!participant) return false;
  const searchable = [
    participant.participantNumber,
    participant.fullName,
    participant.documentType,
    participant.documentNumber,
    participant.email,
    participant.phone,
    participant.company,
    participant.jobTitle,
    participant.profession,
    participant.city,
    participant.state,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pt-BR");
  return searchable.includes(searchText.trim().toLocaleLowerCase("pt-BR"));
}

export async function RaffleReport({
  navigation,
  foundation,
  selectedDayId,
  searchText,
  statusFilter,
  requestedPage,
  pageSize,
}: RaffleReportProps) {
  const admin = createAdminClient();
  const dayIds = foundation.days.map((day) => day.id);
  const dayById = new Map(foundation.days.map((day) => [day.id, day]));
  const selectedDayIds = new Set(selectedDayId === "all" ? dayIds : [selectedDayId]);
  const { data: raffleData, error: raffleError } = dayIds.length
    ? await admin
        .from("raffles")
        .select("id, event_day_id, prize_description, winners_count, executed_at, created_at, deleted_at")
        .in("event_day_id", dayIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (raffleError) throw new Error("Não foi possível carregar o histórico de sorteios.");

  const raffles: RaffleRow[] = (raffleData ?? []).map((raffle) => ({
    id: raffle.id,
    eventDayId: raffle.event_day_id,
    prizeDescription: raffle.prize_description,
    winnersCount: raffle.winners_count,
    executedAt: raffle.executed_at,
    createdAt: raffle.created_at,
    deletedAt: raffle.deleted_at,
  }));
  const raffleIds = raffles.map((raffle) => raffle.id);
  const { data: winnerData, error: winnerError } = raffleIds.length
    ? await admin
        .from("raffle_winners")
        .select("id, raffle_id, participant_id, created_at")
        .in("raffle_id", raffleIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (winnerError) throw new Error("Não foi possível carregar os ganhadores dos sorteios.");

  const winners: WinnerRow[] = (winnerData ?? []).map((winner) => ({
    id: winner.id,
    raffleId: winner.raffle_id,
    participantId: winner.participant_id,
    createdAt: winner.created_at,
  }));
  const participantIds = [...new Set(winners.map((winner) => winner.participantId))];
  const { data: participantData, error: participantError } = participantIds.length
    ? await admin
        .from("participants")
        .select("id, participant_number, full_name, document_type, document_number, email, phone, company, job_title, state, city, profession")
        .in("id", participantIds)
    : { data: [], error: null };

  if (participantError) throw new Error("Não foi possível carregar os participantes sorteados.");

  const participantById = new Map<string, ReportParticipant>(
    (participantData ?? []).map((participant) => [participant.id, {
      id: participant.id,
      participantNumber: participant.participant_number,
      fullName: participant.full_name,
      documentType: participant.document_type,
      documentNumber: participant.document_number,
      email: participant.email,
      phone: participant.phone,
      company: participant.company,
      jobTitle: participant.job_title,
      state: participant.state,
      city: participant.city,
      profession: participant.profession,
    }])
  );
  const winnersByRaffleId = new Map<string, WinnerRow[]>();
  winners.forEach((winner) => {
    const current = winnersByRaffleId.get(winner.raffleId) ?? [];
    current.push(winner);
    winnersByRaffleId.set(winner.raffleId, current);
  });

  const roundNumberByRaffleId = new Map<string, number>();
  foundation.days.forEach((day) => {
    raffles
      .filter((raffle) => raffle.eventDayId === day.id)
      .sort((left, right) => (left.executedAt ?? left.createdAt).localeCompare(right.executedAt ?? right.createdAt))
      .forEach((raffle, index) => roundNumberByRaffleId.set(raffle.id, index + 1));
  });
  const selectedRaffles = raffles.filter((raffle) => selectedDayIds.has(raffle.eventDayId));
  const statusRaffles = selectedRaffles.filter((raffle) => {
    if (statusFilter === "all") return true;
    return statusFilter === "cancelled" ? Boolean(raffle.deletedAt) : !raffle.deletedAt;
  });
  const statusRaffleById = new Map(statusRaffles.map((raffle) => [raffle.id, raffle]));
  const statusRaffleIds = new Set(statusRaffles.map((raffle) => raffle.id));
  const detailedRows = winners
    .filter((winner) => statusRaffleIds.has(winner.raffleId))
    .flatMap((winner) => {
      const raffle = statusRaffleById.get(winner.raffleId);
      const participant = participantById.get(winner.participantId);
      if (!raffle || !matchesParticipant(participant, searchText)) return [];
      const day = dayById.get(raffle.eventDayId);
      if (!day) return [];
      return [{ winner, raffle, participant, day, roundNumber: roundNumberByRaffleId.get(raffle.id) ?? 0 }];
    })
    .sort((left, right) => {
      const dayOrder = left.day.date.localeCompare(right.day.date);
      if (dayOrder) return dayOrder;
      const roundOrder = left.roundNumber - right.roundNumber;
      if (roundOrder) return roundOrder;
      return left.winner.createdAt.localeCompare(right.winner.createdAt);
    });
  const totalPages = Math.max(1, Math.ceil(detailedRows.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const paginatedRows = detailedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeRaffles = selectedRaffles.filter((raffle) => !raffle.deletedAt);
  const cancelledRaffles = selectedRaffles.filter((raffle) => raffle.deletedAt);
  const activeRaffleIds = new Set(activeRaffles.map((raffle) => raffle.id));
  const activeWinnerIds = winners.filter((winner) => activeRaffleIds.has(winner.raffleId)).map((winner) => winner.participantId);
  const hrefValues = { day: selectedDayId, q: searchText, status: statusFilter, pageSize };

  return (
    <>
      <div className="surface-card rounded-2xl p-5 sm:p-6">
        <Form action={navigation.basePath} scroll={false} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_repeat(3,1fr)_auto] xl:items-end">
          <input type="hidden" name="tab" value="sorteados" />
          <div>
            <label htmlFor="raffle-search" className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Busca</label>
            <input id="raffle-search" name="q" defaultValue={searchText} placeholder="Nome, número, documento ou contato" className="input-surface mt-1 min-h-11 w-full rounded-xl px-4 text-sm outline-none" />
          </div>
          <div>
            <label htmlFor="raffle-day" className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Dia</label>
            <select id="raffle-day" name="day" defaultValue={selectedDayId} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 text-sm">
              <option value="all">Todos</option>
              {foundation.days.map((day) => <option key={day.id} value={day.id}>{formatDateOnly(day.date)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="raffle-status" className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Rodadas</label>
            <select id="raffle-status" name="status" defaultValue={statusFilter} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 text-sm">
              <option value="active">Válidas</option><option value="cancelled">Canceladas</option><option value="all">Todas</option>
            </select>
          </div>
          <div>
            <label htmlFor="raffle-page-size" className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Por página</label>
            <select id="raffle-page-size" name="pageSize" defaultValue={String(pageSize)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 text-sm">
              <option value="50">50</option><option value="100">100</option>
            </select>
          </div>
          <SubmitButton pendingLabel="Aplicando..." className="gradient-primary min-h-11 rounded-xl px-5 text-sm font-bold text-white">Aplicar</SubmitButton>
        </Form>
        <div className="mt-3 flex justify-end"><Link href={buildReportHref(navigation, { tab: "sorteados" })} className="text-sm font-semibold text-[var(--primary)] hover:underline">Limpar filtros</Link></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Rodadas válidas", value: activeRaffles.length, detail: "Resultados oficiais" },
          { label: "Rodadas canceladas", value: cancelledRaffles.length, detail: "Preservadas para auditoria" },
          { label: "Ganhadores registrados", value: winners.filter((winner) => activeRaffleIds.has(winner.raffleId)).length, detail: "Soma das rodadas válidas" },
          { label: "Ganhadores únicos", value: new Set(activeWinnerIds).size, detail: "Pessoas distintas sorteadas" },
        ].map((metric) => <div key={metric.label} className="surface-card rounded-xl p-4"><p className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">{metric.label}</p><p className="mt-2 font-headline text-3xl font-extrabold">{metric.value}</p><p className="mt-1 text-xs text-muted">{metric.detail}</p></div>)}
      </div>

      <div className="surface-card overflow-hidden rounded-2xl">
        <div className="p-5 sm:p-6"><h2 className="font-headline text-xl font-extrabold">Resumo das rodadas</h2><p className="mt-1 text-sm text-muted">Rodadas canceladas permanecem visíveis e não entram nos resultados oficiais.</p></div>
        <div className="overflow-x-auto border-t border-[var(--surface-container)]">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Rodada</th><th className="px-4 py-3">Execução</th><th className="px-4 py-3">Prêmio</th><th className="px-4 py-3">Ganhadores</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Cancelamento</th></tr></thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {statusRaffles.map((raffle) => {
                const day = dayById.get(raffle.eventDayId);
                return <tr key={raffle.id}><td className="px-4 py-3 font-semibold">{day ? formatDateOnly(day.date) : "-"}</td><td className="px-4 py-3">{roundNumberByRaffleId.get(raffle.id) ?? "-"}</td><td className="px-4 py-3">{raffle.executedAt ? formatSaoPauloDateTime(raffle.executedAt) : "-"}</td><td className="px-4 py-3">{raffle.prizeDescription || "Não informado"}</td><td className="px-4 py-3">{winnersByRaffleId.get(raffle.id)?.length ?? raffle.winnersCount}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${raffle.deletedAt ? "bg-slate-100 text-slate-700" : "bg-emerald-100 text-emerald-700"}`}>{raffle.deletedAt ? "Cancelada" : "Válida"}</span></td><td className="px-4 py-3">{raffle.deletedAt ? formatSaoPauloDateTime(raffle.deletedAt) : "-"}</td></tr>;
              })}
              {!statusRaffles.length ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">Nenhuma rodada encontrada.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="surface-card overflow-hidden rounded-2xl">
        <div className="p-5 sm:p-6"><h2 className="font-headline text-xl font-extrabold">Participantes sorteados</h2><p className="mt-1 text-sm text-muted">{detailedRows.length} resultado(s) encontrado(s) nos filtros atuais.</p></div>
        <div className="divide-y divide-[var(--surface-container)] border-t border-[var(--surface-container)] lg:hidden">
          {paginatedRows.map((row) => <article key={row.winner.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><Link href={row.participant ? `/participantes/${row.participant.id}` : "#"} className="font-bold hover:text-[var(--primary)]">{row.participant?.fullName ?? "Participante"}</Link><p className="font-mono text-lg font-black text-[var(--primary)]">{row.participant?.participantNumber ?? "-"}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.raffle.deletedAt ? "bg-slate-100 text-slate-700" : "bg-emerald-100 text-emerald-700"}`}>{row.raffle.deletedAt ? "Cancelada" : "Válida"}</span></div><p className="mt-2 text-sm">{formatDateOnly(row.day.date)} · Rodada {row.roundNumber}</p><p className="mt-1 text-sm text-muted">{row.raffle.prizeDescription || "Prêmio não informado"}</p></article>)}
          {!paginatedRows.length ? <p className="p-8 text-center text-sm text-muted">Nenhum participante sorteado encontrado.</p> : null}
        </div>
        <div className="hidden overflow-x-auto border-t border-[var(--surface-container)] lg:block">
          <table className="w-full min-w-[1120px] border-collapse text-left text-sm"><thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Rodada</th><th className="px-4 py-3">Número</th><th className="px-4 py-3">Participante</th><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Contato</th><th className="px-4 py-3">Prêmio</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-[var(--surface-container)]">{paginatedRows.map((row) => <tr key={row.winner.id}><td className="px-4 py-3 font-semibold">{formatDateOnly(row.day.date)}</td><td className="px-4 py-3">{row.roundNumber}</td><td className="px-4 py-3 font-mono text-lg font-black text-[var(--primary)]">{row.participant?.participantNumber ?? "-"}</td><td className="px-4 py-3">{row.participant ? <Link href={`/participantes/${row.participant.id}`} className="font-semibold hover:text-[var(--primary)] hover:underline">{row.participant.fullName}</Link> : "Participante"}</td><td className="px-4 py-3">{row.participant ? `${row.participant.documentType} ${row.participant.documentNumber}` : "-"}</td><td className="px-4 py-3">{row.participant ? <><p>{row.participant.email}</p><p className="text-xs text-muted">{row.participant.phone}</p></> : "-"}</td><td className="px-4 py-3">{row.raffle.prizeDescription || "Não informado"}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.raffle.deletedAt ? "bg-slate-100 text-slate-700" : "bg-emerald-100 text-emerald-700"}`}>{row.raffle.deletedAt ? "Cancelada" : "Válida"}</span></td></tr>)}</tbody></table>
        </div>
        <div className="flex flex-col gap-3 bg-[var(--surface-container-low)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-muted">Página {currentPage} de {totalPages} · {detailedRows.length} resultado(s)</p><div className="flex gap-2">{currentPage > 1 ? <Link href={buildRaffleHref(navigation, { ...hrefValues, page: currentPage - 1 })} className="rounded-lg border bg-white px-3 py-2 font-semibold">Anterior</Link> : null}{currentPage < totalPages ? <Link href={buildRaffleHref(navigation, { ...hrefValues, page: currentPage + 1 })} className="rounded-lg border bg-white px-3 py-2 font-semibold">Próxima</Link> : null}</div></div>
      </div>
    </>
  );
}

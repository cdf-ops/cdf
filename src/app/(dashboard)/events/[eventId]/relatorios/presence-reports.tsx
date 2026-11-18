import Form from "next/form";
import Link from "next/link";
import { issueCertificateAction } from "@/app/(dashboard)/events/[eventId]/certificados/actions";
import type { EventReportTab } from "@/app/(dashboard)/events/[eventId]/relatorios/report-tabs";
import { SubmitButton } from "@/components/submit-button";
import { formatDateOnly, formatSaoPauloDateTime, formatSaoPauloTime } from "@/lib/date-time";
import type {
  EventReportFoundation,
  ReportCheckin,
  ReportParticipant,
} from "@/lib/reports/event-report-foundation";
import { buildReportHref, type ReportNavigation } from "@/lib/reports/report-navigation";

export type AttendanceFilter = "present" | "absent" | "all";

type PresenceTab = Extract<EventReportTab, "presenca-dia" | "presenca-total" | "presentes">;

type PresenceReportsProps = {
  eventId: string;
  navigation: ReportNavigation;
  activeTab: PresenceTab;
  foundation: EventReportFoundation;
  selectedDayId: string;
  searchText: string;
  attendanceFilter: AttendanceFilter;
  requestedPage: number;
  pageSize: number;
  notice?: string;
  noticeType?: "success" | "error";
};

type AttendanceRow = {
  participant: ReportParticipant;
  dayId: string;
  date: string;
  status: "present" | "absent";
  registrationType: "Prevista" | "No local" | "Sem inscrição";
  checkin: ReportCheckin | null;
};

type ParticipantPresenceRow = {
  participant: ReportParticipant;
  checkins: ReportCheckin[];
  days: { id: string; date: string; checkedInAt: string }[];
};

function unique(values: string[]) {
  return [...new Set(values)];
}

function matchesParticipant(participant: ReportParticipant, searchText: string) {
  const normalized = searchText.trim().toLocaleLowerCase("pt-BR");
  if (!normalized) return true;
  return [
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
    .toLocaleLowerCase("pt-BR")
    .includes(normalized);
}

function paginate<T>(rows: T[], requestedPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  return {
    rows: rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    currentPage,
    totalPages,
  };
}

function buildPresenceHref(
  navigation: ReportNavigation,
  values: {
    tab: PresenceTab;
    day: string;
    q: string;
    attendance: AttendanceFilter;
    page: number;
    pageSize: number;
  }
) {
  const params = new URLSearchParams({
    tab: values.tab,
    day: values.day,
    attendance: values.attendance,
    page: String(values.page),
    pageSize: String(values.pageSize),
  });
  if (values.q.trim()) params.set("q", values.q.trim());
  return `${navigation.basePath}?${params.toString()}`;
}

function Pagination({
  navigation,
  tab,
  day,
  q,
  attendance,
  pageSize,
  currentPage,
  totalPages,
  totalRows,
}: {
  navigation: ReportNavigation;
  tab: PresenceTab;
  day: string;
  q: string;
  attendance: AttendanceFilter;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  totalRows: number;
}) {
  const values = { tab, day, q, attendance, pageSize };
  return (
    <div className="flex flex-col gap-3 bg-[var(--surface-container-low)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted">Página {currentPage} de {totalPages} · {totalRows} resultado(s)</p>
      <div className="flex gap-2">
        {currentPage > 1 ? <Link href={buildPresenceHref(navigation, { ...values, page: currentPage - 1 })} className="rounded-lg border bg-white px-3 py-2 font-semibold">Anterior</Link> : null}
        {currentPage < totalPages ? <Link href={buildPresenceHref(navigation, { ...values, page: currentPage + 1 })} className="rounded-lg border bg-white px-3 py-2 font-semibold">Próxima</Link> : null}
      </div>
    </div>
  );
}

function CertificateActions({
  eventId,
  participantId,
  participantNumber,
  days,
  redirectUrl,
}: {
  eventId: string;
  participantId: string;
  participantNumber: number;
  days: { id: string; date: string }[];
  redirectUrl: string;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {days.map((day) => (
        <form key={day.id} action={issueCertificateAction}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="event_day_id" value={day.id} />
          <input type="hidden" name="participant_id" value={participantId} />
          <input type="hidden" name="redirect_url" value={redirectUrl} />
          <SubmitButton
            pendingLabel="Emitindo..."
            className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-bold text-white"
            title={`Emitir certificado de ${formatDateOnly(day.date)} para o participante ${participantNumber}`}
          >
            Certificado {formatDateOnly(day.date, { day: "2-digit", month: "2-digit" })}
          </SubmitButton>
        </form>
      ))}
    </div>
  );
}

function PresenceFilters({
  navigation,
  activeTab,
  foundation,
  selectedDayId,
  searchText,
  attendanceFilter,
  pageSize,
}: Omit<PresenceReportsProps, "requestedPage" | "notice" | "noticeType">) {
  if (activeTab === "presenca-dia") {
    return (
      <div className="surface-card rounded-2xl p-5 sm:p-6">
        <Form action={navigation.basePath} scroll={false} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="tab" value={activeTab} />
          <div>
            <label htmlFor="presence-summary-day" className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Período</label>
            <select id="presence-summary-day" name="day" defaultValue={selectedDayId} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 text-sm sm:w-auto">
              <option value="all">Evento inteiro</option>
              {foundation.days.map((day) => <option key={day.id} value={day.id}>{formatDateOnly(day.date)}</option>)}
            </select>
          </div>
          <SubmitButton pendingLabel="Aplicando..." className="gradient-primary min-h-11 rounded-xl px-5 text-sm font-bold text-white">Aplicar</SubmitButton>
        </Form>
      </div>
    );
  }

  return (
    <div className="surface-card rounded-2xl p-5 sm:p-6">
      <Form action={navigation.basePath} scroll={false} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_repeat(3,1fr)_auto] xl:items-end">
        <input type="hidden" name="tab" value={activeTab} />
        <div>
          <label htmlFor="presence-search" className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Busca</label>
          <input id="presence-search" name="q" defaultValue={searchText} placeholder="Nome, número, documento ou contato" className="input-surface mt-1 min-h-11 w-full rounded-xl px-4 text-sm outline-none" />
        </div>
        <div>
          <label htmlFor="presence-day" className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Dia</label>
          <select id="presence-day" name="day" defaultValue={selectedDayId} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 text-sm">
            <option value="all">Todos</option>
            {foundation.days.map((day) => <option key={day.id} value={day.id}>{formatDateOnly(day.date)}</option>)}
          </select>
        </div>
        {activeTab === "presentes" ? (
          <div>
            <label htmlFor="attendance-status" className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Situação</label>
            <select id="attendance-status" name="attendance" defaultValue={attendanceFilter} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 text-sm">
              <option value="present">Presentes</option><option value="absent">Ausentes</option><option value="all">Todos</option>
            </select>
          </div>
        ) : <input type="hidden" name="attendance" value="present" />}
        <div>
          <label htmlFor="presence-page-size" className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Por página</label>
          <select id="presence-page-size" name="pageSize" defaultValue={String(pageSize)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 text-sm">
            <option value="50">50</option><option value="100">100</option>
          </select>
        </div>
        <SubmitButton pendingLabel="Aplicando..." className="gradient-primary min-h-11 rounded-xl px-5 text-sm font-bold text-white">Aplicar</SubmitButton>
      </Form>
      <div className="mt-3 flex justify-end">
        <Link href={buildReportHref(navigation, { tab: activeTab })} className="text-sm font-semibold text-[var(--primary)] hover:underline">Limpar filtros</Link>
      </div>
    </div>
  );
}

export function PresenceReports(props: PresenceReportsProps) {
  const { eventId, navigation, activeTab, foundation, selectedDayId, searchText, attendanceFilter, requestedPage, pageSize } = props;
  const selectedDayIds = new Set(selectedDayId === "all" ? foundation.days.map((day) => day.id) : [selectedDayId]);
  const dayById = new Map(foundation.days.map((day) => [day.id, day]));
  const checkinByParticipantDay = new Map(
    foundation.officialCheckins.map((checkin) => [`${checkin.participantId}:${checkin.eventDayId}`, checkin])
  );

  if (activeTab === "presenca-dia") {
    const visibleDays = foundation.days.filter((day) => selectedDayIds.has(day.id));
    const totalRegistered = visibleDays.reduce((total, day) => total + day.uniqueRegisteredParticipantIds.length, 0);
    const totalPresent = visibleDays.reduce((total, day) => total + day.uniquePresentParticipantIds.length, 0);
    const totalAbsent = visibleDays.reduce((total, day) => {
      const presentSet = new Set(day.uniquePresentParticipantIds);
      return total + day.uniqueRegisteredParticipantIds.filter((id) => !presentSet.has(id)).length;
    }, 0);
    return (
      <>
        <PresenceFilters {...props} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Participações inscritas", value: totalRegistered, detail: "Soma dos dias selecionados" },
            { label: "Presenças oficiais", value: totalPresent, detail: "Participantes únicos por dia" },
            { label: "Ausências", value: totalAbsent, detail: "Inscritos sem check-in no dia" },
            { label: "Taxa de presença", value: `${totalRegistered ? Math.round((totalPresent / totalRegistered) * 10_000) / 100 : 0}%`, detail: "Presenças sobre inscrições" },
          ].map((metric) => <div key={metric.label} className="surface-card rounded-xl p-4"><p className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">{metric.label}</p><p className="mt-2 font-headline text-3xl font-extrabold">{metric.value}</p><p className="mt-1 text-xs text-muted">{metric.detail}</p></div>)}
        </div>
        <div className="surface-card overflow-hidden rounded-2xl">
          <div className="p-5 sm:p-6"><h2 className="font-headline text-xl font-extrabold">Presença por dia</h2><p className="mt-1 text-sm text-muted">Comparação entre inscrições ativas e check-ins oficiais da recepção.</p></div>
          <div className="overflow-x-auto border-t border-[var(--surface-container)]">
            <table className="w-full min-w-[940px] border-collapse text-left text-sm">
              <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Inscritos</th><th className="px-4 py-3">Previstos</th><th className="px-4 py-3">No local</th><th className="px-4 py-3">Presentes</th><th className="px-4 py-3">Ausentes</th><th className="px-4 py-3">Taxa</th><th className="px-4 py-3 text-right">Detalhes</th></tr></thead>
              <tbody className="divide-y divide-[var(--surface-container)]">
                {visibleDays.map((day) => {
                  const presentSet = new Set(day.uniquePresentParticipantIds);
                  const absent = day.uniqueRegisteredParticipantIds.filter((id) => !presentSet.has(id)).length;
                  const rate = day.uniqueRegisteredParticipantIds.length ? Math.round((day.uniquePresentParticipantIds.length / day.uniqueRegisteredParticipantIds.length) * 10_000) / 100 : 0;
                  return <tr key={day.id}><td className="px-4 py-3 font-semibold">{formatDateOnly(day.date)}</td><td className="px-4 py-3">{day.uniqueRegisteredParticipantIds.length}</td><td className="px-4 py-3">{day.uniqueExpectedParticipantIds.length}</td><td className="px-4 py-3">{day.onsiteRegistrations.length}</td><td className="px-4 py-3">{day.uniquePresentParticipantIds.length}</td><td className="px-4 py-3">{absent}</td><td className="px-4 py-3 font-semibold text-[var(--primary)]">{rate}%</td><td className="px-4 py-3 text-right"><Link href={buildReportHref(navigation, { tab: "presentes", day: day.id, attendance: "all" })} className="text-sm font-bold text-[var(--primary)] hover:underline">Ver participantes</Link></td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  const participantPresenceRows: ParticipantPresenceRow[] = [...new Set(
    foundation.officialCheckins.filter((checkin) => selectedDayIds.has(checkin.eventDayId)).map((checkin) => checkin.participantId)
  )]
    .flatMap((participantId) => {
      const participant = foundation.participantsById.get(participantId);
      if (!participant || !matchesParticipant(participant, searchText)) return [];
      const checkins = foundation.officialCheckins
        .filter((checkin) => checkin.participantId === participantId && selectedDayIds.has(checkin.eventDayId))
        .sort((left, right) => left.checkedInAt.localeCompare(right.checkedInAt));
      return [{
        participant,
        checkins,
        days: checkins.flatMap((checkin) => {
          const day = dayById.get(checkin.eventDayId);
          return day ? [{ id: day.id, date: day.date, checkedInAt: checkin.checkedInAt }] : [];
        }),
      }];
    })
    .sort((left, right) => left.participant.fullName.localeCompare(right.participant.fullName, "pt-BR"));

  if (activeTab === "presenca-total") {
    const pagination = paginate(participantPresenceRows, requestedPage, pageSize);
    const redirectUrl = buildPresenceHref(navigation, { tab: activeTab, day: selectedDayId, q: searchText, attendance: "present", page: pagination.currentPage, pageSize });
    return (
      <>
        {props.notice ? <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${props.noticeType === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[var(--danger)]"}`}>{props.notice}</p> : null}
        <PresenceFilters {...props} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="surface-card rounded-xl p-4"><p className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Presentes únicos</p><p className="mt-2 font-headline text-3xl font-extrabold">{participantPresenceRows.length}</p><p className="mt-1 text-xs text-muted">No período selecionado</p></div>
          <div className="surface-card rounded-xl p-4"><p className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Presenças acumuladas</p><p className="mt-2 font-headline text-3xl font-extrabold">{participantPresenceRows.reduce((total, row) => total + row.checkins.length, 0)}</p><p className="mt-1 text-xs text-muted">Soma dos dias</p></div>
          <div className="surface-card rounded-xl p-4"><p className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Média de dias</p><p className="mt-2 font-headline text-3xl font-extrabold">{participantPresenceRows.length ? (participantPresenceRows.reduce((total, row) => total + row.days.length, 0) / participantPresenceRows.length).toFixed(1) : "0,0"}</p><p className="mt-1 text-xs text-muted">Por participante presente</p></div>
        </div>
        <div className="surface-card overflow-hidden rounded-2xl">
          <div className="p-5 sm:p-6"><h2 className="font-headline text-xl font-extrabold">Presença total por participante</h2><p className="mt-1 text-sm text-muted">Participantes consolidados, independentemente da quantidade de dias frequentados.</p></div>
          <div className="divide-y divide-[var(--surface-container)] border-t border-[var(--surface-container)] lg:hidden">
            {pagination.rows.map((row) => <article key={row.participant.id} className="p-4"><Link href={`/participantes/${row.participant.id}`} className="font-bold hover:text-[var(--primary)]">{row.participant.fullName}</Link><p className="font-mono text-lg font-black text-[var(--primary)]">{row.participant.participantNumber}</p><p className="mt-1 text-sm text-muted">{row.days.length} dia(s) · {row.participant.email}</p><div className="mt-2 flex flex-wrap gap-1">{row.days.map((day) => <span key={day.id} className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">{formatDateOnly(day.date)}</span>)}</div><div className="mt-3"><CertificateActions eventId={eventId} participantId={row.participant.id} participantNumber={row.participant.participantNumber} days={row.days} redirectUrl={redirectUrl} /></div></article>)}
            {!pagination.rows.length ? <p className="p-8 text-center text-sm text-muted">Nenhum participante presente encontrado.</p> : null}
          </div>
          <div className="hidden overflow-x-auto border-t border-[var(--surface-container)] lg:block">
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm"><thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]"><tr><th className="px-4 py-3">Número</th><th className="px-4 py-3">Participante</th><th className="px-4 py-3">Contato</th><th className="px-4 py-3">Dias presentes</th><th className="px-4 py-3">Primeira entrada</th><th className="px-4 py-3">Última entrada</th><th className="px-4 py-3 text-right">Certificados</th></tr></thead><tbody className="divide-y divide-[var(--surface-container)]">{pagination.rows.map((row) => <tr key={row.participant.id}><td className="px-4 py-3 font-mono text-lg font-black text-[var(--primary)]">{row.participant.participantNumber}</td><td className="px-4 py-3"><Link href={`/participantes/${row.participant.id}`} className="font-semibold hover:text-[var(--primary)] hover:underline">{row.participant.fullName}</Link><p className="text-xs text-muted">{row.participant.documentType} {row.participant.documentNumber}</p></td><td className="px-4 py-3"><p>{row.participant.email}</p><p className="text-xs text-muted">{row.participant.phone}</p></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1">{row.days.map((day) => <span key={day.id} className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">{formatDateOnly(day.date)}</span>)}</div></td><td className="px-4 py-3">{formatSaoPauloDateTime(row.checkins[0].checkedInAt)}</td><td className="px-4 py-3">{formatSaoPauloDateTime(row.checkins[row.checkins.length - 1].checkedInAt)}</td><td className="px-4 py-3 text-right"><CertificateActions eventId={eventId} participantId={row.participant.id} participantNumber={row.participant.participantNumber} days={row.days} redirectUrl={redirectUrl} /></td></tr>)}</tbody></table>
          </div>
          <Pagination navigation={navigation} tab={activeTab} day={selectedDayId} q={searchText} attendance="present" pageSize={pageSize} currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalRows={participantPresenceRows.length} />
        </div>
      </>
    );
  }

  const attendanceRows: AttendanceRow[] = foundation.days
    .filter((day) => selectedDayIds.has(day.id))
    .flatMap((day) => {
      const participantIds = unique([...day.uniqueRegisteredParticipantIds, ...day.uniquePresentParticipantIds]);
      const expectedSet = new Set(day.uniqueExpectedParticipantIds);
      const registeredSet = new Set(day.uniqueRegisteredParticipantIds);
      return participantIds.flatMap((participantId) => {
        const participant = foundation.participantsById.get(participantId);
        if (!participant || !matchesParticipant(participant, searchText)) return [];
        const checkin = checkinByParticipantDay.get(`${participantId}:${day.id}`) ?? null;
        const status = checkin ? "present" as const : "absent" as const;
        if (attendanceFilter !== "all" && attendanceFilter !== status) return [];
        return [{ participant, dayId: day.id, date: day.date, status, registrationType: expectedSet.has(participantId) ? "Prevista" as const : registeredSet.has(participantId) ? "No local" as const : "Sem inscrição" as const, checkin }];
      });
    })
    .sort((left, right) => left.date.localeCompare(right.date) || left.participant.fullName.localeCompare(right.participant.fullName, "pt-BR"));
  const pagination = paginate(attendanceRows, requestedPage, pageSize);
  return (
    <>
      <PresenceFilters {...props} />
      <div className="surface-card overflow-hidden rounded-2xl">
        <div className="p-5 sm:p-6"><h2 className="font-headline text-xl font-extrabold">Participantes por situação</h2><p className="mt-1 text-sm text-muted">Use o filtro de situação para consultar presentes, ausentes ou todos os inscritos.</p></div>
        <div className="divide-y divide-[var(--surface-container)] border-t border-[var(--surface-container)] lg:hidden">{pagination.rows.map((row) => <article key={`${row.participant.id}-${row.dayId}`} className="p-4"><div className="flex items-start justify-between gap-3"><div><Link href={`/participantes/${row.participant.id}`} className="font-bold hover:text-[var(--primary)]">{row.participant.fullName}</Link><p className="font-mono text-lg font-black text-[var(--primary)]">{row.participant.participantNumber}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.status === "present" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{row.status === "present" ? "Presente" : "Ausente"}</span></div><p className="mt-2 text-sm">{formatDateOnly(row.date)} · {row.registrationType}</p><p className="mt-1 text-sm text-muted">{row.checkin ? formatSaoPauloTime(row.checkin.checkedInAt) : "Sem check-in"}</p></article>)}{!pagination.rows.length ? <p className="p-8 text-center text-sm text-muted">Nenhum participante encontrado.</p> : null}</div>
        <div className="hidden overflow-x-auto border-t border-[var(--surface-container)] lg:block"><table className="w-full min-w-[980px] border-collapse text-left text-sm"><thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Número</th><th className="px-4 py-3">Participante</th><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Inscrição</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Horário</th></tr></thead><tbody className="divide-y divide-[var(--surface-container)]">{pagination.rows.map((row) => <tr key={`${row.participant.id}-${row.dayId}`}><td className="px-4 py-3 font-semibold">{formatDateOnly(row.date)}</td><td className="px-4 py-3 font-mono text-lg font-black text-[var(--primary)]">{row.participant.participantNumber}</td><td className="px-4 py-3"><Link href={`/participantes/${row.participant.id}`} className="font-semibold hover:text-[var(--primary)] hover:underline">{row.participant.fullName}</Link><p className="text-xs text-muted">{row.participant.email}</p></td><td className="px-4 py-3">{row.participant.documentType} {row.participant.documentNumber}</td><td className="px-4 py-3">{row.registrationType}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.status === "present" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{row.status === "present" ? "Presente" : "Ausente"}</span></td><td className="px-4 py-3">{row.checkin ? formatSaoPauloTime(row.checkin.checkedInAt) : "-"}</td></tr>)}</tbody></table></div>
        <Pagination navigation={navigation} tab={activeTab} day={selectedDayId} q={searchText} attendance={attendanceFilter} pageSize={pageSize} currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalRows={attendanceRows.length} />
      </div>
    </>
  );
}

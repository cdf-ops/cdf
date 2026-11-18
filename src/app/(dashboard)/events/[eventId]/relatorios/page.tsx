import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PresenceReports,
  type AttendanceFilter,
} from "@/app/(dashboard)/events/[eventId]/relatorios/presence-reports";
import { RaffleReport } from "@/app/(dashboard)/events/[eventId]/relatorios/raffle-report";
import { ReportTabs, type EventReportTab } from "@/app/(dashboard)/events/[eventId]/relatorios/report-tabs";
import { SubmitButton } from "@/components/submit-button";
import type { AppRole } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { formatDateOnly, formatSaoPauloDateTime } from "@/lib/date-time";
import {
  getEventReportFoundation,
  type ReportParticipant,
  type ReportRegistration,
} from "@/lib/reports/event-report-foundation";
import { buildReportHref, type ReportNavigation } from "@/lib/reports/report-navigation";

export type ReportSearchParams = {
  tab?: string;
  day?: string;
  q?: string;
  status?: string;
  kind?: string;
  page?: string;
  pageSize?: string;
  attendance?: string;
  notice?: string;
  notice_type?: "success" | "error";
};

type ReportsPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<ReportSearchParams>;
};

type RegistrationStatusFilter = "active" | "cancelled" | "all";
type RegistrationKindFilter = "all" | "expected" | "onsite";

type ParticipantRegistrationRow = {
  participant: ReportParticipant;
  registrations: ReportRegistration[];
  activeDays: string[];
  cancelledDays: string[];
  sources: string[];
  hasActiveRegistration: boolean;
};

const SOURCE_LABELS: Record<ReportRegistration["source"], string> = {
  legacy: "Legado",
  public_registration: "Site",
  reception: "Recepção",
  admin: "Administração",
  import: "Importação",
};

function unique(values: string[]) {
  return [...new Set(values)];
}

function parseTab(value?: string): EventReportTab {
  if (
    value === "lista-inscritos" ||
    value === "presenca-dia" ||
    value === "presenca-total" ||
    value === "presentes" ||
    value === "sorteados"
  ) {
    return value;
  }
  return "resumo-inscricoes";
}

function parseAttendance(value?: string): AttendanceFilter {
  if (value === "absent" || value === "all") return value;
  return "present";
}

function parseStatus(value?: string): RegistrationStatusFilter {
  if (value === "cancelled" || value === "all") return value;
  return "active";
}

function parseKind(value?: string): RegistrationKindFilter {
  if (value === "expected" || value === "onsite") return value;
  return "all";
}

function parsePage(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parsePageSize(value?: string) {
  return value === "100" ? 100 : 50;
}

function buildListHref(
  navigation: ReportNavigation,
  values: {
    day: string;
    q: string;
    status: RegistrationStatusFilter;
    kind: RegistrationKindFilter;
    page: number;
    pageSize: number;
  }
) {
  const params = new URLSearchParams({
    tab: "lista-inscritos",
    day: values.day,
    status: values.status,
    kind: values.kind,
    page: String(values.page),
    pageSize: String(values.pageSize),
  });
  if (values.q.trim()) params.set("q", values.q.trim());
  return `${navigation.basePath}?${params.toString()}`;
}

function registrationMatchesKind(
  registration: ReportRegistration,
  dayCutoffById: Map<string, string>,
  kind: RegistrationKindFilter
) {
  if (kind === "all") return true;
  const cutoff = dayCutoffById.get(registration.eventDayId);
  if (!cutoff) return false;
  return kind === "onsite" ? registration.createdAt >= cutoff : registration.createdAt < cutoff;
}

export default async function ReportsPage({ params, searchParams }: ReportsPageProps) {
  const session = await requireSession(["super_adm", "organizador"]);
  const { eventId } = await params;
  const query = await searchParams;
  return EventReportsView({
    eventId,
    query,
    role: session.role,
    navigation: {
      basePath: `/events/${eventId}/relatorios`,
      overviewPath: `/events/${eventId}/lista-do-dia?scope=event`,
    },
  });
}

export async function EventReportsView({
  eventId,
  query,
  role,
  navigation,
}: {
  eventId: string;
  query: ReportSearchParams;
  role: AppRole;
  navigation: ReportNavigation;
}) {
  const activeTab = parseTab(query.tab);
  const statusFilter = parseStatus(query.status);
  const kindFilter = parseKind(query.kind);
  const requestedPage = parsePage(query.page);
  const pageSize = parsePageSize(query.pageSize);
  const attendanceFilter = parseAttendance(query.attendance);
  const searchText = (query.q ?? "").trim();
  const foundation = await getEventReportFoundation(eventId);
  if (!foundation) notFound();

  const eventDays = foundation.days;
  const selectedDayId = eventDays.some((day) => day.id === query.day) ? String(query.day) : "all";
  const selectedDayIds = new Set(selectedDayId === "all" ? eventDays.map((day) => day.id) : [selectedDayId]);
  const selectedActiveRegistrations = foundation.registrations.filter((registration) =>
    selectedDayIds.has(registration.eventDayId)
  );
  const selectedCancelledRegistrations = foundation.cancelledRegistrations.filter((registration) =>
    selectedDayIds.has(registration.eventDayId)
  );
  const dayById = new Map(eventDays.map((day) => [day.id, day]));
  const dayCutoffById = new Map(eventDays.map((day) => [day.id, day.cutoff]));
  const expectedRegistrations = selectedActiveRegistrations.filter((registration) =>
    registrationMatchesKind(registration, dayCutoffById, "expected")
  );
  const onsiteRegistrations = selectedActiveRegistrations.filter((registration) =>
    registrationMatchesKind(registration, dayCutoffById, "onsite")
  );
  const updatedAt = new Date().toISOString();

  const statusRegistrations = statusFilter === "all"
    ? [...foundation.registrations, ...foundation.cancelledRegistrations]
    : statusFilter === "cancelled"
      ? foundation.cancelledRegistrations
      : foundation.registrations;
  const filteredRegistrations = statusRegistrations.filter(
    (registration) =>
      selectedDayIds.has(registration.eventDayId) &&
      registrationMatchesKind(registration, dayCutoffById, kindFilter)
  );
  const registrationsByParticipant = new Map<string, ReportRegistration[]>();
  filteredRegistrations.forEach((registration) => {
    const current = registrationsByParticipant.get(registration.participantId) ?? [];
    current.push(registration);
    registrationsByParticipant.set(registration.participantId, current);
  });
  const normalizedSearch = searchText.toLocaleLowerCase("pt-BR");
  const participantRows: ParticipantRegistrationRow[] = [...registrationsByParticipant.entries()]
    .flatMap(([participantId, registrations]) => {
      const participant = foundation.participantsById.get(participantId);
      if (!participant) return [];
      const searchable = [
        participant.participantNumber,
        participant.fullName,
        participant.documentType,
        participant.documentNumber,
        participant.email,
        participant.phone,
        participant.company,
        participant.jobTitle,
        participant.state,
        participant.city,
        participant.profession,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      if (normalizedSearch && !searchable.includes(normalizedSearch)) return [];

      return [{
        participant,
        registrations,
        activeDays: unique(
          registrations
            .filter((registration) => registration.status === "active")
            .map((registration) => dayById.get(registration.eventDayId)?.date)
            .filter((date): date is string => Boolean(date))
        ).sort(),
        cancelledDays: unique(
          registrations
            .filter((registration) => registration.status === "cancelled")
            .map((registration) => dayById.get(registration.eventDayId)?.date)
            .filter((date): date is string => Boolean(date))
        ).sort(),
        sources: unique(registrations.map((registration) => SOURCE_LABELS[registration.source])),
        hasActiveRegistration: registrations.some((registration) => registration.status === "active"),
      }];
    })
    .sort((left, right) => left.participant.fullName.localeCompare(right.participant.fullName, "pt-BR"));
  const totalPages = Math.max(1, Math.ceil(participantRows.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const paginatedRows = participantRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const listHrefValues = {
    day: selectedDayId,
    q: searchText,
    status: statusFilter,
    kind: kindFilter,
    pageSize,
  };

  return (
    <section className="space-y-6">
      <div className="surface-card overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--primary)]">Evento selecionado</p>
            <h1 className="mt-1 font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
              Relatórios
            </h1>
            <p className="mt-2 text-sm text-muted">
              {foundation.event.name}. Os dados cadastrais exibidos são sempre os dados atuais dos participantes.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <Form action={navigation.basePath} scroll={false}>
              <input type="hidden" name="tab" value={activeTab} />
              <input type="hidden" name="day" value={selectedDayId} />
              {activeTab === "lista-inscritos" ? (
                <>
                  <input type="hidden" name="q" value={searchText} />
                  <input type="hidden" name="status" value={statusFilter} />
                  <input type="hidden" name="kind" value={kindFilter} />
                  <input type="hidden" name="pageSize" value={pageSize} />
                </>
              ) : activeTab === "presenca-dia" || activeTab === "presenca-total" || activeTab === "presentes" ? (
                <>
                  <input type="hidden" name="q" value={searchText} />
                  <input type="hidden" name="attendance" value={attendanceFilter} />
                  <input type="hidden" name="pageSize" value={pageSize} />
                </>
              ) : activeTab === "sorteados" ? (
                <>
                  <input type="hidden" name="q" value={searchText} />
                  <input type="hidden" name="status" value={statusFilter} />
                  <input type="hidden" name="pageSize" value={pageSize} />
                </>
              ) : null}
              <SubmitButton
                pendingLabel="Atualizando..."
                className="gradient-primary min-h-11 rounded-xl px-4 text-sm font-bold text-white"
              >
                Atualizar agora
              </SubmitButton>
            </Form>
            <p className="text-xs text-muted">Última atualização: {formatSaoPauloDateTime(updatedAt)}</p>
          </div>
        </div>
        <ReportTabs activeTab={activeTab} navigation={navigation} />
      </div>

      {activeTab === "resumo-inscricoes" ? (
        <>
          <div className="surface-card rounded-2xl p-5 sm:p-6">
            <Form action={navigation.basePath} scroll={false} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <input type="hidden" name="tab" value="resumo-inscricoes" />
              <div>
                <label htmlFor="summary-day" className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">
                  Período
                </label>
                <select
                  id="summary-day"
                  name="day"
                  defaultValue={selectedDayId}
                  className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 text-sm font-semibold outline-none focus:border-[var(--primary)] sm:w-auto"
                >
                  <option value="all">Evento inteiro</option>
                  {eventDays.map((day) => <option key={day.id} value={day.id}>{formatDateOnly(day.date)}</option>)}
                </select>
              </div>
              <SubmitButton pendingLabel="Aplicando..." className="ghost-border min-h-11 rounded-xl bg-white px-4 text-sm font-semibold">
                Aplicar
              </SubmitButton>
            </Form>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Inscritos únicos", value: unique(selectedActiveRegistrations.map((item) => item.participantId)).length, detail: "Participantes ativos" },
              { label: "Participações", value: selectedActiveRegistrations.length, detail: "Soma dos dias selecionados" },
              { label: "Previstas", value: expectedRegistrations.length, detail: "Antes de 00h do dia" },
              { label: "No local", value: onsiteRegistrations.length, detail: "A partir de 00h do dia" },
              { label: "Canceladas", value: selectedCancelledRegistrations.length, detail: "Fora dos totais principais" },
            ].map((metric) => (
              <div key={metric.label} className="surface-card rounded-xl p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">{metric.label}</p>
                <p className="mt-2 font-headline text-3xl font-extrabold">{metric.value}</p>
                <p className="mt-1 text-xs text-muted">{metric.detail}</p>
              </div>
            ))}
          </div>

          <div className="surface-card overflow-hidden rounded-2xl">
            <div className="p-5 sm:p-6">
              <h2 className="font-headline text-xl font-extrabold">Inscrições por dia</h2>
              <p className="mt-1 text-sm text-muted">Participantes únicos e participações previstas para cada data.</p>
            </div>
            <div className="overflow-x-auto border-t border-[var(--surface-container)]">
              <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Inscritos únicos</th>
                    <th className="px-4 py-3">Participações</th>
                    <th className="px-4 py-3">Previstas</th>
                    <th className="px-4 py-3">No local</th>
                    <th className="px-4 py-3">Canceladas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-container)]">
                  {eventDays.filter((day) => selectedDayIds.has(day.id)).map((day) => (
                    <tr key={day.id}>
                      <td className="px-4 py-3 font-semibold">{formatDateOnly(day.date)}</td>
                      <td className="px-4 py-3">{day.uniqueRegisteredParticipantIds.length}</td>
                      <td className="px-4 py-3">{day.registrations.length}</td>
                      <td className="px-4 py-3">{day.expectedRegistrations.length}</td>
                      <td className="px-4 py-3">{day.onsiteRegistrations.length}</td>
                      <td className="px-4 py-3">
                        {foundation.cancelledRegistrations.filter((item) => item.eventDayId === day.id).length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="surface-card overflow-hidden rounded-2xl">
            <div className="p-5 sm:p-6">
              <h2 className="font-headline text-xl font-extrabold">Origem das inscrições ativas</h2>
              <p className="mt-1 text-sm text-muted">Distribuição operacional das participações no período selecionado.</p>
            </div>
            <div className="overflow-x-auto border-t border-[var(--surface-container)]">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
                  <tr><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Participações</th><th className="px-4 py-3">Percentual</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-container)]">
                  {(Object.keys(SOURCE_LABELS) as ReportRegistration["source"][]).map((source) => {
                    const count = selectedActiveRegistrations.filter((item) => item.source === source).length;
                    const percentage = selectedActiveRegistrations.length ? Math.round((count / selectedActiveRegistrations.length) * 10_000) / 100 : 0;
                    return <tr key={source}><td className="px-4 py-3 font-semibold">{SOURCE_LABELS[source]}</td><td className="px-4 py-3">{count}</td><td className="px-4 py-3">{percentage}%</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : activeTab === "lista-inscritos" ? (
        <>
          <div className="surface-card rounded-2xl p-5 sm:p-6">
            <Form action={navigation.basePath} scroll={false} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_repeat(4,1fr)_auto] xl:items-end">
              <input type="hidden" name="tab" value="lista-inscritos" />
              <div>
                <label htmlFor="registration-search" className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Busca</label>
                <input id="registration-search" name="q" defaultValue={searchText} placeholder="Nome, número, documento ou contato" className="input-surface mt-1 min-h-11 w-full rounded-xl px-4 text-sm outline-none" />
              </div>
              <div>
                <label htmlFor="registration-day" className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Dia</label>
                <select id="registration-day" name="day" defaultValue={selectedDayId} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 text-sm">
                  <option value="all">Todos</option>
                  {eventDays.map((day) => <option key={day.id} value={day.id}>{formatDateOnly(day.date)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="registration-status" className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Status</label>
                <select id="registration-status" name="status" defaultValue={statusFilter} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 text-sm">
                  <option value="active">Ativas</option><option value="cancelled">Canceladas</option><option value="all">Todas</option>
                </select>
              </div>
              <div>
                <label htmlFor="registration-kind" className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Momento</label>
                <select id="registration-kind" name="kind" defaultValue={kindFilter} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 text-sm">
                  <option value="all">Todos</option><option value="expected">Previstas</option><option value="onsite">No local</option>
                </select>
              </div>
              <div>
                <label htmlFor="registration-page-size" className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Por página</label>
                <select id="registration-page-size" name="pageSize" defaultValue={String(pageSize)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 text-sm">
                  <option value="50">50</option><option value="100">100</option>
                </select>
              </div>
              <SubmitButton pendingLabel="Filtrando..." className="gradient-primary min-h-11 rounded-xl px-5 text-sm font-bold text-white">Aplicar</SubmitButton>
            </Form>
            <div className="mt-3 flex justify-end">
              <Link href={buildReportHref(navigation, { tab: "lista-inscritos" })} className="text-sm font-semibold text-[var(--primary)] hover:underline">Limpar filtros</Link>
            </div>
          </div>

          <div className="surface-card overflow-hidden rounded-2xl">
            <div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div><h2 className="font-headline text-xl font-extrabold">Participantes inscritos</h2><p className="mt-1 text-sm text-muted">{participantRows.length} participante(s) encontrado(s).</p></div>
              {role === "super_adm" ? <p className="text-xs font-semibold text-muted">Exportações serão liberadas no Bloco 7</p> : null}
            </div>

            <div className="divide-y divide-[var(--surface-container)] border-t border-[var(--surface-container)] lg:hidden">
              {paginatedRows.map((row) => (
                <article key={row.participant.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><Link href={`/participantes/${row.participant.id}`} className="font-bold text-[var(--foreground)] hover:text-[var(--primary)]">{row.participant.fullName}</Link><p className="font-mono text-lg font-black text-[var(--primary)]">{row.participant.participantNumber}</p></div>
                    {row.hasActiveRegistration ? <a href={`/api/events/${eventId}/credentials/${row.participant.id}`} className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-bold text-white">Credencial</a> : null}
                  </div>
                  <p className="mt-2 text-sm">{row.participant.documentType} {row.participant.documentNumber}</p>
                  <p className="mt-1 break-all text-sm text-muted">{row.participant.email} · {row.participant.phone}</p>
                  <p className="mt-1 text-sm text-muted">{row.participant.profession} · {[row.participant.city, row.participant.state].filter(Boolean).join(" / ")}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {row.activeDays.map((date) => <span key={`active-${date}`} className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">{formatDateOnly(date)}</span>)}
                    {row.cancelledDays.map((date) => <span key={`cancelled-${date}`} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{formatDateOnly(date)} cancelada</span>)}
                  </div>
                  <p className="mt-2 text-xs text-muted">Origem: {row.sources.join(", ")}</p>
                </article>
              ))}
              {!paginatedRows.length ? <p className="p-8 text-center text-sm text-muted">Nenhum participante encontrado.</p> : null}
            </div>

            <div className="hidden overflow-x-auto border-t border-[var(--surface-container)] lg:block">
              <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
                <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
                  <tr><th className="px-4 py-3">Número</th><th className="px-4 py-3">Participante</th><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Contato</th><th className="px-4 py-3">Profissão / Localidade</th><th className="px-4 py-3">Dias</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3 text-right">Ações</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-container)]">
                  {paginatedRows.map((row) => (
                    <tr key={row.participant.id}>
                      <td className="px-4 py-3 font-mono text-lg font-black text-[var(--primary)]">{row.participant.participantNumber}</td>
                      <td className="px-4 py-3"><Link href={`/participantes/${row.participant.id}`} className="font-semibold hover:text-[var(--primary)] hover:underline">{row.participant.fullName}</Link>{row.participant.company ? <p className="text-xs text-muted">{row.participant.company}{row.participant.jobTitle ? ` · ${row.participant.jobTitle}` : ""}</p> : null}</td>
                      <td className="px-4 py-3">{row.participant.documentType} {row.participant.documentNumber}</td>
                      <td className="px-4 py-3"><p>{row.participant.email}</p><p className="text-xs text-muted">{row.participant.phone}</p></td>
                      <td className="px-4 py-3"><p>{row.participant.profession}</p><p className="text-xs text-muted">{[row.participant.city, row.participant.state].filter(Boolean).join(" / ")}</p></td>
                      <td className="px-4 py-3"><div className="flex max-w-xs flex-wrap gap-1">{row.activeDays.map((date) => <span key={`active-${date}`} className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">{formatDateOnly(date)}</span>)}{row.cancelledDays.map((date) => <span key={`cancelled-${date}`} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{formatDateOnly(date)} cancelada</span>)}</div></td>
                      <td className="px-4 py-3">{row.sources.join(", ")}</td>
                      <td className="px-4 py-3 text-right"><div className="flex justify-end gap-2"><Link href={`/participantes/${row.participant.id}`} className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-3 py-2 text-xs font-bold">Cadastro</Link>{row.hasActiveRegistration ? <a href={`/api/events/${eventId}/credentials/${row.participant.id}`} className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-bold text-white">Credencial</a> : null}</div></td>
                    </tr>
                  ))}
                  {!paginatedRows.length ? <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted">Nenhum participante encontrado.</td></tr> : null}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 bg-[var(--surface-container-low)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted">Página {currentPage} de {totalPages} · {participantRows.length} resultado(s)</p>
              <div className="flex gap-2">
                {currentPage > 1 ? <Link href={buildListHref(navigation, { ...listHrefValues, page: currentPage - 1 })} className="rounded-lg border bg-white px-3 py-2 font-semibold">Anterior</Link> : null}
                {currentPage < totalPages ? <Link href={buildListHref(navigation, { ...listHrefValues, page: currentPage + 1 })} className="rounded-lg border bg-white px-3 py-2 font-semibold">Próxima</Link> : null}
              </div>
            </div>
          </div>
        </>
      ) : activeTab === "sorteados" ? (
        <RaffleReport
          navigation={navigation}
          foundation={foundation}
          selectedDayId={selectedDayId}
          searchText={searchText}
          statusFilter={statusFilter}
          requestedPage={requestedPage}
          pageSize={pageSize}
        />
      ) : (
        <PresenceReports
          eventId={eventId}
          navigation={navigation}
          activeTab={activeTab}
          foundation={foundation}
          selectedDayId={selectedDayId}
          searchText={searchText}
          attendanceFilter={attendanceFilter}
          requestedPage={requestedPage}
          pageSize={pageSize}
          notice={query.notice}
          noticeType={query.notice_type}
        />
      )}
    </section>
  );
}

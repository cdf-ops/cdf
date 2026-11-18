import { formatDateOnly, formatSaoPauloDateTime } from "@/lib/date-time";
import {
  getEventReportFoundation,
  type EventReportFoundation,
  type ReportParticipant,
  type ReportRegistration,
} from "@/lib/reports/event-report-foundation";
import type { ExportColumn, ExportValue, TabularExport } from "@/lib/reports/tabular-export";
import { createAdminClient } from "@/lib/supabase/admin";

export type ExportReportTab =
  | "resumo-inscricoes"
  | "lista-inscritos"
  | "presenca-dia"
  | "presenca-total"
  | "presentes"
  | "sorteados";

type ExportFilters = {
  tab: ExportReportTab;
  day: string;
  q: string;
  status: "active" | "cancelled" | "all";
  kind: "all" | "expected" | "onsite";
  attendance: "present" | "absent" | "all";
};

const SOURCE_LABELS: Record<ReportRegistration["source"], string> = {
  legacy: "Legado",
  public_registration: "Site",
  reception: "Recepção",
  admin: "Administração",
  import: "Importação",
};

const PARTICIPANT_COLUMNS: ExportColumn[] = [
  { key: "participantNumber", label: "Número", width: 12 },
  { key: "fullName", label: "Nome completo", width: 32 },
  { key: "documentType", label: "Tipo de documento", width: 18 },
  { key: "documentNumber", label: "Documento", width: 20 },
  { key: "email", label: "E-mail", width: 32 },
  { key: "phone", label: "Telefone", width: 18 },
  { key: "company", label: "Empresa", width: 24 },
  { key: "jobTitle", label: "Cargo", width: 24 },
  { key: "profession", label: "Profissão", width: 24 },
  { key: "city", label: "Cidade", width: 22 },
  { key: "state", label: "Estado", width: 12 },
];

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function participantValues(participant: ReportParticipant): Record<string, ExportValue> {
  return {
    participantNumber: participant.participantNumber,
    fullName: participant.fullName,
    documentType: participant.documentType,
    documentNumber: participant.documentNumber,
    email: participant.email,
    phone: participant.phone,
    company: participant.company,
    jobTitle: participant.jobTitle,
    profession: participant.profession,
    city: participant.city,
    state: participant.state,
  };
}

function matchesParticipant(participant: ReportParticipant, searchText: string) {
  const normalized = searchText.trim().toLocaleLowerCase("pt-BR");
  if (!normalized) return true;
  return Object.values(participantValues(participant))
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLocaleLowerCase("pt-BR")
    .includes(normalized);
}

function registrationKind(registration: ReportRegistration, foundation: EventReportFoundation) {
  const day = foundation.days.find((item) => item.id === registration.eventDayId);
  return day && registration.createdAt >= day.cutoff ? "onsite" : "expected";
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function baseExport(foundation: EventReportFoundation, tab: ExportReportTab) {
  const names: Record<ExportReportTab, string> = {
    "resumo-inscricoes": "Resumo de inscrições",
    "lista-inscritos": "Lista de inscritos",
    "presenca-dia": "Presença por dia",
    "presenca-total": "Presença total",
    presentes: "Presentes e ausentes",
    sorteados: "Sorteados",
  };
  return {
    sheetName: names[tab],
    filename: `${slug(foundation.event.name) || "evento"}-${slug(names[tab])}`,
  };
}

function selectedDays(foundation: EventReportFoundation, selectedDayId: string) {
  return foundation.days.filter((day) => selectedDayId === "all" || day.id === selectedDayId);
}

function registrationsSummary(foundation: EventReportFoundation, filters: ExportFilters): TabularExport {
  const days = selectedDays(foundation, filters.day);
  return {
    ...baseExport(foundation, filters.tab),
    columns: [
      { key: "date", label: "Data", width: 14 },
      { key: "unique", label: "Inscritos únicos", width: 18 },
      { key: "registrations", label: "Participações", width: 16 },
      { key: "expected", label: "Previstas", width: 14 },
      { key: "onsite", label: "No local", width: 14 },
      { key: "cancelled", label: "Canceladas", width: 14 },
    ],
    rows: days.map((day) => ({
      date: formatDateOnly(day.date),
      unique: day.uniqueRegisteredParticipantIds.length,
      registrations: day.registrations.length,
      expected: day.expectedRegistrations.length,
      onsite: day.onsiteRegistrations.length,
      cancelled: foundation.cancelledRegistrations.filter((registration) => registration.eventDayId === day.id).length,
    })),
  };
}

function registrationList(foundation: EventReportFoundation, filters: ExportFilters): TabularExport {
  const dayById = new Map(foundation.days.map((day) => [day.id, day]));
  const registrations = (filters.status === "all"
    ? [...foundation.registrations, ...foundation.cancelledRegistrations]
    : filters.status === "cancelled"
      ? foundation.cancelledRegistrations
      : foundation.registrations)
    .filter((registration) => filters.day === "all" || registration.eventDayId === filters.day)
    .filter((registration) => filters.kind === "all" || registrationKind(registration, foundation) === filters.kind);
  const byParticipant = new Map<string, ReportRegistration[]>();
  registrations.forEach((registration) => {
    const current = byParticipant.get(registration.participantId) ?? [];
    current.push(registration);
    byParticipant.set(registration.participantId, current);
  });
  const rows = [...byParticipant.entries()]
    .flatMap(([participantId, participantRegistrations]) => {
      const participant = foundation.participantsById.get(participantId);
      if (!participant || !matchesParticipant(participant, filters.q)) return [];
      return [{
        ...participantValues(participant),
        sortName: participant.fullName,
        activeDays: unique(participantRegistrations.filter((item) => item.status === "active").map((item) => dayById.get(item.eventDayId)?.date).filter(Boolean)).map((date) => formatDateOnly(String(date))).join(", "),
        cancelledDays: unique(participantRegistrations.filter((item) => item.status === "cancelled").map((item) => dayById.get(item.eventDayId)?.date).filter(Boolean)).map((date) => formatDateOnly(String(date))).join(", "),
        sources: unique(participantRegistrations.map((item) => SOURCE_LABELS[item.source])).join(", "),
        moments: unique(participantRegistrations.map((item) => registrationKind(item, foundation) === "onsite" ? "No local" : "Prevista")).join(", "),
        registrations: participantRegistrations.length,
      }];
    })
    .sort((left, right) => left.sortName.localeCompare(right.sortName, "pt-BR"));
  return {
    ...baseExport(foundation, filters.tab),
    columns: [
      ...PARTICIPANT_COLUMNS,
      { key: "activeDays", label: "Dias ativos", width: 30 },
      { key: "cancelledDays", label: "Dias cancelados", width: 30 },
      { key: "sources", label: "Origem", width: 22 },
      { key: "moments", label: "Momento da inscrição", width: 20 },
      { key: "registrations", label: "Quantidade de inscrições", width: 22 },
    ],
    rows,
  };
}

function presenceByDay(foundation: EventReportFoundation, filters: ExportFilters): TabularExport {
  return {
    ...baseExport(foundation, filters.tab),
    columns: [
      { key: "date", label: "Data", width: 14 },
      { key: "registered", label: "Inscritos", width: 14 },
      { key: "expected", label: "Previstos", width: 14 },
      { key: "onsite", label: "No local", width: 14 },
      { key: "present", label: "Presentes", width: 14 },
      { key: "absent", label: "Ausentes", width: 14 },
      { key: "rate", label: "Taxa de presença (%)", width: 22 },
    ],
    rows: selectedDays(foundation, filters.day).map((day) => {
      const present = new Set(day.uniquePresentParticipantIds);
      return {
        date: formatDateOnly(day.date),
        registered: day.uniqueRegisteredParticipantIds.length,
        expected: day.uniqueExpectedParticipantIds.length,
        onsite: day.onsiteRegistrations.length,
        present: day.uniquePresentParticipantIds.length,
        absent: day.uniqueRegisteredParticipantIds.filter((id) => !present.has(id)).length,
        rate: day.uniqueRegisteredParticipantIds.length
          ? Math.round((day.uniquePresentParticipantIds.length / day.uniqueRegisteredParticipantIds.length) * 10_000) / 100
          : 0,
      };
    }),
  };
}

function totalPresence(foundation: EventReportFoundation, filters: ExportFilters): TabularExport {
  const days = selectedDays(foundation, filters.day);
  const dayIds = new Set(days.map((day) => day.id));
  const dayById = new Map(days.map((day) => [day.id, day]));
  const byParticipant = new Map<string, typeof foundation.officialCheckins>();
  foundation.officialCheckins.filter((checkin) => dayIds.has(checkin.eventDayId)).forEach((checkin) => {
    const current = byParticipant.get(checkin.participantId) ?? [];
    current.push(checkin);
    byParticipant.set(checkin.participantId, current);
  });
  const rows = [...byParticipant.entries()].flatMap(([participantId, checkins]) => {
    const participant = foundation.participantsById.get(participantId);
    if (!participant || !matchesParticipant(participant, filters.q)) return [];
    const ordered = [...checkins].sort((left, right) => left.checkedInAt.localeCompare(right.checkedInAt));
    return [{
      ...participantValues(participant),
      sortName: participant.fullName,
      days: unique(ordered.map((checkin) => dayById.get(checkin.eventDayId)?.date).filter(Boolean)).map((date) => formatDateOnly(String(date))).join(", "),
      presenceCount: ordered.length,
      firstEntry: ordered[0] ? formatSaoPauloDateTime(ordered[0].checkedInAt) : "",
      lastEntry: ordered.at(-1) ? formatSaoPauloDateTime(ordered.at(-1)!.checkedInAt) : "",
    }];
  });
  rows.sort((left, right) => left.sortName.localeCompare(right.sortName, "pt-BR"));
  return {
    ...baseExport(foundation, filters.tab),
    columns: [...PARTICIPANT_COLUMNS, { key: "days", label: "Dias presentes", width: 30 }, { key: "presenceCount", label: "Presenças", width: 14 }, { key: "firstEntry", label: "Primeira entrada", width: 22 }, { key: "lastEntry", label: "Última entrada", width: 22 }],
    rows,
  };
}

function attendanceList(foundation: EventReportFoundation, filters: ExportFilters): TabularExport {
  const rows = selectedDays(foundation, filters.day).flatMap((day) => {
    const participantIds = unique([...day.uniqueRegisteredParticipantIds, ...day.uniquePresentParticipantIds]);
    const expected = new Set(day.uniqueExpectedParticipantIds);
    const registered = new Set(day.uniqueRegisteredParticipantIds);
    const checkinByParticipant = new Map(day.officialCheckins.map((checkin) => [checkin.participantId, checkin]));
    return participantIds.flatMap((participantId) => {
      const participant = foundation.participantsById.get(participantId);
      if (!participant || !matchesParticipant(participant, filters.q)) return [];
      const checkin = checkinByParticipant.get(participantId);
      const status = checkin ? "present" : "absent";
      if (filters.attendance !== "all" && filters.attendance !== status) return [];
      return [{
        date: formatDateOnly(day.date),
        ...participantValues(participant),
        registrationType: expected.has(participantId) ? "Prevista" : registered.has(participantId) ? "No local" : "Sem inscrição",
        attendance: checkin ? "Presente" : "Ausente",
        checkinAt: checkin ? formatSaoPauloDateTime(checkin.checkedInAt) : "",
      }];
    });
  });
  return {
    ...baseExport(foundation, filters.tab),
    columns: [{ key: "date", label: "Data", width: 14 }, ...PARTICIPANT_COLUMNS, { key: "registrationType", label: "Inscrição", width: 18 }, { key: "attendance", label: "Situação", width: 14 }, { key: "checkinAt", label: "Check-in", width: 22 }],
    rows,
  };
}

async function raffleWinners(foundation: EventReportFoundation, filters: ExportFilters): Promise<TabularExport> {
  const admin = createAdminClient();
  const dayIds = foundation.days.map((day) => day.id);
  const dayById = new Map(foundation.days.map((day) => [day.id, day]));
  const { data: raffleData, error: raffleError } = dayIds.length
    ? await admin.from("raffles").select("id, event_day_id, prize_description, executed_at, created_at, deleted_at").in("event_day_id", dayIds)
    : { data: [], error: null };
  if (raffleError) throw new Error("Não foi possível exportar os sorteios.");
  const raffles = (raffleData ?? [])
    .filter((raffle) => filters.day === "all" || raffle.event_day_id === filters.day)
    .filter((raffle) => filters.status === "all" || (filters.status === "cancelled" ? Boolean(raffle.deleted_at) : !raffle.deleted_at));
  const raffleById = new Map(raffles.map((raffle) => [raffle.id, raffle]));
  const { data: winners, error: winnerError } = raffles.length
    ? await admin.from("raffle_winners").select("id, raffle_id, participant_id, created_at").in("raffle_id", raffles.map((raffle) => raffle.id))
    : { data: [], error: null };
  if (winnerError) throw new Error("Não foi possível exportar os ganhadores.");
  const participantIds = unique((winners ?? []).map((winner) => winner.participant_id));
  const missingIds = participantIds.filter((id) => !foundation.participantsById.has(id));
  const { data: missingParticipants } = missingIds.length
    ? await admin.from("participants").select("id, participant_number, full_name, document_type, document_number, email, phone, company, job_title, state, city, profession").in("id", missingIds)
    : { data: [] };
  const participantById = new Map(foundation.participantsById);
  (missingParticipants ?? []).forEach((participant) => participantById.set(participant.id, {
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
  }));
  const rounds = new Map<string, number>();
  foundation.days.forEach((day) => {
    raffles.filter((raffle) => raffle.event_day_id === day.id).sort((left, right) => (left.executed_at ?? left.created_at).localeCompare(right.executed_at ?? right.created_at)).forEach((raffle, index) => rounds.set(raffle.id, index + 1));
  });
  const rows = (winners ?? []).flatMap((winner) => {
    const raffle = raffleById.get(winner.raffle_id);
    const participant = participantById.get(winner.participant_id);
    const day = raffle ? dayById.get(raffle.event_day_id) : null;
    if (!raffle || !participant || !day || !matchesParticipant(participant, filters.q)) return [];
    return [{
      date: formatDateOnly(day.date),
      round: rounds.get(raffle.id) ?? 0,
      ...participantValues(participant),
      prize: raffle.prize_description || "Não informado",
      status: raffle.deleted_at ? "Cancelada" : "Válida",
      executedAt: raffle.executed_at ? formatSaoPauloDateTime(raffle.executed_at) : "",
      cancelledAt: raffle.deleted_at ? formatSaoPauloDateTime(raffle.deleted_at) : "",
    }];
  });
  return {
    ...baseExport(foundation, filters.tab),
    columns: [{ key: "date", label: "Data", width: 14 }, { key: "round", label: "Rodada", width: 12 }, ...PARTICIPANT_COLUMNS, { key: "prize", label: "Prêmio", width: 28 }, { key: "status", label: "Status", width: 14 }, { key: "executedAt", label: "Execução", width: 22 }, { key: "cancelledAt", label: "Cancelamento", width: 22 }],
    rows,
  };
}

export async function getReportExportData(eventId: string, filters: ExportFilters) {
  const foundation = await getEventReportFoundation(eventId);
  if (!foundation) return null;
  if (filters.tab === "resumo-inscricoes") return registrationsSummary(foundation, filters);
  if (filters.tab === "lista-inscritos") return registrationList(foundation, filters);
  if (filters.tab === "presenca-dia") return presenceByDay(foundation, filters);
  if (filters.tab === "presenca-total") return totalPresence(foundation, filters);
  if (filters.tab === "presentes") return attendanceList(foundation, filters);
  return raffleWinners(foundation, filters);
}

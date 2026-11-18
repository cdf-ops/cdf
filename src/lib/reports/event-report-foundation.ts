import { getSaoPauloDayStartIso } from "@/lib/date-time";
import { createAdminClient } from "@/lib/supabase/admin";

export type ReportParticipant = {
  id: string;
  participantNumber: number;
  fullName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phone: string;
  company: string | null;
  jobTitle: string | null;
  state: string;
  city: string;
  profession: string;
};

export type ReportRegistration = {
  id: string;
  participantId: string;
  eventDayId: string;
  source: "legacy" | "public_registration" | "reception" | "admin" | "import";
  createdAt: string;
  status: "active" | "cancelled";
  cancelledAt: string | null;
};

export type ReportCheckin = {
  id: string;
  participantId: string;
  eventDayId: string;
  checkedInAt: string;
  origin: string;
};

export type EventDayReportFoundation = {
  id: string;
  date: string;
  cutoff: string;
  registrations: ReportRegistration[];
  expectedRegistrations: ReportRegistration[];
  onsiteRegistrations: ReportRegistration[];
  officialCheckins: ReportCheckin[];
  uniqueRegisteredParticipantIds: string[];
  uniqueExpectedParticipantIds: string[];
  uniquePresentParticipantIds: string[];
  absentExpectedParticipantIds: string[];
  presenceRate: number;
};

export type EventReportFoundation = {
  event: { id: string; name: string; status: string };
  participantsById: Map<string, ReportParticipant>;
  registrations: ReportRegistration[];
  cancelledRegistrations: ReportRegistration[];
  officialCheckins: ReportCheckin[];
  days: EventDayReportFoundation[];
  totals: {
    uniqueRegisteredParticipants: number;
    participationSlots: number;
    expectedParticipationSlots: number;
    onsiteParticipationSlots: number;
    uniquePresentParticipants: number;
    accumulatedPresences: number;
  };
};

function unique(values: string[]) {
  return [...new Set(values)];
}

export async function getEventReportFoundation(eventId: string): Promise<EventReportFoundation | null> {
  const admin = createAdminClient();
  const [{ data: event, error: eventError }, { data: eventDays, error: eventDaysError }] = await Promise.all([
    admin.from("events").select("id, name, status").eq("id", eventId).maybeSingle(),
    admin.from("event_days").select("id, date").eq("event_id", eventId).order("date"),
  ]);

  if (eventError || eventDaysError) {
    throw new Error("Não foi possível carregar os dados básicos do relatório.");
  }
  if (!event) return null;

  const dayIds = (eventDays ?? []).map((day) => day.id);
  if (!dayIds.length) {
    return {
      event,
      participantsById: new Map(),
      registrations: [],
      cancelledRegistrations: [],
      officialCheckins: [],
      days: [],
      totals: {
        uniqueRegisteredParticipants: 0,
        participationSlots: 0,
        expectedParticipationSlots: 0,
        onsiteParticipationSlots: 0,
        uniquePresentParticipants: 0,
        accumulatedPresences: 0,
      },
    };
  }

  const [{ data: registrationData, error: registrationError }, { data: checkinData, error: checkinError }] =
    await Promise.all([
      admin
        .from("event_registrations")
        .select("id, participant_id, event_day_id, registration_source, created_at, status, cancelled_at")
        .in("event_day_id", dayIds),
      admin
        .from("entry_checkins")
        .select("id, participant_id, event_day_id, checked_in_at, origin")
        .in("event_day_id", dayIds)
        .is("deleted_at", null),
    ]);

  if (registrationError || checkinError) {
    throw new Error("Não foi possível carregar inscrições e presenças do relatório.");
  }

  const allRegistrations: ReportRegistration[] = (registrationData ?? []).map((registration) => ({
    id: registration.id,
    participantId: registration.participant_id,
    eventDayId: registration.event_day_id,
    source: registration.registration_source,
    createdAt: registration.created_at,
    status: registration.status,
    cancelledAt: registration.cancelled_at,
  }));
  const registrations = allRegistrations.filter((registration) => registration.status === "active");
  const cancelledRegistrations = allRegistrations.filter((registration) => registration.status === "cancelled");
  const officialCheckins: ReportCheckin[] = (checkinData ?? []).map((checkin) => ({
    id: checkin.id,
    participantId: checkin.participant_id,
    eventDayId: checkin.event_day_id,
    checkedInAt: checkin.checked_in_at,
    origin: checkin.origin,
  }));
  const participantIds = unique([
    ...registrations.map((registration) => registration.participantId),
    ...cancelledRegistrations.map((registration) => registration.participantId),
    ...officialCheckins.map((checkin) => checkin.participantId),
  ]);
  const { data: participantData, error: participantError } = participantIds.length
    ? await admin
        .from("participants")
        .select(
          "id, participant_number, full_name, document_type, document_number, email, phone, company, job_title, state, city, profession"
        )
        .in("id", participantIds)
    : { data: [], error: null };

  if (participantError) {
    throw new Error("Não foi possível carregar os participantes do relatório.");
  }

  const participantsById = new Map<string, ReportParticipant>(
    (participantData ?? []).map((participant) => [
      participant.id,
      {
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
      },
    ])
  );

  const days: EventDayReportFoundation[] = (eventDays ?? []).map((day) => {
    const cutoff = getSaoPauloDayStartIso(day.date);
    const dayRegistrations = registrations.filter((registration) => registration.eventDayId === day.id);
    const expectedRegistrations = dayRegistrations.filter((registration) => registration.createdAt < cutoff);
    const onsiteRegistrations = dayRegistrations.filter((registration) => registration.createdAt >= cutoff);
    const dayCheckins = officialCheckins.filter((checkin) => checkin.eventDayId === day.id);
    const uniqueExpectedParticipantIds = unique(expectedRegistrations.map((registration) => registration.participantId));
    const uniquePresentParticipantIds = unique(dayCheckins.map((checkin) => checkin.participantId));
    const presentSet = new Set(uniquePresentParticipantIds);
    const absentExpectedParticipantIds = uniqueExpectedParticipantIds.filter((participantId) => !presentSet.has(participantId));

    return {
      id: day.id,
      date: day.date,
      cutoff,
      registrations: dayRegistrations,
      expectedRegistrations,
      onsiteRegistrations,
      officialCheckins: dayCheckins,
      uniqueRegisteredParticipantIds: unique(dayRegistrations.map((registration) => registration.participantId)),
      uniqueExpectedParticipantIds,
      uniquePresentParticipantIds,
      absentExpectedParticipantIds,
      presenceRate: uniqueExpectedParticipantIds.length
        ? Math.round((uniquePresentParticipantIds.length / uniqueExpectedParticipantIds.length) * 10_000) / 100
        : 0,
    };
  });

  return {
    event,
    participantsById,
    registrations,
    cancelledRegistrations,
    officialCheckins,
    days,
    totals: {
      uniqueRegisteredParticipants: unique(registrations.map((registration) => registration.participantId)).length,
      participationSlots: registrations.length,
      expectedParticipationSlots: days.reduce((total, day) => total + day.expectedRegistrations.length, 0),
      onsiteParticipationSlots: days.reduce((total, day) => total + day.onsiteRegistrations.length, 0),
      uniquePresentParticipants: unique(officialCheckins.map((checkin) => checkin.participantId)).length,
      accumulatedPresences: officialCheckins.length,
    },
  };
}

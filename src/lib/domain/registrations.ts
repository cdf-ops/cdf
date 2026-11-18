import { randomUUID } from "crypto";
import { normalizeDocumentNumber, validateDocumentNumber } from "@/lib/domain/documents";
import {
  buildParticipantChanges,
  recordParticipantChanges,
  type ParticipantChangeSource,
  type ParticipantSnapshot,
} from "@/lib/participants/history";
import { createAdminClient } from "@/lib/supabase/admin";

export type ParticipantPayload = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phone: string;
  state: string;
  city: string;
  profession: string;
};

export { normalizeDocumentNumber };

type RegistrationOptions = {
  actorUserId?: string | null;
  auditAction?: string;
  registrationSource?: "legacy" | "public_registration" | "reception" | "admin" | "import";
  dataSharingNoticeVersion?: string | null;
  dataSharingNoticeAcknowledgedAt?: string | null;
};

const participantSelect =
  "id, participant_number, full_name, document_type, document_number, email, phone, company, job_title, state, city, profession" as const;

function cleanOptional(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function toParticipantSnapshot(value: {
  full_name: string;
  document_type: string;
  document_number: string;
  email: string;
  phone: string;
  company: string | null;
  job_title: string | null;
  state: string;
  city: string;
  profession: string;
}): ParticipantSnapshot {
  return {
    full_name: value.full_name,
    document_type: value.document_type,
    document_number: value.document_number,
    email: value.email,
    phone: value.phone,
    company: value.company,
    job_title: value.job_title,
    state: value.state,
    city: value.city,
    profession: value.profession,
  };
}

function getHistorySource(source: RegistrationOptions["registrationSource"]): ParticipantChangeSource {
  return source === "legacy" || !source ? "system" : source;
}

export async function registerParticipantInEventDays(
  eventId: string,
  selectedEventDayIds: string[],
  payload: ParticipantPayload,
  options?: RegistrationOptions
) {
  const admin = createAdminClient();
  const normalizedDocument = normalizeDocumentNumber(payload.documentNumber);
  const normalizedType = payload.documentType.trim().toUpperCase();
  if (!validateDocumentNumber(normalizedType, normalizedDocument)) {
    throw new Error("CPF inválido. Revise o número informado.");
  }

  const participantValues = {
    full_name: payload.fullName.trim(),
    document_type: normalizedType,
    document_number: normalizedDocument,
    email: payload.email.trim().toLowerCase(),
    phone: payload.phone.trim(),
    state: payload.state.trim().toUpperCase(),
    city: payload.city.trim(),
    profession: payload.profession.trim(),
  };

  const { data: participantByDocument, error: participantLookupError } = await admin
    .from("participants")
    .select(participantSelect)
    .eq("document_type", normalizedType)
    .eq("document_number", normalizedDocument)
    .maybeSingle();

  if (participantLookupError) {
    throw new Error("Não foi possível consultar o cadastro do participante.");
  }

  let participantId = participantByDocument?.id ?? null;
  let participantNumber = participantByDocument?.participant_number ?? null;
  if (!participantByDocument) {
    const { data: createdParticipant, error: participantError } = await admin
      .from("participants")
      .insert({
        ...participantValues,
      })
      .select(participantSelect)
      .single();

    if (participantError || !createdParticipant) {
      throw new Error("Não foi possível criar participante.");
    }

    participantId = createdParticipant.id;
    participantNumber = createdParticipant.participant_number;
    const createdSnapshot = toParticipantSnapshot(createdParticipant);
    const emptySnapshot = Object.fromEntries(
      Object.keys(createdSnapshot).map((field) => [field, null])
    ) as ParticipantSnapshot;
    await recordParticipantChanges({
      participantId,
      actorUserId: options?.actorUserId,
      source: getHistorySource(options?.registrationSource),
      changes: buildParticipantChanges(emptySnapshot, createdSnapshot),
    });
  } else {
    const before = toParticipantSnapshot(participantByDocument);
    const after: ParticipantSnapshot = {
      ...before,
      ...participantValues,
      company: cleanOptional(participantByDocument.company),
      job_title: cleanOptional(participantByDocument.job_title),
    };
    const changes = buildParticipantChanges(before, after);
    const { error: updateError } = await admin
      .from("participants")
      .update(participantValues)
      .eq("id", participantByDocument.id);

    if (updateError) {
      throw new Error("Não foi possível atualizar cadastro existente do participante.");
    }

    await recordParticipantChanges({
      participantId: participantByDocument.id,
      actorUserId: options?.actorUserId,
      source: getHistorySource(options?.registrationSource),
      changes,
    });
  }

  if (!participantId || !participantNumber) {
    throw new Error("Não foi possível obter o número global do participante.");
  }

  const uniqueEventDayIds = [...new Set(selectedEventDayIds)];
  const { data: existingRegistrations, error: existingRegistrationsError } = await admin
    .from("event_registrations")
    .select("id, event_day_id, status")
    .eq("participant_id", participantId)
    .in("event_day_id", uniqueEventDayIds);

  if (existingRegistrationsError) {
    throw new Error("Não foi possível consultar as inscrições existentes.");
  }

  const existingByDay = new Map((existingRegistrations ?? []).map((registration) => [registration.event_day_id, registration]));
  const reactivatedAt = new Date().toISOString();
  const reactivationResults = await Promise.all(
    (existingRegistrations ?? [])
      .filter((registration) => registration.status === "cancelled")
      .map((registration) =>
        admin
          .from("event_registrations")
          .update({
            status: "active",
            cancelled_at: null,
            cancelled_by: null,
            created_at: reactivatedAt,
            registration_source: options?.registrationSource ?? "legacy",
            data_sharing_notice_version: options?.dataSharingNoticeVersion ?? null,
            data_sharing_notice_acknowledged_at: options?.dataSharingNoticeAcknowledgedAt ?? null,
          })
          .eq("id", registration.id)
      )
  );
  if (reactivationResults.some((result) => result.error)) {
    throw new Error("Não foi possível reativar a inscrição do participante.");
  }

  const registrationRows = uniqueEventDayIds.filter((eventDayId) => !existingByDay.has(eventDayId)).map((eventDayId) => ({
    id: randomUUID(),
    participant_id: participantId,
    event_day_id: eventDayId,
    registration_source: options?.registrationSource ?? "legacy",
    data_sharing_notice_version: options?.dataSharingNoticeVersion ?? null,
    data_sharing_notice_acknowledged_at: options?.dataSharingNoticeAcknowledgedAt ?? null,
  }));

  const { error: registrationError } = registrationRows.length
    ? await admin.from("event_registrations").insert(registrationRows)
    : { error: null };

  if (registrationError) {
    throw new Error("Não foi possível concluir inscrição nos dias selecionados.");
  }

  await admin.from("audit_logs").insert({
    actor_user_id: options?.actorUserId ?? null,
    action: options?.auditAction ?? "PUBLIC_REGISTRATION_COMPLETED",
    context: {
      event_id: eventId,
      participant_id: participantId,
      participant_number: participantNumber,
      event_day_ids: uniqueEventDayIds,
    },
  });

  return { participantId, participantNumber };
}

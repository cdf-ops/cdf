import { randomUUID } from "crypto";
import { normalizeDocumentNumber, validateDocumentNumber } from "@/lib/domain/documents";
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
};

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

  const { data: participantByDocument } = await admin
    .from("participants")
    .select("id")
    .eq("document_type", normalizedType)
    .eq("document_number", normalizedDocument)
    .maybeSingle();

  let participantId = participantByDocument?.id ?? null;
  if (!participantId) {
    const { data: createdParticipant, error: participantError } = await admin
      .from("participants")
      .insert({
        full_name: payload.fullName.trim(),
        document_type: normalizedType,
        document_number: normalizedDocument,
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone.trim(),
        state: payload.state.trim(),
        city: payload.city.trim(),
        profession: payload.profession.trim(),
      })
      .select("id")
      .single();

    if (participantError || !createdParticipant) {
      throw new Error("Não foi possível criar participante.");
    }

    participantId = createdParticipant.id;
  } else {
    const { error: updateError } = await admin
      .from("participants")
      .update({
        full_name: payload.fullName.trim(),
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone.trim(),
        state: payload.state.trim(),
        city: payload.city.trim(),
        profession: payload.profession.trim(),
      })
      .eq("id", participantId);

    if (updateError) {
      throw new Error("Não foi possível atualizar cadastro existente do participante.");
    }
  }

  const registrationRows = selectedEventDayIds.map((eventDayId) => ({
    id: randomUUID(),
    participant_id: participantId,
    event_day_id: eventDayId,
  }));

  const { error: registrationError } = await admin
    .from("event_registrations")
    .upsert(registrationRows, { onConflict: "participant_id,event_day_id", ignoreDuplicates: true });

  if (registrationError) {
    throw new Error("Não foi possível concluir inscrição nos dias selecionados.");
  }

  await admin.from("audit_logs").insert({
    actor_user_id: options?.actorUserId ?? null,
    action: options?.auditAction ?? "PUBLIC_REGISTRATION_COMPLETED",
    context: {
      event_id: eventId,
      participant_id: participantId,
      event_day_ids: selectedEventDayIds,
    },
  });

  return { participantId };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type EnqueueRegistrationConfirmationInput = {
  eventId: string;
  participantId: string;
  participantNumber: number;
  fullName: string;
  email: string;
  city: string;
  state: string;
  profession: string;
};

export const BREVO_REGISTRATION_CONTACT_ATTRIBUTES = [
  "NOME_COMPLETO",
  "NUMERO_PARTICIPANTE",
  "CIDADE",
  "ESTADO",
  "PROFISSAO",
] as const;

export async function enqueueRegistrationConfirmation(
  admin: SupabaseClient<Database>,
  input: EnqueueRegistrationConfirmationInput
) {
  const { data: jobId, error } = await admin.rpc("enqueue_registration_confirmation", {
    p_event_id: input.eventId,
    p_participant_id: input.participantId,
    p_recipient_email: input.email.trim().toLowerCase(),
    p_contact_attributes: {
      NOME_COMPLETO: input.fullName.trim(),
      NUMERO_PARTICIPANTE: input.participantNumber,
      CIDADE: input.city.trim(),
      ESTADO: input.state.trim().toUpperCase(),
      PROFISSAO: input.profession.trim(),
    },
  });

  if (error) {
    throw new Error(`Não foi possível enfileirar a confirmação por e-mail: ${error.message}`);
  }

  return { jobId };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const EXHIBITOR_CONSENT_VERSION = "2026-07-29-v2";
export const EXHIBITOR_MINIMUM_DATA_NOTICE =
  "Quando você apresentar sua credencial em um estande, seu nome completo e número de participante serão compartilhados com aquele expositor para identificar e registrar a visita. CPF e outros documentos nunca serão compartilhados.";
export const EXHIBITOR_CONSENT_TEXT =
  "Autorizo o compartilhamento de dados adicionais com os expositores cujos estandes eu visitar. Cada expositor acessará somente os campos adicionais liberados pela organização, como contato, profissão ou localidade. Posso recusar sem impedir minha inscrição, entrada ou visita aos estandes.";

export type ExhibitorDataSettings = {
  share_email: boolean;
  share_phone: boolean;
  share_profession: boolean;
  share_city: boolean;
  share_state: boolean;
};

export const DEFAULT_EXHIBITOR_DATA_SETTINGS: ExhibitorDataSettings = {
  share_email: false,
  share_phone: false,
  share_profession: false,
  share_city: false,
  share_state: false,
};

export async function getExhibitorDataSettings(
  admin: SupabaseClient<Database>,
  eventId: string
): Promise<ExhibitorDataSettings> {
  const { data } = await admin
    .from("event_exhibitor_data_settings")
    .select("share_email, share_phone, share_profession, share_city, share_state")
    .eq("event_id", eventId)
    .maybeSingle();

  return data ?? DEFAULT_EXHIBITOR_DATA_SETTINGS;
}

type ParticipantData = {
  participant_number: number;
  full_name: string;
  email: string;
  phone: string;
  profession: string;
  city: string;
  state: string;
};

export function discloseParticipantData(
  participant: ParticipantData,
  settings: ExhibitorDataSettings,
  additionalDataConsentGranted: boolean
) {
  return {
    participant_number: participant.participant_number,
    full_name: participant.full_name,
    ...(additionalDataConsentGranted && settings.share_email ? { email: participant.email } : {}),
    ...(additionalDataConsentGranted && settings.share_phone ? { phone: participant.phone } : {}),
    ...(additionalDataConsentGranted && settings.share_profession ? { profession: participant.profession } : {}),
    ...(additionalDataConsentGranted && settings.share_city ? { city: participant.city } : {}),
    ...(additionalDataConsentGranted && settings.share_state ? { state: participant.state } : {}),
  };
}

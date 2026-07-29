import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const EXHIBITOR_CONSENT_VERSION = "2026-07-29-v1";
export const EXHIBITOR_CONSENT_TEXT =
  "Autorizo o compartilhamento dos meus dados com os expositores deste evento quando eu visitar seus estandes. Cada expositor acessará somente os dados liberados pela organização. Meu documento não será compartilhado. Posso recusar sem impedir minha inscrição ou participação.";

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
  consentGranted: boolean
) {
  if (!consentGranted) return null;

  return {
    participant_number: participant.participant_number,
    full_name: participant.full_name,
    ...(settings.share_email ? { email: participant.email } : {}),
    ...(settings.share_phone ? { phone: participant.phone } : {}),
    ...(settings.share_profession ? { profession: participant.profession } : {}),
    ...(settings.share_city ? { city: participant.city } : {}),
    ...(settings.share_state ? { state: participant.state } : {}),
  };
}

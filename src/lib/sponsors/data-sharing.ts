import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const SPONSOR_DATA_NOTICE_VERSION = "2026-10-30-v1";
export const SPONSOR_DATA_NOTICE =
  "Ao apresentar voluntariamente sua credencial em um estande, seu nome e os dados liberados pela organização poderão ser compartilhados com aquele patrocinador para registrar o atendimento. CPF, RG e outros documentos nunca serão compartilhados.";

export type SponsorDataSettings = {
  share_email: boolean;
  share_phone: boolean;
  share_company: boolean;
  share_profession: boolean;
  share_job_title: boolean;
  share_city: boolean;
  share_state: boolean;
};

export const DEFAULT_SPONSOR_DATA_SETTINGS: SponsorDataSettings = {
  share_email: false,
  share_phone: false,
  share_company: false,
  share_profession: false,
  share_job_title: false,
  share_city: false,
  share_state: false,
};

export async function getSponsorDataSettings(
  admin: SupabaseClient<Database>,
  eventId: string
): Promise<SponsorDataSettings> {
  const { data } = await admin
    .from("event_sponsor_data_settings")
    .select("share_email, share_phone, share_company, share_profession, share_job_title, share_city, share_state")
    .eq("event_id", eventId)
    .maybeSingle();

  return data ?? DEFAULT_SPONSOR_DATA_SETTINGS;
}

type ParticipantData = {
  full_name: string;
  email: string;
  phone: string;
  company: string | null;
  profession: string;
  job_title: string | null;
  city: string;
  state: string;
};

export function discloseSponsorParticipantData(participant: ParticipantData, settings: SponsorDataSettings) {
  return {
    full_name: participant.full_name,
    ...(settings.share_email ? { email: participant.email } : {}),
    ...(settings.share_phone ? { phone: participant.phone } : {}),
    ...(settings.share_company && participant.company ? { company: participant.company } : {}),
    ...(settings.share_profession ? { profession: participant.profession } : {}),
    ...(settings.share_job_title && participant.job_title ? { job_title: participant.job_title } : {}),
    ...(settings.share_city ? { city: participant.city } : {}),
    ...(settings.share_state ? { state: participant.state } : {}),
  };
}


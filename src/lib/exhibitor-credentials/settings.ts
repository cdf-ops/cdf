import type { Database } from "@/lib/supabase/database.types";

export type ExhibitorBadgeSettingsRow =
  Database["public"]["Tables"]["event_exhibitor_badge_settings"]["Row"];

export type ExhibitorBadgeSettings = Pick<
  ExhibitorBadgeSettingsRow,
  | "city_label"
  | "primary_color"
  | "secondary_color"
  | "front_label"
  | "social_heading"
  | "company_heading"
  | "institutional_text"
  | "schedule_heading"
  | "schedule_text"
  | "social_url"
  | "facebook_label"
  | "instagram_label"
  | "youtube_label"
  | "show_job_title"
  | "show_event_logo"
  | "show_social_qr"
  | "company_logo_size"
>;

export const DEFAULT_EXHIBITOR_BADGE_SETTINGS: ExhibitorBadgeSettings = {
  city_label: null,
  primary_color: "#09050a",
  secondary_color: "#d9dadd",
  front_label: "EXPOSITOR",
  social_heading: "Acompanhe o Clube do Frio",
  company_heading: "EQUIPE EXPOSITORA",
  institutional_text:
    "O Clube do Frio promove conhecimento, relacionamento e valorização dos profissionais do setor de refrigeração.",
  schedule_heading: "PROGRAMAÇÃO",
  schedule_text: null,
  social_url: "https://www.instagram.com/clubedofrio/",
  facebook_label: "Clube Do Frio",
  instagram_label: "@ClubeDoFrio",
  youtube_label: "Clube Do Frio",
  show_job_title: true,
  show_event_logo: true,
  show_social_qr: true,
  company_logo_size: "medium",
};

export function resolveExhibitorBadgeSettings(
  settings: Partial<ExhibitorBadgeSettings> | null | undefined
): ExhibitorBadgeSettings {
  return {
    ...DEFAULT_EXHIBITOR_BADGE_SETTINGS,
    ...settings,
  };
}

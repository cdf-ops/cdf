import type { Database } from "@/lib/supabase/database.types";

export type BadgeSettingsRow = Database["public"]["Tables"]["event_badge_settings"]["Row"];

export type BadgeSettings = Pick<
  BadgeSettingsRow,
  | "city_label"
  | "primary_color"
  | "secondary_color"
  | "institutional_text"
  | "schedule_text"
  | "social_url"
  | "facebook_label"
  | "instagram_label"
  | "youtube_label"
  | "certificate_url"
>;

export const DEFAULT_BADGE_SETTINGS: BadgeSettings = {
  city_label: null,
  primary_color: "#09050a",
  secondary_color: "#d9dadd",
  institutional_text:
    "O Clube do Frio promove conhecimento, relacionamento e valorização dos profissionais do setor de refrigeração.",
  schedule_text: null,
  social_url: "https://www.instagram.com/clubedofrio/",
  facebook_label: "Clube Do Frio",
  instagram_label: "@ClubeDoFrio",
  youtube_label: "Clube Do Frio",
  certificate_url: null,
};

export function resolveBadgeSettings(settings: Partial<BadgeSettings> | null | undefined): BadgeSettings {
  return {
    ...DEFAULT_BADGE_SETTINGS,
    ...settings,
  };
}

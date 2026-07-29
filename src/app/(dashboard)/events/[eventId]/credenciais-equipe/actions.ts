"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const optionalUrl = z.union([z.literal(""), z.url("Informe uma URL válida.")]);
const settingsSchema = z.object({
  eventId: z.string().uuid(),
  cityLabel: z.string().trim().max(100),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  frontLabel: z.string().trim().min(2).max(40),
  socialHeading: z.string().trim().min(2).max(100),
  companyHeading: z.string().trim().min(2).max(80),
  institutionalText: z.string().trim().max(700),
  scheduleHeading: z.string().trim().min(2).max(60),
  scheduleText: z.string().trim().max(900),
  socialUrl: optionalUrl,
  facebookLabel: z.string().trim().max(80),
  instagramLabel: z.string().trim().max(80),
  youtubeLabel: z.string().trim().max(80),
  companyLogoSize: z.enum(["small", "medium", "large"]),
});

export async function saveExhibitorBadgeSettingsAction(formData: FormData) {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = settingsSchema.safeParse({
    eventId: formData.get("event_id"),
    cityLabel: formData.get("city_label"),
    primaryColor: formData.get("primary_color"),
    secondaryColor: formData.get("secondary_color"),
    frontLabel: formData.get("front_label"),
    socialHeading: formData.get("social_heading"),
    companyHeading: formData.get("company_heading"),
    institutionalText: formData.get("institutional_text"),
    scheduleHeading: formData.get("schedule_heading"),
    scheduleText: formData.get("schedule_text"),
    socialUrl: formData.get("social_url"),
    facebookLabel: formData.get("facebook_label"),
    instagramLabel: formData.get("instagram_label"),
    youtubeLabel: formData.get("youtube_label"),
    companyLogoSize: formData.get("company_logo_size"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Configuração da credencial da equipe inválida.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("event_exhibitor_badge_settings").upsert({
    event_id: parsed.data.eventId,
    city_label: parsed.data.cityLabel || null,
    primary_color: parsed.data.primaryColor,
    secondary_color: parsed.data.secondaryColor,
    front_label: parsed.data.frontLabel,
    social_heading: parsed.data.socialHeading,
    company_heading: parsed.data.companyHeading,
    institutional_text: parsed.data.institutionalText || null,
    schedule_heading: parsed.data.scheduleHeading,
    schedule_text: parsed.data.scheduleText || null,
    social_url: parsed.data.socialUrl || null,
    facebook_label: parsed.data.facebookLabel || null,
    instagram_label: parsed.data.instagramLabel || null,
    youtube_label: parsed.data.youtubeLabel || null,
    show_job_title: formData.get("show_job_title") === "on",
    show_event_logo: formData.get("show_event_logo") === "on",
    show_social_qr: formData.get("show_social_qr") === "on",
    company_logo_size: parsed.data.companyLogoSize,
    updated_by: session.userId,
  });
  if (error) throw new Error("Não foi possível salvar o modelo da credencial da equipe.");

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EXHIBITOR_BADGE_SETTINGS_UPDATED",
    context: { event_id: parsed.data.eventId },
  });
  revalidatePath(`/events/${parsed.data.eventId}/credenciais-equipe`);
}

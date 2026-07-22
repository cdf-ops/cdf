"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ensureParticipantBadge, getApplicationBaseUrl, getCredentialDownloadPath } from "@/lib/badges/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchConfiguredWebhook } from "@/lib/webhooks/dispatch";

const generateBadgeSchema = z.object({
  eventId: z.string().uuid(),
  participantId: z.string().uuid(),
});

const optionalUrl = z.union([z.literal(""), z.url("Informe uma URL válida.")]);
const saveSettingsSchema = z.object({
  eventId: z.string().uuid(),
  cityLabel: z.string().trim().max(100),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  institutionalText: z.string().trim().max(700),
  scheduleText: z.string().trim().max(900),
  socialUrl: optionalUrl,
  facebookLabel: z.string().trim().max(80),
  instagramLabel: z.string().trim().max(80),
  youtubeLabel: z.string().trim().max(80),
  certificateUrl: optionalUrl,
});

export async function generateBadgeAction(formData: FormData) {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = generateBadgeSchema.safeParse({
    eventId: formData.get("event_id"),
    participantId: formData.get("participant_id"),
  });
  if (!parsed.success) throw new Error("Dados inválidos para gerar credencial.");

  const admin = createAdminClient();
  const [{ data: participant }, { data: eventDays }, { data: event }] = await Promise.all([
    admin.from("participants").select("participant_number, full_name, email").eq("id", parsed.data.participantId).maybeSingle(),
    admin.from("event_days").select("id").eq("event_id", parsed.data.eventId),
    admin.from("events").select("name").eq("id", parsed.data.eventId).maybeSingle(),
  ]);
  if (!participant || !event) throw new Error("Participante ou evento não encontrado.");
  if (!eventDays?.length) throw new Error("Evento sem datas configuradas.");

  const { data: registration } = await admin
    .from("event_registrations")
    .select("id")
    .in("event_day_id", eventDays.map((day) => day.id))
    .eq("participant_id", parsed.data.participantId)
    .limit(1)
    .maybeSingle();
  if (!registration) throw new Error("Participante não está inscrito neste evento.");

  const badge = await ensureParticipantBadge(admin, {
    eventId: parsed.data.eventId,
    participantId: parsed.data.participantId,
    generatedBy: session.userId,
  });
  if (!badge.created) {
    await admin
      .from("badges")
      .update({ generated_by: session.userId, generated_at: new Date().toISOString() })
      .eq("id", badge.id);
  }

  const credentialPath = getCredentialDownloadPath(badge.download_slug);
  if (badge.created) {
    await dispatchConfiguredWebhook(admin, {
      eventType: "credential.generated",
      payload: {
        event_id: parsed.data.eventId,
        event_name: event.name,
        participant_id: parsed.data.participantId,
        participant_number: participant.participant_number,
        participant_name: participant.full_name,
        participant_email: participant.email,
        credential_url: `${getApplicationBaseUrl()}${credentialPath}`,
      },
    });
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "BADGE_GENERATED",
    context: {
      event_id: parsed.data.eventId,
      participant_id: parsed.data.participantId,
      participant_number: participant.participant_number,
      created: badge.created,
    },
  });

  revalidatePath(`/events/${parsed.data.eventId}/credentials`);
}

export async function saveBadgeSettingsAction(formData: FormData) {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = saveSettingsSchema.safeParse({
    eventId: formData.get("event_id"),
    cityLabel: formData.get("city_label"),
    primaryColor: formData.get("primary_color"),
    secondaryColor: formData.get("secondary_color"),
    institutionalText: formData.get("institutional_text"),
    scheduleText: formData.get("schedule_text"),
    socialUrl: formData.get("social_url"),
    facebookLabel: formData.get("facebook_label"),
    instagramLabel: formData.get("instagram_label"),
    youtubeLabel: formData.get("youtube_label"),
    certificateUrl: formData.get("certificate_url"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Configuração da credencial inválida.");

  const admin = createAdminClient();
  const { error } = await admin.from("event_badge_settings").upsert({
    event_id: parsed.data.eventId,
    city_label: parsed.data.cityLabel || null,
    primary_color: parsed.data.primaryColor,
    secondary_color: parsed.data.secondaryColor,
    institutional_text: parsed.data.institutionalText || null,
    schedule_text: parsed.data.scheduleText || null,
    social_url: parsed.data.socialUrl || null,
    facebook_label: parsed.data.facebookLabel || null,
    instagram_label: parsed.data.instagramLabel || null,
    youtube_label: parsed.data.youtubeLabel || null,
    certificate_url: parsed.data.certificateUrl || null,
    updated_by: session.userId,
  });
  if (error) throw new Error("Não foi possível salvar o modelo da credencial.");

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "BADGE_SETTINGS_UPDATED",
    context: { event_id: parsed.data.eventId },
  });
  revalidatePath(`/events/${parsed.data.eventId}/credentials`);
}

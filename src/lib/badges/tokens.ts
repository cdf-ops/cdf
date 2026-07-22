import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const SLUG_PATTERN = /^[a-zA-Z0-9_-]{16,128}$/;

export function createCredentialSlug() {
  return randomBytes(16).toString("hex");
}

export function extractCredentialSlug(value: string) {
  const trimmed = value.trim();
  if (SLUG_PATTERN.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/^\/q\/([^/]+)\/?$/);
    return match && SLUG_PATTERN.test(match[1]) ? match[1] : null;
  } catch {
    return null;
  }
}

type EnsureBadgeInput = {
  eventId: string;
  participantId: string;
  generatedBy?: string | null;
};

export async function ensureParticipantBadge(
  admin: SupabaseClient<Database>,
  { eventId, participantId, generatedBy = null }: EnsureBadgeInput
) {
  const { data: existing } = await admin
    .from("badges")
    .select("id, qr_slug, download_slug")
    .eq("event_id", eventId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (existing) {
    return { ...existing, created: false };
  }

  const { data: created, error } = await admin
    .from("badges")
    .insert({
      event_id: eventId,
      participant_id: participantId,
      generated_by: generatedBy,
      qr_slug: createCredentialSlug(),
      download_slug: createCredentialSlug(),
      pdf_url: null,
    })
    .select("id, qr_slug, download_slug")
    .single();

  if (error || !created) {
    if (error?.code === "23505") {
      const { data: concurrentBadge } = await admin
        .from("badges")
        .select("id, qr_slug, download_slug")
        .eq("event_id", eventId)
        .eq("participant_id", participantId)
        .maybeSingle();
      if (concurrentBadge) return { ...concurrentBadge, created: false };
    }
    throw new Error("Não foi possível gerar a credencial do participante.");
  }

  return { ...created, created: true };
}

export function getCredentialDownloadPath(downloadSlug: string) {
  return `/credencial/${downloadSlug}`;
}

export function getApplicationBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

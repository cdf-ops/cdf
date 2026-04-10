"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const standCheckinSchema = z.object({
  eventId: z.string().uuid(),
  eventDayId: z.string().uuid(),
  participantId: z.string().uuid(),
  redirectUrl: z.string().min(1),
});

function withNotice(url: string, type: "success" | "error", message: string) {
  const safeUrl = url.startsWith("/events/") ? url : "/events";
  const separator = safeUrl.includes("?") ? "&" : "?";
  return `${safeUrl}${separator}notice_type=${type}&notice=${encodeURIComponent(message)}`;
}

export async function registerStandCheckinAction(formData: FormData) {
  const session = await requireSession(["expositor"]);
  const parsed = standCheckinSchema.safeParse({
    eventId: formData.get("event_id"),
    eventDayId: formData.get("event_day_id"),
    participantId: formData.get("participant_id"),
    redirectUrl: formData.get("redirect_url"),
  });

  if (!parsed.success) {
    redirect(withNotice("/events", "error", "Dados inválidos para check-in do stand."));
  }

  const admin = createAdminClient();
  const { data: exhibitorUserRows } = await admin
    .from("exhibitor_users")
    .select("exhibitor_company_id")
    .eq("user_id", session.userId);
  const companyIds = (exhibitorUserRows ?? []).map((item) => item.exhibitor_company_id);

  if (!companyIds.length) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Seu usuário não está vinculado a uma empresa expositora."));
  }

  const { data: eventExhibitor } = await admin
    .from("event_exhibitors")
    .select("id")
    .eq("event_id", parsed.data.eventId)
    .in("exhibitor_company_id", companyIds)
    .maybeSingle();

  if (!eventExhibitor) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Sua empresa não está vinculada a este evento."));
  }

  const { data: hasEntryCheckin } = await admin
    .from("entry_checkins")
    .select("id")
    .eq("participant_id", parsed.data.participantId)
    .eq("event_day_id", parsed.data.eventDayId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!hasEntryCheckin) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Visitante sem check-in de entrada no evento."));
  }

  const { data: existingStandCheckin } = await admin
    .from("stand_checkins")
    .select("id")
    .eq("participant_id", parsed.data.participantId)
    .eq("event_day_id", parsed.data.eventDayId)
    .eq("event_exhibitor_id", eventExhibitor.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingStandCheckin) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Este visitante já foi registrado no seu stand hoje."));
  }

  const { error } = await admin.from("stand_checkins").insert({
    participant_id: parsed.data.participantId,
    event_day_id: parsed.data.eventDayId,
    event_exhibitor_id: eventExhibitor.id,
    operator_user_id: session.userId,
  });

  if (error) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Não foi possível registrar check-in do stand."));
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "STAND_CHECKIN_CREATED",
    context: {
      event_id: parsed.data.eventId,
      event_day_id: parsed.data.eventDayId,
      participant_id: parsed.data.participantId,
      event_exhibitor_id: eventExhibitor.id,
    },
  });

  redirect(withNotice(parsed.data.redirectUrl, "success", "Check-in do stand registrado com sucesso."));
}


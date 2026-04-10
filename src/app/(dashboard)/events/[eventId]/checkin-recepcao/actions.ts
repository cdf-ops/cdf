"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const entryCheckinSchema = z.object({
  eventId: z.string().uuid(),
  eventDayId: z.string().uuid(),
  participantId: z.string().uuid(),
  includeDay: z.union([z.literal("true"), z.literal("false")]),
  redirectUrl: z.string().min(1),
});

function withNotice(url: string, type: "success" | "error", message: string) {
  const safeUrl = url.startsWith("/events/") ? url : "/events";
  const separator = safeUrl.includes("?") ? "&" : "?";
  return `${safeUrl}${separator}notice_type=${type}&notice=${encodeURIComponent(message)}`;
}

export async function registerEntryCheckinAction(formData: FormData) {
  const session = await requireSession(["super_adm", "organizador", "recepcao"]);
  const parsed = entryCheckinSchema.safeParse({
    eventId: formData.get("event_id"),
    eventDayId: formData.get("event_day_id"),
    participantId: formData.get("participant_id"),
    includeDay: String(formData.get("include_day") ?? "false"),
    redirectUrl: String(formData.get("redirect_url") ?? ""),
  });

  if (!parsed.success) {
    redirect(
      withNotice(
        `/events/${String(formData.get("event_id") ?? "")}/checkin-recepcao`,
        "error",
        "Dados inválidos para check-in."
      )
    );
  }

  const admin = createAdminClient();
  const { data: eventDay } = await admin
    .from("event_days")
    .select("id")
    .eq("id", parsed.data.eventDayId)
    .eq("event_id", parsed.data.eventId)
    .maybeSingle();

  if (!eventDay) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Dia de evento inválido."));
  }

  if (parsed.data.includeDay === "true") {
    await admin.from("event_registrations").upsert(
      {
        participant_id: parsed.data.participantId,
        event_day_id: parsed.data.eventDayId,
      },
      {
        onConflict: "participant_id,event_day_id",
        ignoreDuplicates: true,
      }
    );
  }

  const { data: existingCheckin } = await admin
    .from("entry_checkins")
    .select("id")
    .eq("participant_id", parsed.data.participantId)
    .eq("event_day_id", parsed.data.eventDayId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingCheckin) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Participante já fez check-in neste dia."));
  }

  const { error } = await admin.from("entry_checkins").insert({
    participant_id: parsed.data.participantId,
    event_day_id: parsed.data.eventDayId,
    operator_user_id: session.userId,
    origin: "recepcao",
  });

  if (error) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Não foi possível registrar check-in."));
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "ENTRY_CHECKIN_CREATED",
    context: {
      event_id: parsed.data.eventId,
      event_day_id: parsed.data.eventDayId,
      participant_id: parsed.data.participantId,
      include_day: parsed.data.includeDay === "true",
    },
  });

  redirect(withNotice(parsed.data.redirectUrl, "success", "Check-in registrado com sucesso."));
}


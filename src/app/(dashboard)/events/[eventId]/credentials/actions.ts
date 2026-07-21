"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const generateBadgeSchema = z.object({
  eventId: z.string().uuid(),
  participantId: z.string().uuid(),
});

export async function generateBadgeAction(formData: FormData) {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = generateBadgeSchema.safeParse({
    eventId: formData.get("event_id"),
    participantId: formData.get("participant_id"),
  });

  if (!parsed.success) {
    throw new Error("Dados inválidos para gerar credencial.");
  }

  const admin = createAdminClient();
  const { data: participant } = await admin
    .from("participants")
    .select("participant_number")
    .eq("id", parsed.data.participantId)
    .maybeSingle();
  if (!participant) {
    throw new Error("Participante não encontrado.");
  }

  const { data: rawEventDays } = await admin.from("event_days").select("id").eq("event_id", parsed.data.eventId);
  const eventDays = rawEventDays ?? [];
  if (!eventDays.length) {
    throw new Error("Evento sem datas configuradas.");
  }

  const { data: registration } = await admin
    .from("event_registrations")
    .select("id")
    .in(
      "event_day_id",
      eventDays.map((day) => day.id)
    )
    .eq("participant_id", parsed.data.participantId)
    .limit(1)
    .maybeSingle();

  if (!registration) {
    throw new Error("Participante não está inscrito neste evento.");
  }

  const slug = randomBytes(8).toString("hex");
  const { data: existingBadge } = await admin
    .from("badges")
    .select("id")
    .eq("event_id", parsed.data.eventId)
    .eq("participant_id", parsed.data.participantId)
    .maybeSingle();

  if (existingBadge) {
    const { error: updateError } = await admin
      .from("badges")
      .update({
        generated_by: session.userId,
        generated_at: new Date().toISOString(),
      })
      .eq("id", existingBadge.id);

    if (updateError) {
      throw new Error("Não foi possível reemitir credencial.");
    }
  } else {
    const { error: insertError } = await admin.from("badges").insert({
      event_id: parsed.data.eventId,
      participant_id: parsed.data.participantId,
      generated_by: session.userId,
      qr_slug: slug,
      pdf_url: null,
    });

    if (insertError) {
      throw new Error("Não foi possível gerar credencial.");
    }
  }

  const webhookUrl = process.env.N8N_BADGE_WEBHOOK_URL;
  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: parsed.data.eventId,
        participant_id: parsed.data.participantId,
        participant_number: participant.participant_number,
      }),
    }).catch(() => undefined);
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "BADGE_GENERATED",
    context: {
      event_id: parsed.data.eventId,
      participant_id: parsed.data.participantId,
      participant_number: participant.participant_number,
    },
  });

  revalidatePath(`/events/${parsed.data.eventId}/credentials`);
}

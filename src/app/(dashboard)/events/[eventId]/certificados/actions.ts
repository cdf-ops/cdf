"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { issueCertificateForParticipant } from "@/lib/certificates/issue";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const issueCertificateSchema = z.object({
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

export async function issueCertificateAction(formData: FormData) {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = issueCertificateSchema.safeParse({
    eventId: formData.get("event_id"),
    eventDayId: formData.get("event_day_id"),
    participantId: formData.get("participant_id"),
    redirectUrl: formData.get("redirect_url"),
  });

  if (!parsed.success) {
    redirect("/events");
  }

  const admin = createAdminClient();
  try {
    await issueCertificateForParticipant(admin, {
      eventId: parsed.data.eventId,
      eventDayId: parsed.data.eventDayId,
      participantId: parsed.data.participantId,
      issuedBy: session.userId,
    });
  } catch (error) {
    redirect(
      withNotice(
        parsed.data.redirectUrl,
        "error",
        error instanceof Error ? error.message : "Não foi possível emitir o certificado."
      )
    );
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "CERTIFICATE_ISSUED",
    context: {
      event_id: parsed.data.eventId,
      event_day_id: parsed.data.eventDayId,
      participant_id: parsed.data.participantId,
    },
  });

  redirect(withNotice(parsed.data.redirectUrl, "success", "Certificado emitido e PDF gerado com sucesso."));
}

"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { EVENT_ASSETS_BUCKET } from "@/lib/certificates/assets";
import { generateCertificatePdf } from "@/lib/certificates/pdf";
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
  const [{ data: eventDay }, { data: participant }] = await Promise.all([
    admin.from("event_days").select("id, event_id, date").eq("id", parsed.data.eventDayId).maybeSingle(),
    admin.from("participants").select("id, full_name").eq("id", parsed.data.participantId).maybeSingle(),
  ]);

  if (!eventDay || eventDay.event_id !== parsed.data.eventId || !participant) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Dados do certificado não foram encontrados."));
  }

  const [{ data: event }, { data: settings }] = await Promise.all([
    admin.from("events").select("id, name, event_logo_path").eq("id", parsed.data.eventId).maybeSingle(),
    admin
      .from("event_certificate_settings")
      .select("background_path, sponsor_image_path, layout")
      .eq("event_id", parsed.data.eventId)
      .maybeSingle(),
  ]);

  if (!event || !settings?.background_path) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Configure o certificado antes de emitir."));
  }

  const { data: entryCheckin } = await admin
    .from("entry_checkins")
    .select("id")
    .eq("event_day_id", parsed.data.eventDayId)
    .eq("participant_id", parsed.data.participantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!entryCheckin) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Participante não tem check-in de entrada neste dia."));
  }

  const pdfBytes = await generateCertificatePdf(admin, {
    eventName: event.name,
    eventDate: eventDay.date,
    participantName: participant.full_name,
    eventLogoPath: event.event_logo_path,
    backgroundPath: settings.background_path,
    sponsorImagePath: settings.sponsor_image_path,
    layout: settings.layout,
  });
  const pdfPath = `events/${parsed.data.eventId}/certificates/${parsed.data.eventDayId}/${parsed.data.participantId}.pdf`;
  const { error: uploadError } = await admin.storage.from(EVENT_ASSETS_BUCKET).upload(pdfPath, Buffer.from(pdfBytes), {
    contentType: "application/pdf",
    upsert: true,
  });

  if (uploadError) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Não foi possível gerar o PDF do certificado."));
  }

  const { data: existingCertificate } = await admin
    .from("certificates")
    .select("id")
    .eq("event_day_id", parsed.data.eventDayId)
    .eq("participant_id", parsed.data.participantId)
    .maybeSingle();

  if (existingCertificate) {
    await admin
      .from("certificates")
      .update({
        issued_by: session.userId,
        issued_at: new Date().toISOString(),
        pdf_url: pdfPath,
      })
      .eq("id", existingCertificate.id);
  } else {
    await admin.from("certificates").insert({
      event_day_id: parsed.data.eventDayId,
      participant_id: parsed.data.participantId,
      issued_by: session.userId,
      pdf_url: pdfPath,
    });
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

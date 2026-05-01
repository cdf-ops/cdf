import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENT_ASSETS_BUCKET } from "@/lib/certificates/assets";
import { generateCertificatePdf } from "@/lib/certificates/pdf";
import type { Database } from "@/lib/supabase/database.types";

type IssueCertificateInput = {
  eventId: string;
  eventDayId: string;
  participantId: string;
  issuedBy: string | null;
};

export type IssueCertificateResult = {
  pdfPath: string;
  participantName: string;
  eventName: string;
  eventDate: string;
};

export async function issueCertificateForParticipant(
  admin: SupabaseClient<Database>,
  input: IssueCertificateInput
): Promise<IssueCertificateResult> {
  const [{ data: eventDay }, { data: participant }] = await Promise.all([
    admin.from("event_days").select("id, event_id, date").eq("id", input.eventDayId).maybeSingle(),
    admin.from("participants").select("id, full_name").eq("id", input.participantId).maybeSingle(),
  ]);

  if (!eventDay || eventDay.event_id !== input.eventId || !participant) {
    throw new Error("Dados do certificado não foram encontrados.");
  }

  const [{ data: event }, { data: settings }, { data: entryCheckin }] = await Promise.all([
    admin.from("events").select("id, name, event_logo_path").eq("id", input.eventId).maybeSingle(),
    admin
      .from("event_certificate_settings")
      .select("background_path, sponsor_image_path, layout")
      .eq("event_id", input.eventId)
      .maybeSingle(),
    admin
      .from("entry_checkins")
      .select("id")
      .eq("event_day_id", input.eventDayId)
      .eq("participant_id", input.participantId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (!event || !settings?.background_path) {
    throw new Error("Configure o certificado antes de emitir.");
  }

  if (!entryCheckin) {
    throw new Error("Participante não tem check-in de entrada neste dia.");
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
  const pdfPath = `events/${input.eventId}/certificates/${input.eventDayId}/${input.participantId}.pdf`;
  const { error: uploadError } = await admin.storage.from(EVENT_ASSETS_BUCKET).upload(pdfPath, Buffer.from(pdfBytes), {
    contentType: "application/pdf",
    upsert: true,
  });

  if (uploadError) {
    throw new Error("Não foi possível gerar o PDF do certificado.");
  }

  const { data: existingCertificate } = await admin
    .from("certificates")
    .select("id")
    .eq("event_day_id", input.eventDayId)
    .eq("participant_id", input.participantId)
    .maybeSingle();

  if (existingCertificate) {
    const { error } = await admin
      .from("certificates")
      .update({
        issued_by: input.issuedBy,
        issued_at: new Date().toISOString(),
        pdf_url: pdfPath,
      })
      .eq("id", existingCertificate.id);

    if (error) {
      throw new Error("Não foi possível atualizar o certificado.");
    }
  } else {
    const { error } = await admin.from("certificates").insert({
      event_day_id: input.eventDayId,
      participant_id: input.participantId,
      issued_by: input.issuedBy,
      pdf_url: pdfPath,
    });

    if (error) {
      throw new Error("Não foi possível registrar o certificado.");
    }
  }

  return {
    pdfPath,
    participantName: participant.full_name,
    eventName: event.name,
    eventDate: eventDay.date,
  };
}

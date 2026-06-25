"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createCertificateAccessToken } from "@/lib/certificates/public-token";
import { normalizeDocumentNumber, validateDocumentNumber } from "@/lib/domain/documents";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedDocumentTypes = ["CPF", "RNE", "OUTRO"];

const lookupSchema = z.object({
  eventId: z.string().uuid(),
  documentType: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => allowedDocumentTypes.includes(value)),
  documentNumber: z.string().trim().min(3),
});

export type PublicCertificateLookupState = {
  error: string | null;
  eligibleDays: { id: string; date: string; token: string }[];
};

export async function lookupPublicCertificate(
  _: PublicCertificateLookupState,
  formData: FormData
): Promise<PublicCertificateLookupState> {
  const parsed = lookupSchema.safeParse({
    eventId: formData.get("event_id"),
    documentType: formData.get("document_type"),
    documentNumber: formData.get("document_number"),
  });

  if (!parsed.success) {
    return { error: "Informe um documento válido.", eligibleDays: [] };
  }

  const documentType = parsed.data.documentType;
  const documentNumber = normalizeDocumentNumber(parsed.data.documentNumber);
  if (!validateDocumentNumber(documentType, documentNumber)) {
    return { error: "CPF inválido. Revise o número informado.", eligibleDays: [] };
  }

  const admin = createAdminClient();
  const [{ data: event }, { data: participant }] = await Promise.all([
    admin.from("events").select("id").eq("id", parsed.data.eventId).maybeSingle(),
    admin
      .from("participants")
      .select("id")
      .eq("document_type", documentType)
      .eq("document_number", documentNumber)
      .maybeSingle(),
  ]);

  if (!event || !participant) {
    return { error: "Não encontramos certificado disponível para este documento neste evento.", eligibleDays: [] };
  }

  const { data: eventDaysData } = await admin
    .from("event_days")
    .select("id, date")
    .eq("event_id", parsed.data.eventId)
    .order("date", { ascending: true });
  const eventDays = eventDaysData ?? [];

  if (!eventDays.length) {
    return { error: "Este evento não possui datas configuradas.", eligibleDays: [] };
  }

  const { data: checkinsData } = await admin
    .from("entry_checkins")
    .select("event_day_id")
    .eq("participant_id", participant.id)
    .in(
      "event_day_id",
      eventDays.map((day) => day.id)
    )
    .is("deleted_at", null);
  const checkedDayIds = new Set((checkinsData ?? []).map((checkin) => checkin.event_day_id));
  const eligibleDays = eventDays
    .filter((day) => checkedDayIds.has(day.id))
    .map((day) => ({
      id: day.id,
      date: day.date,
      token: createCertificateAccessToken({
        eventId: parsed.data.eventId,
        eventDayId: day.id,
        participantId: participant.id,
      }),
    }));

  if (!eligibleDays.length) {
    return { error: "Seu check-in de recepção não foi encontrado para este evento.", eligibleDays: [] };
  }

  if (eligibleDays.length === 1) {
    redirect(`/certificado/${parsed.data.eventId}/visualizar?token=${encodeURIComponent(eligibleDays[0].token)}`);
  }

  return {
    error: null,
    eligibleDays,
  };
}

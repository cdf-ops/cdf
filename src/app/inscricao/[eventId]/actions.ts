"use server";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerParticipantInEventDays } from "@/lib/domain/registrations";

const registrationSchema = z.object({
  eventId: z.string().uuid(),
  fullName: z.string().trim().min(3, "Nome completo é obrigatório."),
  documentType: z.string().trim().min(2, "Tipo de documento é obrigatório."),
  documentNumber: z.string().trim().min(3, "Documento é obrigatório."),
  email: z.string().email("E-mail inválido."),
  phone: z.string().trim().min(8, "Telefone é obrigatório."),
  state: z.string().trim().min(2, "Estado é obrigatório."),
  city: z.string().trim().min(2, "Cidade é obrigatória."),
  profession: z.string().trim().min(2, "Profissão é obrigatória."),
  selectedDays: z.array(z.string().uuid()).min(1, "Selecione ao menos um dia."),
  website: z.string().trim().optional(),
});

export type PublicRegistrationState = {
  error: string | null;
  success: string | null;
};

export async function submitPublicRegistration(
  _: PublicRegistrationState,
  formData: FormData
): Promise<PublicRegistrationState> {
  const selectedDaysRaw = formData.getAll("selected_days").map((value) => String(value));
  const parsed = registrationSchema.safeParse({
    eventId: formData.get("event_id"),
    fullName: formData.get("full_name"),
    documentType: formData.get("document_type"),
    documentNumber: formData.get("document_number"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    state: formData.get("state"),
    city: formData.get("city"),
    profession: formData.get("profession"),
    selectedDays: selectedDaysRaw,
    website: formData.get("website"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", success: null };
  }

  if (parsed.data.website) {
    return {
      error: null,
      success: "Inscrição concluída com sucesso. Sua participação foi registrada.",
    };
  }

  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("status").eq("id", parsed.data.eventId).maybeSingle();
  if (!event || event.status !== "ativo") {
    return { error: "Este evento não está recebendo inscrições no momento.", success: null };
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const origin = forwardedFor || requestHeaders.get("x-real-ip") || requestHeaders.get("cf-connecting-ip") || "unknown";
  const fingerprintHash = createHash("sha256").update(`${parsed.data.eventId}:${origin}`).digest("hex");
  const { data: isAllowed, error: rateLimitError } = await admin.rpc("check_public_registration_rate_limit", {
    p_event_id: parsed.data.eventId,
    p_fingerprint_hash: fingerprintHash,
  });

  if (rateLimitError) {
    return { error: "Não foi possível validar a inscrição. Tente novamente em instantes.", success: null };
  }

  if (!isAllowed) {
    return { error: "Muitas tentativas de inscrição. Aguarde alguns minutos e tente novamente.", success: null };
  }

  const { data: eventDays } = await admin
    .from("event_days")
    .select("id")
    .eq("event_id", parsed.data.eventId)
    .in("id", parsed.data.selectedDays);

  if (!eventDays || eventDays.length !== parsed.data.selectedDays.length) {
    return { error: "Dias selecionados não pertencem ao evento.", success: null };
  }

  try {
    await registerParticipantInEventDays(parsed.data.eventId, parsed.data.selectedDays, {
      fullName: parsed.data.fullName,
      documentType: parsed.data.documentType,
      documentNumber: parsed.data.documentNumber,
      email: parsed.data.email,
      phone: parsed.data.phone,
      state: parsed.data.state,
      city: parsed.data.city,
      profession: parsed.data.profession,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Falha ao concluir inscrição.",
      success: null,
    };
  }

  return {
    error: null,
    success: "Inscrição concluída com sucesso. Sua participação foi registrada.",
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerParticipantInEventDays } from "@/lib/domain/registrations";

const allowedDocumentTypes = ["CPF", "RNE", "OUTRO"];

const createParticipantSchema = z.object({
  eventId: z.string().uuid(),
  fullName: z.string().trim().min(3, "Nome completo é obrigatório."),
  documentType: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => allowedDocumentTypes.includes(value), "Tipo de documento inválido."),
  documentNumber: z.string().trim().min(3, "Documento é obrigatório."),
  email: z.string().email("E-mail inválido."),
  phone: z.string().trim().min(8, "Telefone é obrigatório."),
  state: z.string().trim().min(2, "Estado é obrigatório."),
  city: z.string().trim().min(2, "Cidade é obrigatória."),
  profession: z.string().trim().min(2, "Profissão é obrigatória."),
  selectedDays: z.array(z.string().uuid()).min(1, "Selecione ao menos um dia."),
});

export type CreateParticipantState = {
  error: string | null;
  success: string | null;
};

export async function createParticipantAction(
  _: CreateParticipantState,
  formData: FormData
): Promise<CreateParticipantState> {
  const session = await requireSession(["super_adm", "organizador", "recepcao"]);
  const selectedDaysRaw = formData.getAll("selected_days").map((value) => String(value));
  const parsed = createParticipantSchema.safeParse({
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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", success: null };
  }

  const admin = createAdminClient();
  const { data: eventDays } = await admin
    .from("event_days")
    .select("id")
    .eq("event_id", parsed.data.eventId)
    .in("id", parsed.data.selectedDays);

  if (!eventDays || eventDays.length !== parsed.data.selectedDays.length) {
    return { error: "Dias selecionados são inválidos para este evento.", success: null };
  }

  try {
    const { participantNumber } = await registerParticipantInEventDays(
      parsed.data.eventId,
      parsed.data.selectedDays,
      {
        fullName: parsed.data.fullName,
        documentType: parsed.data.documentType,
        documentNumber: parsed.data.documentNumber,
        email: parsed.data.email,
        phone: parsed.data.phone,
        state: parsed.data.state,
        city: parsed.data.city,
        profession: parsed.data.profession,
      },
      {
        actorUserId: session.userId,
        auditAction: "RECEPTION_REGISTRATION_COMPLETED",
      }
    );

    revalidatePath(`/events/${parsed.data.eventId}/participants`);
    return { error: null, success: `Participante ${participantNumber} salvo e incluído nos dias selecionados.` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível criar participante.",
      success: null,
    };
  }

}

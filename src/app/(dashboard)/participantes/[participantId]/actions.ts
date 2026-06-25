"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { normalizeDocumentNumber } from "@/lib/domain/registrations";
import { createAdminClient } from "@/lib/supabase/admin";

export type ParticipantDetailState = {
  error: string | null;
  success: string | null;
};

const updateParticipantSchema = z.object({
  participantId: z.string().uuid(),
  fullName: z.string().trim().min(3, "Nome completo é obrigatório."),
  documentType: z.string().trim().min(2, "Tipo de documento é obrigatório."),
  documentNumber: z.string().trim().min(3, "Documento é obrigatório."),
  email: z.string().trim().email("E-mail inválido."),
  phone: z.string().trim().min(8, "Telefone é obrigatório."),
  state: z.string().trim().min(2, "Estado é obrigatório."),
  city: z.string().trim().min(2, "Cidade é obrigatória."),
  profession: z.string().trim().min(2, "Profissão é obrigatória."),
});

const INITIAL_STATE: ParticipantDetailState = {
  error: null,
  success: null,
};

function withError(error: string): ParticipantDetailState {
  return { ...INITIAL_STATE, error };
}

export async function updateParticipantDetailsAction(
  _: ParticipantDetailState,
  formData: FormData
): Promise<ParticipantDetailState> {
  try {
    const session = await requireSession(["super_adm", "organizador"]);
    const parsed = updateParticipantSchema.safeParse({
      participantId: formData.get("participant_id"),
      fullName: formData.get("full_name"),
      documentType: formData.get("document_type"),
      documentNumber: formData.get("document_number"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      state: formData.get("state"),
      city: formData.get("city"),
      profession: formData.get("profession"),
    });

    if (!parsed.success) {
      return withError(parsed.error.issues[0]?.message ?? "Dados inválidos do participante.");
    }

    const admin = createAdminClient();
    const documentType = parsed.data.documentType.toUpperCase();
    const documentNumber = normalizeDocumentNumber(parsed.data.documentNumber);
    const { data: duplicateParticipant, error: duplicateError } = await admin
      .from("participants")
      .select("id")
      .eq("document_type", documentType)
      .eq("document_number", documentNumber)
      .neq("id", parsed.data.participantId)
      .maybeSingle();

    if (duplicateError) {
      console.error("updateParticipantDetailsAction.duplicateError", duplicateError);
      return withError("Não foi possível validar o documento informado.");
    }
    if (duplicateParticipant) {
      return withError("Já existe outro participante com este documento.");
    }

    const { data: participant, error } = await admin
      .from("participants")
      .update({
        full_name: parsed.data.fullName,
        document_type: documentType,
        document_number: documentNumber,
        email: parsed.data.email.toLowerCase(),
        phone: parsed.data.phone,
        state: parsed.data.state,
        city: parsed.data.city,
        profession: parsed.data.profession,
      })
      .eq("id", parsed.data.participantId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("updateParticipantDetailsAction.updateError", error);
      return withError("Não foi possível atualizar os dados do participante.");
    }
    if (!participant) {
      return withError("Participante não encontrado.");
    }

    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "PARTICIPANT_UPDATED",
      context: {
        participant_id: participant.id,
        document_type: documentType,
        document_number: documentNumber,
      },
    });

    revalidatePath("/participantes");
    revalidatePath(`/participantes/${participant.id}`);
    return { error: null, success: "Dados cadastrais atualizados com sucesso." };
  } catch (error) {
    console.error("updateParticipantDetailsAction.error", error);
    return withError("Não foi possível atualizar os dados do participante.");
  }
}

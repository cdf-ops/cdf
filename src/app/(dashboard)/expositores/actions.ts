"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasValidCnpjFormat, normalizeCnpj, normalizeEmail, normalizePhone } from "@/lib/exhibitors/helpers";
import { mapExhibitorDbErrorToUserMessage, mapUnexpectedExhibitorErrorToUserMessage } from "@/lib/exhibitors/db-errors";

const createExhibitorSchema = z.object({
  tradeName: z.string().trim().min(2, "Nome fantasia é obrigatório."),
  legalName: z.string().trim().min(2, "Razão social é obrigatória."),
  cnpj: z.string().trim().min(14, "CNPJ é obrigatório."),
  phone: z.string().trim().min(8, "Telefone é obrigatório."),
  email: z.string().trim().email("E-mail inválido.").optional().or(z.literal("")),
  contactName: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type CreateExhibitorState = {
  error: string | null;
  success: string | null;
};

const INITIAL_STATE: CreateExhibitorState = {
  error: null,
  success: null,
};

function withError(error: string): CreateExhibitorState {
  return { ...INITIAL_STATE, error };
}

function withSuccess(success: string): CreateExhibitorState {
  return { ...INITIAL_STATE, success };
}

export async function createExhibitorAction(
  _: CreateExhibitorState,
  formData: FormData
): Promise<CreateExhibitorState> {
  try {
    const session = await requireSession(["super_adm", "organizador"]);
    const parsed = createExhibitorSchema.safeParse({
      tradeName: formData.get("trade_name"),
      legalName: formData.get("legal_name"),
      cnpj: formData.get("cnpj"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      contactName: formData.get("contact_name"),
      notes: formData.get("notes"),
    });

    if (!parsed.success) {
      return withError(parsed.error.issues[0]?.message ?? "Dados inválidos para cadastro do expositor.");
    }

    const normalizedCnpj = normalizeCnpj(parsed.data.cnpj);
    if (!hasValidCnpjFormat(normalizedCnpj)) {
      return withError("CNPJ inválido. Informe 14 caracteres, com letras e números nas 12 primeiras posições e números nas 2 últimas.");
    }

    const admin = createAdminClient();
    const { data: existingCompany, error: existingCompanyError } = await admin
      .from("exhibitor_companies")
      .select("id")
      .eq("cnpj", normalizedCnpj)
      .maybeSingle();
    if (existingCompanyError) {
      console.error("createExhibitorAction.existingCompanyError", existingCompanyError);
      return withError(
        mapExhibitorDbErrorToUserMessage(existingCompanyError, "Não foi possível validar o CNPJ no cadastro de expositores.")
      );
    }
    if (existingCompany) {
      return withError("Já existe expositor cadastrado com este CNPJ.");
    }

    const payload = {
      name: parsed.data.tradeName,
      trade_name: parsed.data.tradeName,
      legal_name: parsed.data.legalName,
      cnpj: normalizedCnpj,
      phone: normalizePhone(parsed.data.phone),
      email: parsed.data.email ? normalizeEmail(parsed.data.email) : null,
      contact_name: parsed.data.contactName && parsed.data.contactName.length > 0 ? parsed.data.contactName : null,
      notes: parsed.data.notes && parsed.data.notes.length > 0 ? parsed.data.notes : null,
    };

    const { data: createdCompany, error } = await admin.from("exhibitor_companies").insert(payload).select("id").maybeSingle();
    if (error) {
      console.error("createExhibitorAction.insertError", error);
      return withError(mapExhibitorDbErrorToUserMessage(error, "Não foi possível cadastrar o expositor."));
    }

    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "EXHIBITOR_CREATED",
      context: {
        exhibitor_id: createdCompany?.id ?? null,
        cnpj: normalizedCnpj,
        trade_name: parsed.data.tradeName,
      },
    });

    revalidatePath("/expositores");
    return withSuccess("Expositor cadastrado com sucesso.");
  } catch (error) {
    console.error("createExhibitorAction.unexpectedError", error);
    return withError(mapUnexpectedExhibitorErrorToUserMessage(error, "Não foi possível cadastrar o expositor."));
  }
}

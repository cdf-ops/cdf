"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuthExhibitorUserByEmail, findAuthUserByEmail } from "@/lib/exhibitors/auth";
import { normalizeCnpj, normalizeEmail, normalizePhone } from "@/lib/exhibitors/helpers";

export type ExhibitorDetailState = {
  error: string | null;
  success: string | null;
};

const updateExhibitorSchema = z.object({
  exhibitorId: z.string().uuid(),
  tradeName: z.string().trim().min(2, "Nome fantasia é obrigatório."),
  legalName: z.string().trim().min(2, "Razão social é obrigatória."),
  cnpj: z.string().trim().min(14, "CNPJ é obrigatório."),
  phone: z.string().trim().min(8, "Telefone é obrigatório."),
  email: z.string().trim().email("E-mail inválido.").optional().or(z.literal("")),
  contactName: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const linkUserSchema = z.object({
  exhibitorId: z.string().uuid(),
  userEmail: z.string().trim().email("E-mail inválido."),
});

const unlinkUserSchema = z.object({
  exhibitorId: z.string().uuid(),
  userId: z.string().uuid(),
});

const linkEventSchema = z.object({
  exhibitorId: z.string().uuid(),
  eventId: z.string().uuid(),
  standName: z.string().trim().max(120, "Nome do stand deve ter no máximo 120 caracteres.").optional(),
});

const unlinkEventSchema = z.object({
  exhibitorId: z.string().uuid(),
  eventId: z.string().uuid(),
});

const INITIAL_STATE: ExhibitorDetailState = {
  error: null,
  success: null,
};

function withError(error: string): ExhibitorDetailState {
  return { ...INITIAL_STATE, error };
}

function withSuccess(success: string): ExhibitorDetailState {
  return { ...INITIAL_STATE, success };
}

function revalidateExhibitorPaths(exhibitorId: string, eventId?: string) {
  revalidatePath("/expositores");
  revalidatePath(`/expositores/${exhibitorId}`);
  if (eventId) {
    revalidatePath(`/events/${eventId}/checkin-expositor`);
    revalidatePath(`/events/${eventId}/participants`);
    revalidatePath(`/events/${eventId}/relatorios`);
  }
}

async function ensureExhibitorExists(exhibitorId: string) {
  const admin = createAdminClient();
  const { data: exhibitor } = await admin
    .from("exhibitor_companies")
    .select("id, trade_name, cnpj")
    .eq("id", exhibitorId)
    .maybeSingle();

  return exhibitor;
}

async function userHasConflictInExhibitorEvents(userId: string, exhibitorId: string) {
  const admin = createAdminClient();
  const { data: targetEventRows } = await admin.from("event_exhibitors").select("event_id").eq("exhibitor_company_id", exhibitorId);
  const targetEventIds = new Set((targetEventRows ?? []).map((item) => item.event_id));
  if (!targetEventIds.size) {
    return false;
  }

  const { data: userCompanyRows } = await admin
    .from("exhibitor_users")
    .select("exhibitor_company_id")
    .eq("user_id", userId)
    .neq("exhibitor_company_id", exhibitorId);
  const otherCompanyIds = [...new Set((userCompanyRows ?? []).map((item) => item.exhibitor_company_id))];
  if (!otherCompanyIds.length) {
    return false;
  }

  const { data: otherCompanyEventRows } = await admin
    .from("event_exhibitors")
    .select("event_id")
    .in("exhibitor_company_id", otherCompanyIds);

  return (otherCompanyEventRows ?? []).some((item) => targetEventIds.has(item.event_id));
}

async function exhibitorHasConflictForEvent(exhibitorId: string, eventId: string) {
  const admin = createAdminClient();

  const { data: companyUsers } = await admin
    .from("exhibitor_users")
    .select("user_id")
    .eq("exhibitor_company_id", exhibitorId);
  const companyUserIds = [...new Set((companyUsers ?? []).map((item) => item.user_id))];
  if (!companyUserIds.length) {
    return false;
  }

  const { data: userCompanyRows } = await admin
    .from("exhibitor_users")
    .select("user_id, exhibitor_company_id")
    .in("user_id", companyUserIds)
    .neq("exhibitor_company_id", exhibitorId);
  const otherCompanyIds = [...new Set((userCompanyRows ?? []).map((item) => item.exhibitor_company_id))];
  if (!otherCompanyIds.length) {
    return false;
  }

  const { data: companiesInEvent } = await admin
    .from("event_exhibitors")
    .select("exhibitor_company_id")
    .eq("event_id", eventId)
    .in("exhibitor_company_id", otherCompanyIds);
  const conflictingCompanyIds = new Set((companiesInEvent ?? []).map((item) => item.exhibitor_company_id));
  if (!conflictingCompanyIds.size) {
    return false;
  }

  return (userCompanyRows ?? []).some((item) => conflictingCompanyIds.has(item.exhibitor_company_id));
}

export async function updateExhibitorDetailsAction(
  _: ExhibitorDetailState,
  formData: FormData
): Promise<ExhibitorDetailState> {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = updateExhibitorSchema.safeParse({
    exhibitorId: formData.get("exhibitor_id"),
    tradeName: formData.get("trade_name"),
    legalName: formData.get("legal_name"),
    cnpj: formData.get("cnpj"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    contactName: formData.get("contact_name"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return withError(parsed.error.issues[0]?.message ?? "Dados inválidos do expositor.");
  }

  const normalizedCnpj = normalizeCnpj(parsed.data.cnpj);
  if (normalizedCnpj.length !== 14) {
    return withError("CNPJ deve conter 14 dígitos.");
  }

  const admin = createAdminClient();
  const exhibitor = await ensureExhibitorExists(parsed.data.exhibitorId);
  if (!exhibitor) {
    return withError("Expositor não encontrado.");
  }

  const { data: duplicateCnpj } = await admin
    .from("exhibitor_companies")
    .select("id")
    .eq("cnpj", normalizedCnpj)
    .neq("id", parsed.data.exhibitorId)
    .maybeSingle();
  if (duplicateCnpj) {
    return withError("Já existe outro expositor com este CNPJ.");
  }

  const { error } = await admin
    .from("exhibitor_companies")
    .update({
      name: parsed.data.tradeName,
      trade_name: parsed.data.tradeName,
      legal_name: parsed.data.legalName,
      cnpj: normalizedCnpj,
      phone: normalizePhone(parsed.data.phone),
      email: parsed.data.email ? normalizeEmail(parsed.data.email) : null,
      contact_name: parsed.data.contactName && parsed.data.contactName.length > 0 ? parsed.data.contactName : null,
      notes: parsed.data.notes && parsed.data.notes.length > 0 ? parsed.data.notes : null,
    })
    .eq("id", parsed.data.exhibitorId);

  if (error) {
    if (error.code === "23505") {
      return withError("Já existe outro expositor com este CNPJ.");
    }
    return withError("Não foi possível atualizar os dados do expositor.");
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EXHIBITOR_UPDATED",
    context: {
      exhibitor_id: parsed.data.exhibitorId,
      cnpj: normalizedCnpj,
      trade_name: parsed.data.tradeName,
    },
  });

  revalidateExhibitorPaths(parsed.data.exhibitorId);
  return withSuccess("Dados do expositor atualizados com sucesso.");
}

export async function linkExhibitorUserAction(
  _: ExhibitorDetailState,
  formData: FormData
): Promise<ExhibitorDetailState> {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = linkUserSchema.safeParse({
    exhibitorId: formData.get("exhibitor_id"),
    userEmail: formData.get("user_email"),
  });

  if (!parsed.success) {
    return withError(parsed.error.issues[0]?.message ?? "Dados inválidos para vínculo do usuário.");
  }

  const admin = createAdminClient();
  const exhibitor = await ensureExhibitorExists(parsed.data.exhibitorId);
  if (!exhibitor) {
    return withError("Expositor não encontrado.");
  }

  const userEmail = normalizeEmail(parsed.data.userEmail);
  let onboardingMessage = "";
  let authUser: Awaited<ReturnType<typeof findAuthUserByEmail>>;
  try {
    authUser = await findAuthUserByEmail(userEmail);
  } catch (error) {
    return withError(error instanceof Error ? error.message : "Falha ao consultar usuários.");
  }

  if (!authUser) {
    try {
      const created = await createAuthExhibitorUserByEmail(userEmail);
      authUser = created.user;
      onboardingMessage = ` Novo usuário criado no Auth. Senha temporária: ${created.temporaryPassword}`;
    } catch (error) {
      return withError(error instanceof Error ? error.message : "Falha ao criar usuário no Auth.");
    }

    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "EXHIBITOR_USER_CREATED_IN_AUTH",
      context: {
        exhibitor_id: parsed.data.exhibitorId,
        user_id: authUser.id,
        user_email: userEmail,
      },
    });
  }

  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", authUser.id)
    .maybeSingle();

  if (profile?.role === "super_adm" || profile?.role === "organizador") {
    return withError("Este usuário possui perfil administrativo e não pode ser convertido para expositor.");
  }

  const hasConflict = await userHasConflictInExhibitorEvents(authUser.id, parsed.data.exhibitorId);
  if (hasConflict) {
    return withError("Este usuário já está vinculado a outro expositor em pelo menos um evento em comum.");
  }

  const { error: roleError } = await admin.from("user_profiles").upsert({
    id: authUser.id,
    role: "expositor",
    status: "active",
  });
  if (roleError) {
    return withError("Não foi possível definir o perfil do usuário como expositor.");
  }

  const { error: linkError } = await admin.from("exhibitor_users").upsert(
    {
      user_id: authUser.id,
      exhibitor_company_id: parsed.data.exhibitorId,
    },
    { onConflict: "user_id,exhibitor_company_id", ignoreDuplicates: true }
  );
  if (linkError) {
    return withError("Não foi possível vincular usuário ao expositor.");
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EXHIBITOR_USER_LINKED",
    context: {
      exhibitor_id: parsed.data.exhibitorId,
      user_id: authUser.id,
      user_email: userEmail,
    },
  });

  revalidateExhibitorPaths(parsed.data.exhibitorId);
  return withSuccess(`Usuário vinculado com sucesso.${onboardingMessage}`);
}

export async function unlinkExhibitorUserAction(
  _: ExhibitorDetailState,
  formData: FormData
): Promise<ExhibitorDetailState> {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = unlinkUserSchema.safeParse({
    exhibitorId: formData.get("exhibitor_id"),
    userId: formData.get("user_id"),
  });

  if (!parsed.success) {
    return withError(parsed.error.issues[0]?.message ?? "Dados inválidos para desvincular usuário.");
  }

  const admin = createAdminClient();
  const exhibitor = await ensureExhibitorExists(parsed.data.exhibitorId);
  if (!exhibitor) {
    return withError("Expositor não encontrado.");
  }

  const { error } = await admin
    .from("exhibitor_users")
    .delete()
    .eq("user_id", parsed.data.userId)
    .eq("exhibitor_company_id", parsed.data.exhibitorId);
  if (error) {
    return withError("Não foi possível desvincular o usuário.");
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EXHIBITOR_USER_UNLINKED",
    context: {
      exhibitor_id: parsed.data.exhibitorId,
      user_id: parsed.data.userId,
    },
  });

  revalidateExhibitorPaths(parsed.data.exhibitorId);
  return withSuccess("Usuário desvinculado com sucesso.");
}

export async function linkEventToExhibitorAction(
  _: ExhibitorDetailState,
  formData: FormData
): Promise<ExhibitorDetailState> {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = linkEventSchema.safeParse({
    exhibitorId: formData.get("exhibitor_id"),
    eventId: formData.get("event_id"),
    standName: formData.get("stand_name"),
  });

  if (!parsed.success) {
    return withError(parsed.error.issues[0]?.message ?? "Dados inválidos para vínculo com evento.");
  }

  const admin = createAdminClient();
  const exhibitor = await ensureExhibitorExists(parsed.data.exhibitorId);
  if (!exhibitor) {
    return withError("Expositor não encontrado.");
  }

  const { data: event } = await admin.from("events").select("id, name").eq("id", parsed.data.eventId).maybeSingle();
  if (!event) {
    return withError("Evento não encontrado.");
  }

  const hasConflict = await exhibitorHasConflictForEvent(parsed.data.exhibitorId, parsed.data.eventId);
  if (hasConflict) {
    return withError("Há usuário deste expositor já vinculado a outro expositor no evento selecionado.");
  }

  const standName = parsed.data.standName && parsed.data.standName.length > 0 ? parsed.data.standName : null;
  const { error } = await admin.from("event_exhibitors").upsert(
    {
      event_id: parsed.data.eventId,
      exhibitor_company_id: parsed.data.exhibitorId,
      stand_name: standName,
    },
    { onConflict: "event_id,exhibitor_company_id" }
  );
  if (error) {
    return withError("Não foi possível vincular expositor ao evento.");
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EXHIBITOR_EVENT_LINKED",
    context: {
      exhibitor_id: parsed.data.exhibitorId,
      event_id: parsed.data.eventId,
      stand_name: standName,
    },
  });

  revalidateExhibitorPaths(parsed.data.exhibitorId, parsed.data.eventId);
  return withSuccess(`Expositor vinculado ao evento ${event.name}.`);
}

export async function unlinkEventFromExhibitorAction(
  _: ExhibitorDetailState,
  formData: FormData
): Promise<ExhibitorDetailState> {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = unlinkEventSchema.safeParse({
    exhibitorId: formData.get("exhibitor_id"),
    eventId: formData.get("event_id"),
  });

  if (!parsed.success) {
    return withError(parsed.error.issues[0]?.message ?? "Dados inválidos para desvincular evento.");
  }

  const admin = createAdminClient();
  const { data: eventExhibitor } = await admin
    .from("event_exhibitors")
    .select("id")
    .eq("event_id", parsed.data.eventId)
    .eq("exhibitor_company_id", parsed.data.exhibitorId)
    .maybeSingle();
  if (!eventExhibitor) {
    return withError("Este expositor já não está vinculado ao evento.");
  }

  const { data: hasCheckins } = await admin
    .from("stand_checkins")
    .select("id")
    .eq("event_exhibitor_id", eventExhibitor.id)
    .limit(1)
    .maybeSingle();
  if (hasCheckins) {
    return withError("Não é possível desvincular: já existem check-ins de stand registrados para este evento.");
  }

  const { error } = await admin.from("event_exhibitors").delete().eq("id", eventExhibitor.id);
  if (error) {
    return withError("Não foi possível desvincular o evento.");
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EXHIBITOR_EVENT_UNLINKED",
    context: {
      exhibitor_id: parsed.data.exhibitorId,
      event_id: parsed.data.eventId,
    },
  });

  revalidateExhibitorPaths(parsed.data.exhibitorId, parsed.data.eventId);
  return withSuccess("Expositor desvinculado do evento com sucesso.");
}

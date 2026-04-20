"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type ExhibitorFormState = {
  error: string | null;
  success: string | null;
};

const createCompanySchema = z.object({
  eventId: z.string().uuid(),
  companyName: z.string().trim().min(2, "Nome da empresa expositora é obrigatório."),
});

const linkCompanySchema = z.object({
  eventId: z.string().uuid(),
  companyId: z.string().uuid(),
  standName: z.string().trim().max(120, "Nome do stand deve ter no máximo 120 caracteres.").optional(),
});

const linkUserSchema = z.object({
  eventId: z.string().uuid(),
  companyId: z.string().uuid(),
  userEmail: z.string().trim().email("E-mail inválido."),
});

const removeEventExhibitorSchema = z.object({
  eventId: z.string().uuid(),
  companyId: z.string().uuid(),
});

const unlinkUserSchema = z.object({
  eventId: z.string().uuid(),
  companyId: z.string().uuid(),
  userId: z.string().uuid(),
});

const INITIAL_STATE: ExhibitorFormState = {
  error: null,
  success: null,
};

function withError(error: string): ExhibitorFormState {
  return { ...INITIAL_STATE, error };
}

function withSuccess(success: string): ExhibitorFormState {
  return { ...INITIAL_STATE, success };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateTemporaryPassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  let password = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    password += alphabet[randomIndex];
  }
  return password;
}

async function findAuthUserByEmail(email: string) {
  const admin = createAdminClient();
  const targetEmail = normalizeEmail(email);
  const perPage = 200;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error("Não foi possível consultar usuários do Auth.");
    }

    const users = data?.users ?? [];
    const foundUser = users.find((user) => normalizeEmail(user.email ?? "") === targetEmail);
    if (foundUser) {
      return foundUser;
    }

    if (users.length < perPage) {
      break;
    }
  }

  return null;
}

function revalidateExhibitorPaths(eventId: string) {
  revalidatePath(`/events/${eventId}/expositores`);
  revalidatePath(`/events/${eventId}/checkin-expositor`);
  revalidatePath(`/events/${eventId}/participants`);
}

export async function createExhibitorCompanyAction(
  _: ExhibitorFormState,
  formData: FormData
): Promise<ExhibitorFormState> {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = createCompanySchema.safeParse({
    eventId: formData.get("event_id"),
    companyName: formData.get("company_name"),
  });

  if (!parsed.success) {
    return withError(parsed.error.issues[0]?.message ?? "Dados inválidos para criar empresa.");
  }

  const admin = createAdminClient();
  const normalizedName = parsed.data.companyName;

  const { data: existingCompany } = await admin
    .from("exhibitor_companies")
    .select("id, name")
    .ilike("name", normalizedName)
    .limit(1)
    .maybeSingle();

  if (existingCompany) {
    return withSuccess(`Empresa já cadastrada: ${existingCompany.name}`);
  }

  const { error } = await admin.from("exhibitor_companies").insert({
    name: normalizedName,
  });

  if (error) {
    return withError("Não foi possível cadastrar a empresa expositora.");
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EXHIBITOR_COMPANY_CREATED",
    context: {
      event_id: parsed.data.eventId,
      company_name: normalizedName,
    },
  });

  revalidateExhibitorPaths(parsed.data.eventId);
  return withSuccess("Empresa expositora cadastrada com sucesso.");
}

export async function linkCompanyToEventAction(_: ExhibitorFormState, formData: FormData): Promise<ExhibitorFormState> {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = linkCompanySchema.safeParse({
    eventId: formData.get("event_id"),
    companyId: formData.get("company_id"),
    standName: formData.get("stand_name"),
  });

  if (!parsed.success) {
    return withError(parsed.error.issues[0]?.message ?? "Dados inválidos para vínculo da empresa.");
  }

  const admin = createAdminClient();
  const standName = parsed.data.standName && parsed.data.standName.length > 0 ? parsed.data.standName : null;

  const { data: company } = await admin
    .from("exhibitor_companies")
    .select("id, name")
    .eq("id", parsed.data.companyId)
    .maybeSingle();

  if (!company) {
    return withError("Empresa expositora não encontrada.");
  }

  const { error } = await admin.from("event_exhibitors").upsert(
    {
      event_id: parsed.data.eventId,
      exhibitor_company_id: parsed.data.companyId,
      stand_name: standName,
    },
    { onConflict: "event_id,exhibitor_company_id" }
  );

  if (error) {
    return withError("Não foi possível vincular a empresa ao evento.");
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EVENT_EXHIBITOR_LINKED",
    context: {
      event_id: parsed.data.eventId,
      exhibitor_company_id: parsed.data.companyId,
      stand_name: standName,
    },
  });

  revalidateExhibitorPaths(parsed.data.eventId);
  return withSuccess(`Empresa ${company.name} vinculada ao evento com sucesso.`);
}

export async function linkExhibitorUserAction(_: ExhibitorFormState, formData: FormData): Promise<ExhibitorFormState> {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = linkUserSchema.safeParse({
    eventId: formData.get("event_id"),
    companyId: formData.get("company_id"),
    userEmail: formData.get("user_email"),
  });

  if (!parsed.success) {
    return withError(parsed.error.issues[0]?.message ?? "Dados inválidos para vínculo do usuário.");
  }

  const admin = createAdminClient();
  const userEmail = normalizeEmail(parsed.data.userEmail);
  let onboardingMessage = "";

  const { data: eventCompanyLink } = await admin
    .from("event_exhibitors")
    .select("id")
    .eq("event_id", parsed.data.eventId)
    .eq("exhibitor_company_id", parsed.data.companyId)
    .maybeSingle();

  if (!eventCompanyLink) {
    return withError("A empresa selecionada ainda não está vinculada a este evento.");
  }

  let authUser: Awaited<ReturnType<typeof findAuthUserByEmail>>;
  try {
    authUser = await findAuthUserByEmail(userEmail);
  } catch (error) {
    return withError(error instanceof Error ? error.message : "Falha ao consultar usuários.");
  }

  if (!authUser) {
    const temporaryPassword = generateTemporaryPassword();
    const { data: createdUserData, error: createdUserError } = await admin.auth.admin.createUser({
      email: userEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        source: "expositor_ui",
      },
    });

    if (createdUserError || !createdUserData.user) {
      return withError("Não foi possível criar o usuário automaticamente no Auth.");
    }

    authUser = createdUserData.user;
    onboardingMessage = ` Novo usuário criado no Auth. Senha temporária: ${temporaryPassword}`;

    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "EXHIBITOR_USER_CREATED_IN_AUTH",
      context: {
        event_id: parsed.data.eventId,
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

  const { error: roleError } = await admin.from("user_profiles").upsert({
    id: authUser.id,
    role: "expositor",
    status: "active",
  });
  if (roleError) {
    return withError("Não foi possível definir o perfil do usuário como expositor.");
  }

  const { data: userCompanyLinks } = await admin
    .from("exhibitor_users")
    .select("exhibitor_company_id")
    .eq("user_id", authUser.id);
  const userCompanyIds = [...new Set((userCompanyLinks ?? []).map((item) => item.exhibitor_company_id))];

  if (userCompanyIds.length > 0) {
    const { data: sameEventLinks } = await admin
      .from("event_exhibitors")
      .select("exhibitor_company_id")
      .eq("event_id", parsed.data.eventId)
      .in("exhibitor_company_id", userCompanyIds);
    const linkedCompanyInEventIds = new Set((sameEventLinks ?? []).map((item) => item.exhibitor_company_id));

    if (linkedCompanyInEventIds.size > 0 && !linkedCompanyInEventIds.has(parsed.data.companyId)) {
      return withError("Este usuário já está vinculado a outro expositor neste evento.");
    }
  }

  const { error: linkError } = await admin.from("exhibitor_users").upsert(
    {
      user_id: authUser.id,
      exhibitor_company_id: parsed.data.companyId,
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
      event_id: parsed.data.eventId,
      exhibitor_company_id: parsed.data.companyId,
      user_id: authUser.id,
      user_email: userEmail,
    },
  });

  revalidateExhibitorPaths(parsed.data.eventId);
  return withSuccess(`Usuário vinculado ao expositor com sucesso.${onboardingMessage}`);
}

export async function removeCompanyFromEventAction(
  _: ExhibitorFormState,
  formData: FormData
): Promise<ExhibitorFormState> {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = removeEventExhibitorSchema.safeParse({
    eventId: formData.get("event_id"),
    companyId: formData.get("company_id"),
  });

  if (!parsed.success) {
    return withError(parsed.error.issues[0]?.message ?? "Dados inválidos para remover expositor do evento.");
  }

  const admin = createAdminClient();
  const { data: eventExhibitor } = await admin
    .from("event_exhibitors")
    .select("id")
    .eq("event_id", parsed.data.eventId)
    .eq("exhibitor_company_id", parsed.data.companyId)
    .maybeSingle();

  if (!eventExhibitor) {
    return withError("Este expositor já não está vinculado ao evento.");
  }

  const { data: existingStandCheckin } = await admin
    .from("stand_checkins")
    .select("id")
    .eq("event_exhibitor_id", eventExhibitor.id)
    .limit(1)
    .maybeSingle();

  if (existingStandCheckin) {
    return withError(
      "Não é possível remover este expositor do evento porque já existem check-ins de stand registrados para ele."
    );
  }

  const { error } = await admin.from("event_exhibitors").delete().eq("id", eventExhibitor.id);
  if (error) {
    return withError("Não foi possível remover o expositor do evento.");
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EVENT_EXHIBITOR_UNLINKED",
    context: {
      event_id: parsed.data.eventId,
      exhibitor_company_id: parsed.data.companyId,
    },
  });

  revalidateExhibitorPaths(parsed.data.eventId);
  return withSuccess("Expositor removido do evento com sucesso.");
}

export async function unlinkExhibitorUserAction(
  _: ExhibitorFormState,
  formData: FormData
): Promise<ExhibitorFormState> {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = unlinkUserSchema.safeParse({
    eventId: formData.get("event_id"),
    companyId: formData.get("company_id"),
    userId: formData.get("user_id"),
  });

  if (!parsed.success) {
    return withError(parsed.error.issues[0]?.message ?? "Dados inválidos para desvincular usuário.");
  }

  const admin = createAdminClient();
  const { data: eventCompanyLink } = await admin
    .from("event_exhibitors")
    .select("id")
    .eq("event_id", parsed.data.eventId)
    .eq("exhibitor_company_id", parsed.data.companyId)
    .maybeSingle();

  if (!eventCompanyLink) {
    return withError("A empresa informada não está mais vinculada a este evento.");
  }

  const { error } = await admin
    .from("exhibitor_users")
    .delete()
    .eq("user_id", parsed.data.userId)
    .eq("exhibitor_company_id", parsed.data.companyId);

  if (error) {
    return withError("Não foi possível desvincular o usuário expositor.");
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EXHIBITOR_USER_UNLINKED",
    context: {
      event_id: parsed.data.eventId,
      exhibitor_company_id: parsed.data.companyId,
      user_id: parsed.data.userId,
    },
  });

  revalidateExhibitorPaths(parsed.data.eventId);
  return withSuccess("Usuário expositor desvinculado com sucesso.");
}

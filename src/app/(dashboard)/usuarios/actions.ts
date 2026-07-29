"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { APP_ROLES, type AppRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuthUserByEmail, findAuthUserByEmail } from "@/lib/users/auth-admin";
import { generateTemporaryPassword } from "@/lib/users/passwords";
import { addHoursFromNow } from "@/lib/exhibitors/access-status";

const createUserSchema = z.object({
  email: z.string().trim().email("E-mail inválido."),
  role: z.enum(APP_ROLES),
});

const updateUserProfileSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(APP_ROLES),
  status: z.enum(["active", "inactive"]),
});

export type CreateUserState = {
  error: string | null;
  success: string | null;
};

export type EmergencyResetState = {
  error: string | null;
  success: string | null;
  temporaryPassword: string | null;
};

const INITIAL_STATE: CreateUserState = {
  error: null,
  success: null,
};

const emergencyResetSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().trim().min(5, "Informe o motivo da liberação.").max(300),
  confirmed: z.literal("yes", "Confirme a identidade antes de gerar a senha."),
});

function withError(error: string): CreateUserState {
  return { ...INITIAL_STATE, error };
}

function withSuccess(success: string): CreateUserState {
  return { ...INITIAL_STATE, success };
}

function roleLabel(role: AppRole) {
  switch (role) {
    case "super_adm":
      return "Super ADM";
    case "organizador":
      return "Organizador";
    case "recepcao":
      return "Recepção";
    case "expositor":
      return "Expositor";
    default:
      return role;
  }
}

function withNotice(url: string, type: "success" | "error", message: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}notice_type=${type}&notice=${encodeURIComponent(message)}`;
}

export async function createUserAction(_: CreateUserState, formData: FormData): Promise<CreateUserState> {
  try {
    const session = await requireSession(["super_adm"]);
    const parsed = createUserSchema.safeParse({
      email: formData.get("email"),
      role: formData.get("role"),
    });

    if (!parsed.success) {
      return withError(parsed.error.issues[0]?.message ?? "Dados inválidos para cadastro de usuário.");
    }
    if (parsed.data.role === "expositor") {
      return withError("Cadastre usuários expositores dentro dos detalhes da empresa expositora.");
    }

    const admin = createAdminClient();
    const existingUser = await findAuthUserByEmail(parsed.data.email);

    let userId = existingUser?.id ?? "";
    let temporaryPassword: string | null = null;
    let wasCreated = false;

    if (!existingUser) {
      const created = await createAuthUserByEmail(parsed.data.email, { source: "super_adm_users_ui" });
      userId = created.user.id;
      temporaryPassword = created.temporaryPassword;
      wasCreated = true;

      await admin.from("audit_logs").insert({
        actor_user_id: session.userId,
        action: "USER_CREATED_IN_AUTH",
        context: {
          user_id: userId,
          email: parsed.data.email.toLowerCase(),
        },
      });
    }

    const { error: profileError } = await admin.from("user_profiles").upsert({
      id: userId,
      role: parsed.data.role,
      status: "active",
      ...(temporaryPassword
        ? {
            password_change_required: true,
            temporary_password_issued_at: new Date().toISOString(),
            temporary_password_issued_by: session.userId,
          }
        : {}),
    });

    if (profileError) {
      return withError("Não foi possível definir o perfil do usuário.");
    }

    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "USER_PROFILE_SET_BY_SUPER_ADM",
      context: {
        user_id: userId,
        role: parsed.data.role,
        status: "active",
        source: wasCreated ? "create_user" : "existing_user",
      },
    });

    revalidatePath("/usuarios");

    if (temporaryPassword) {
      return withSuccess(
        `Usuário cadastrado com perfil ${roleLabel(parsed.data.role)}. Senha temporária: ${temporaryPassword}`
      );
    }

    return withSuccess(`Usuário já existia e foi configurado com perfil ${roleLabel(parsed.data.role)}.`);
  } catch (error) {
    console.error("createUserAction.error", error);
    return withError("Não foi possível cadastrar o usuário.");
  }
}

export async function emergencyPasswordResetAction(
  _: EmergencyResetState,
  formData: FormData
): Promise<EmergencyResetState> {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = emergencyResetSchema.safeParse({
    userId: formData.get("user_id"),
    reason: formData.get("reason"),
    confirmed: formData.get("confirmed"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Dados inválidos para o reset emergencial.",
      success: null,
      temporaryPassword: null,
    };
  }
  if (parsed.data.userId === session.userId) {
    return {
      error: "Use a recuperação normal para alterar sua própria senha.",
      success: null,
      temporaryPassword: null,
    };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role, status, password_change_required, temporary_password_issued_at, temporary_password_issued_by")
    .eq("id", parsed.data.userId)
    .maybeSingle();
  if (!profile) {
    return { error: "Usuário não encontrado.", success: null, temporaryPassword: null };
  }
  if (profile.status !== "active") {
    return { error: "O usuário está inativo e não pode receber acesso temporário.", success: null, temporaryPassword: null };
  }
  if (
    session.role === "organizador" &&
    !["recepcao", "expositor"].includes(profile.role)
  ) {
    return {
      error: "Organizadores só podem liberar usuários de Recepção e Expositores.",
      success: null,
      temporaryPassword: null,
    };
  }

  const temporaryPassword = generateTemporaryPassword();
  const now = new Date().toISOString();
  const { error: profileError } = await admin
    .from("user_profiles")
    .update({
      password_change_required: true,
      temporary_password_issued_at: now,
      temporary_password_issued_by: session.userId,
    })
    .eq("id", parsed.data.userId);
  if (profileError) {
    return {
      error: "Não foi possível preparar a troca obrigatória de senha.",
      success: null,
      temporaryPassword: null,
    };
  }

  const { error: passwordError } = await admin.auth.admin.updateUserById(parsed.data.userId, {
    password: temporaryPassword,
  });
  if (passwordError) {
    await admin
      .from("user_profiles")
      .update({
        password_change_required: profile.password_change_required,
        temporary_password_issued_at: profile.temporary_password_issued_at,
        temporary_password_issued_by: profile.temporary_password_issued_by,
      })
      .eq("id", parsed.data.userId);
    return {
      error: "Não foi possível redefinir a senha no Supabase.",
      success: null,
      temporaryPassword: null,
    };
  }

  let emergencyLinks = 0;
  if (profile.role === "expositor") {
    const { data: links } = await admin
      .from("exhibitor_users")
      .update({ emergency_access_until: addHoursFromNow(24) })
      .eq("user_id", parsed.data.userId)
      .eq("status", "active")
      .select("id");
    emergencyLinks = links?.length ?? 0;
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EMERGENCY_PASSWORD_ISSUED",
    context: {
      target_user_id: parsed.data.userId,
      target_role: profile.role,
      reason: parsed.data.reason,
      emergency_access_hours: profile.role === "expositor" ? 24 : null,
      renewed_link_count: emergencyLinks,
    },
  });

  revalidatePath("/usuarios");
  return {
    error: null,
    success:
      profile.role === "expositor"
        ? "Senha gerada. O acesso emergencial da empresa ficará disponível por até 24 horas após a troca."
        : "Senha temporária gerada. O usuário deverá substituí-la no primeiro acesso.",
    temporaryPassword,
  };
}

export async function updateUserProfileAction(formData: FormData) {
  const session = await requireSession(["super_adm"]);
  const parsed = updateUserProfileSchema.safeParse({
    userId: formData.get("user_id"),
    role: formData.get("role"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    redirect(withNotice("/usuarios", "error", "Dados inválidos para atualizar perfil."));
  }

  if (parsed.data.userId === session.userId && parsed.data.role !== "super_adm") {
    redirect(withNotice("/usuarios", "error", "Você não pode remover seu próprio perfil de Super ADM."));
  }

  if (parsed.data.userId === session.userId && parsed.data.status !== "active") {
    redirect(withNotice("/usuarios", "error", "Você não pode inativar seu próprio usuário."));
  }

  const admin = createAdminClient();
  if (parsed.data.role === "expositor") {
    const { count } = await admin
      .from("exhibitor_users")
      .select("id", { count: "exact", head: true })
      .eq("user_id", parsed.data.userId);
    if (!count) {
      redirect(
        withNotice(
          "/usuarios",
          "error",
          "Vincule o usuário a uma empresa na tela de Expositores antes de definir esse perfil."
        )
      );
    }
  }

  const { error } = await admin.from("user_profiles").upsert({
    id: parsed.data.userId,
    role: parsed.data.role,
    status: parsed.data.status,
  });

  if (error) {
    console.error("updateUserProfileAction.error", error);
    redirect(withNotice("/usuarios", "error", "Não foi possível atualizar o perfil do usuário."));
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "USER_PROFILE_UPDATED_BY_SUPER_ADM",
    context: {
      user_id: parsed.data.userId,
      role: parsed.data.role,
      status: parsed.data.status,
    },
  });

  revalidatePath("/usuarios");
  redirect(withNotice("/usuarios", "success", "Perfil do usuário atualizado com sucesso."));
}

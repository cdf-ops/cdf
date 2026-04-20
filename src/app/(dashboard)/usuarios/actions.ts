"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { APP_ROLES, type AppRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuthUserByEmail, findAuthUserByEmail } from "@/lib/users/auth-admin";

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

const INITIAL_STATE: CreateUserState = {
  error: null,
  success: null,
};

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

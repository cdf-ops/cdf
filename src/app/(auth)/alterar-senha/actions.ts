"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isExhibitorAccessLinkActive } from "@/lib/exhibitors/access-status";

export type ChangePasswordState = {
  error: string | null;
};

const passwordSchema = z
  .object({
    currentPassword: z.string(),
    newPassword: z.string().min(10, "A nova senha deve ter pelo menos 10 caracteres."),
    confirmPassword: z.string(),
    recovery: z.boolean(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "A confirmação não é igual à nova senha.",
    path: ["confirmPassword"],
  });

function hasRecentRecoveryClaim(claims: unknown) {
  const methods =
    typeof claims === "object" && claims && "amr" in claims && Array.isArray(claims.amr)
      ? claims.amr
      : [];
  const cutoff = Math.floor(Date.now() / 1000) - 15 * 60;
  return methods.some(
    (entry) =>
      typeof entry === "object" &&
      entry &&
      "method" in entry &&
      entry.method === "recovery" &&
      "timestamp" in entry &&
      typeof entry.timestamp === "number" &&
      entry.timestamp >= cutoff
  );
}

export async function changePasswordAction(
  _: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const parsed = passwordSchema.safeParse({
    currentPassword: String(formData.get("current_password") ?? ""),
    newPassword: String(formData.get("new_password") ?? ""),
    confirmPassword: String(formData.get("confirm_password") ?? ""),
    recovery: formData.get("recovery") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos para alterar a senha." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role, password_change_required")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { error: "Perfil de acesso não encontrado." };

  if (parsed.data.recovery) {
    const { data: claimsData } = await supabase.auth.getClaims();
    if (!hasRecentRecoveryClaim(claimsData?.claims)) {
      return { error: "O link de recuperação expirou. Solicite um novo e-mail." };
    }
  } else if (!profile.password_change_required) {
    return { error: "Não há troca obrigatória de senha pendente para este usuário." };
  }

  const passwordUpdate = parsed.data.recovery
    ? { password: parsed.data.newPassword }
    : {
        password: parsed.data.newPassword,
        current_password: parsed.data.currentPassword,
      };
  const { error: passwordError } = await supabase.auth.updateUser(passwordUpdate);
  if (passwordError) {
    return {
      error: parsed.data.recovery
        ? "Não foi possível salvar a nova senha. Verifique os requisitos e tente novamente."
        : "Senha temporária incorreta ou nova senha inválida.",
    };
  }

  const { error: profileError } = await admin
    .from("user_profiles")
    .update({
      password_change_required: false,
      temporary_password_issued_at: null,
      temporary_password_issued_by: null,
    })
    .eq("id", user.id);
  if (profileError) {
    return { error: "A senha mudou, mas não foi possível liberar o acesso. Procure a organização." };
  }

  await admin.from("audit_logs").insert({
    actor_user_id: user.id,
    action: parsed.data.recovery ? "PASSWORD_CHANGED_AFTER_RECOVERY" : "TEMPORARY_PASSWORD_REPLACED",
    context: { user_id: user.id },
  });

  if (profile.role === "expositor") {
    const { data: links } = await admin
      .from("exhibitor_users")
      .select("status, access_valid_until, emergency_access_until")
      .eq("user_id", user.id);
    if (!(links ?? []).some((link) => isExhibitorAccessLinkActive(link))) {
      redirect("/renovar-acesso");
    }
  }

  redirect("/events");
}

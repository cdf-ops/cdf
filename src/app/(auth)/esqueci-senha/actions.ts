"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { findAuthUserByEmail } from "@/lib/users/auth-admin";

export type ForgotPasswordState = { message: string | null };

export async function requestSuperAdminRecoveryAction(
  _: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const generic = "Se este e-mail pertencer a um Super ADM, enviaremos um link de recuperação.";
  if (!email) return { message: generic };

  const user = await findAuthUserByEmail(email);
  if (!user) return { message: generic };
  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles").select("role, status").eq("id", user.id).maybeSingle();
  if (profile?.role !== "super_adm" || profile.status !== "active") return { message: generic };

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!origin) return { message: generic };
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/alterar-senha?recovery=1")}`,
  });
  await admin.from("audit_logs").insert({ actor_user_id: user.id, action: "SUPER_ADMIN_PASSWORD_RECOVERY_REQUESTED", context: { user_id: user.id } });
  return { message: generic };
}

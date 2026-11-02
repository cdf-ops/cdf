"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ASSIGNABLE_APP_ROLES, type AssignableAppRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuthUserByEmail, findAuthUserByEmail } from "@/lib/users/auth-admin";
import { validateManagedPassword } from "@/lib/users/passwords";
import { readUserPassword, storeUserPassword } from "@/lib/users/password-vault";

const createUserSchema = z.object({ email: z.string().trim().email("E-mail inválido."), role: z.enum(ASSIGNABLE_APP_ROLES), password: z.string() });
const updateUserProfileSchema = z.object({ userId: z.string().uuid(), role: z.enum(ASSIGNABLE_APP_ROLES), status: z.enum(["active", "inactive"]) });
const managedPasswordSchema = z.object({ userId: z.string().uuid(), password: z.string(), reason: z.string().trim().min(5, "Informe o motivo da alteração.").max(300) });
const revealPasswordSchema = z.object({ userId: z.string().uuid() });

export type CreateUserState = { error: string | null; success: string | null };
export type ManagedPasswordState = { error: string | null; success: string | null };
export type RevealPasswordState = { error: string | null; password: string | null };
const INITIAL_STATE: CreateUserState = { error: null, success: null };

function roleLabel(role: AssignableAppRole) {
  return { super_adm: "Super ADM", organizador: "Organizador", recepcao: "Recepção", sorteador: "Sorteador" }[role];
}
function withNotice(type: "success" | "error", message: string) {
  return `/usuarios?notice_type=${type}&notice=${encodeURIComponent(message)}`;
}

export async function createUserAction(_: CreateUserState, formData: FormData): Promise<CreateUserState> {
  try {
    const session = await requireSession(["super_adm"]);
    const parsed = createUserSchema.safeParse({ email: formData.get("email"), role: formData.get("role"), password: formData.get("password") });
    if (!parsed.success) return { ...INITIAL_STATE, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const passwordError = validateManagedPassword(parsed.data.password, parsed.data.role);
    if (passwordError) return { ...INITIAL_STATE, error: passwordError };
    if (await findAuthUserByEmail(parsed.data.email)) return { ...INITIAL_STATE, error: "Já existe um usuário com este e-mail." };

    const created = await createAuthUserByEmail(parsed.data.email, { password: parsed.data.password, source: "super_adm_users_ui" });
    const admin = createAdminClient();
    const { error: profileError } = await admin.from("user_profiles").upsert({
      id: created.user.id, role: parsed.data.role, status: "active", password_change_required: false,
      temporary_password_issued_at: null, temporary_password_issued_by: null,
    });
    if (profileError) throw new Error("Não foi possível definir o perfil do usuário.");
    await storeUserPassword(admin, { userId: created.user.id, password: parsed.data.password, updatedBy: session.userId });
    await admin.from("audit_logs").insert({ actor_user_id: session.userId, action: "USER_CREATED_WITH_MANAGED_PASSWORD", context: { user_id: created.user.id, email: parsed.data.email.toLowerCase(), role: parsed.data.role } });
    revalidatePath("/usuarios");
    return { error: null, success: `Usuário criado com perfil ${roleLabel(parsed.data.role)}.` };
  } catch (error) {
    console.error("createUserAction.error", error);
    return { ...INITIAL_STATE, error: error instanceof Error ? error.message : "Não foi possível cadastrar o usuário." };
  }
}

export async function managedPasswordResetAction(_: ManagedPasswordState, formData: FormData): Promise<ManagedPasswordState> {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = managedPasswordSchema.safeParse({ userId: formData.get("user_id"), password: formData.get("password"), reason: formData.get("reason") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", success: null };
  if (parsed.data.userId === session.userId) return { error: "Use a recuperação de senha para sua própria conta.", success: null };

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles").select("role, status").eq("id", parsed.data.userId).maybeSingle();
  if (!profile || profile.status !== "active") return { error: "Usuário ativo não encontrado.", success: null };
  if (session.role === "organizador" && !["recepcao", "sorteador"].includes(profile.role)) return { error: "Organizadores só podem redefinir senhas da Recepção e do Sorteador.", success: null };
  const passwordError = validateManagedPassword(parsed.data.password, profile.role);
  if (passwordError) return { error: passwordError, success: null };
  const { error } = await admin.auth.admin.updateUserById(parsed.data.userId, { password: parsed.data.password });
  if (error) return { error: "Não foi possível redefinir a senha no Supabase.", success: null };
  await storeUserPassword(admin, { userId: parsed.data.userId, password: parsed.data.password, updatedBy: session.userId });
  await admin.from("user_profiles").update({ password_change_required: false, temporary_password_issued_at: null, temporary_password_issued_by: null }).eq("id", parsed.data.userId);
  await admin.from("audit_logs").insert({ actor_user_id: session.userId, action: "USER_PASSWORD_RESET_BY_ADMIN", context: { target_user_id: parsed.data.userId, target_role: profile.role, reason: parsed.data.reason } });
  revalidatePath("/usuarios");
  redirect(withNotice("success", "Senha redefinida e sincronizada com o cofre."));
}

export async function revealPasswordAction(_: RevealPasswordState, formData: FormData): Promise<RevealPasswordState> {
  const session = await requireSession(["super_adm"]);
  const parsed = revealPasswordSchema.safeParse({ userId: formData.get("user_id") });
  if (!parsed.success) return { error: "Usuário inválido.", password: null };
  const admin = createAdminClient();
  try {
    const password = await readUserPassword(admin, parsed.data.userId);
    await admin.from("audit_logs").insert({ actor_user_id: session.userId, action: "USER_PASSWORD_REVEALED", context: { target_user_id: parsed.data.userId, available: Boolean(password) } });
    return password ? { error: null, password } : { error: "Esta senha ainda não está no cofre. Redefina-a uma vez para habilitar a visualização.", password: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível revelar a senha.", password: null };
  }
}

export async function updateUserProfileAction(formData: FormData) {
  const session = await requireSession(["super_adm"]);
  const parsed = updateUserProfileSchema.safeParse({ userId: formData.get("user_id"), role: formData.get("role"), status: formData.get("status") });
  if (!parsed.success) redirect(withNotice("error", "Dados inválidos para atualizar perfil."));
  if (parsed.data.userId === session.userId && (parsed.data.role !== "super_adm" || parsed.data.status !== "active")) redirect(withNotice("error", "Você não pode remover ou inativar seu próprio perfil de Super ADM."));
  const admin = createAdminClient();
  const { error } = await admin.from("user_profiles").upsert({ id: parsed.data.userId, role: parsed.data.role, status: parsed.data.status });
  if (error) redirect(withNotice("error", "Não foi possível atualizar o perfil do usuário."));
  await admin.from("audit_logs").insert({ actor_user_id: session.userId, action: "USER_PROFILE_UPDATED_BY_SUPER_ADM", context: { user_id: parsed.data.userId, role: parsed.data.role, status: parsed.data.status } });
  revalidatePath("/usuarios");
  redirect(withNotice("success", "Perfil do usuário atualizado com sucesso."));
}

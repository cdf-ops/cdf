"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import {
  decryptPassword,
  encryptPassword,
  hashPassword,
  isEncryptedPassword,
} from "@/lib/security/password-vault";
import { createAdminClient } from "@/lib/supabase/admin";

const sponsorIdSchema = z.string().uuid("Patrocinador inválido.");
const usernameSchema = z
  .string()
  .trim()
  .min(3, "O usuário deve ter pelo menos 3 caracteres.")
  .max(80, "O usuário deve ter no máximo 80 caracteres.")
  .regex(/^\S+$/, "O usuário não pode conter espaços.");
const passwordSchema = z
  .string()
  .min(5, "A senha deve ter pelo menos 5 caracteres.")
  .max(128, "A senha deve ter no máximo 128 caracteres.");

const createSponsorSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do patrocinador.").max(160),
  username: usernameSchema,
  password: passwordSchema,
});

const updateSponsorSchema = z.object({
  sponsorId: sponsorIdSchema,
  name: z.string().trim().min(2, "Informe o nome do patrocinador.").max(160),
  username: usernameSchema,
  status: z.enum(["active", "inactive"]),
});

const resetPasswordSchema = z.object({
  sponsorId: sponsorIdSchema,
  password: passwordSchema,
});

const createTeamMemberSchema = z.object({
  sponsorId: sponsorIdSchema,
  fullName: z.string().trim().min(2, "Informe o nome completo.").max(160),
  jobTitle: z.string().trim().max(120).optional(),
});

const updateTeamMemberSchema = z.object({
  sponsorId: sponsorIdSchema,
  memberId: z.string().uuid("Integrante inválido."),
  fullName: z.string().trim().min(2, "Informe o nome completo.").max(160),
  jobTitle: z.string().trim().max(120).optional(),
  status: z.enum(["active", "inactive"]),
});

export type SponsorActionState = {
  error: string | null;
  success: string | null;
  revealedPassword?: string | null;
};

const EMPTY_STATE: SponsorActionState = { error: null, success: null };

function failure(message: string): SponsorActionState {
  return { ...EMPTY_STATE, error: message };
}

function success(message: string): SponsorActionState {
  return { ...EMPTY_STATE, success: message };
}

function sponsorPath(sponsorId: string) {
  return `/patrocinadores/${sponsorId}`;
}

function databaseErrorMessage(error: { code?: string; message?: string } | null, fallback: string) {
  if (error?.code === "23505") return "Este nome de usuário já está sendo utilizado.";
  if (error?.code === "42P01") return "A estrutura de patrocinadores ainda não foi aplicada ao banco.";
  return fallback;
}

export async function createSponsorAction(
  _: SponsorActionState,
  formData: FormData
): Promise<SponsorActionState> {
  try {
    const session = await requireSession(["super_adm", "organizador"]);
    const parsed = createSponsorSchema.safeParse({
      name: formData.get("name"),
      username: formData.get("username"),
      password: formData.get("password"),
    });
    if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Dados inválidos.");

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("sponsors")
      .insert({
        name: parsed.data.name,
        username: parsed.data.username,
        password_hash: hashPassword(parsed.data.password),
        encrypted_password: encryptPassword(parsed.data.password),
        created_by: session.userId,
        updated_by: session.userId,
      })
      .select("id")
      .single();

    if (error) return failure(databaseErrorMessage(error, "Não foi possível cadastrar o patrocinador."));

    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "SPONSOR_CREATED",
      context: { sponsor_id: data.id, name: parsed.data.name, username: parsed.data.username.toLowerCase() },
    });

    revalidatePath("/patrocinadores");
    return success("Patrocinador cadastrado com sucesso.");
  } catch (error) {
    console.error("createSponsorAction", error);
    return failure(error instanceof Error ? error.message : "Não foi possível cadastrar o patrocinador.");
  }
}

export async function updateSponsorAction(
  _: SponsorActionState,
  formData: FormData
): Promise<SponsorActionState> {
  try {
    const session = await requireSession(["super_adm", "organizador"]);
    const parsed = updateSponsorSchema.safeParse({
      sponsorId: formData.get("sponsor_id"),
      name: formData.get("name"),
      username: formData.get("username"),
      status: formData.get("status"),
    });
    if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Dados inválidos.");

    const admin = createAdminClient();
    const { error } = await admin
      .from("sponsors")
      .update({
        name: parsed.data.name,
        username: parsed.data.username,
        status: parsed.data.status,
        updated_by: session.userId,
      })
      .eq("id", parsed.data.sponsorId);
    if (error) return failure(databaseErrorMessage(error, "Não foi possível atualizar o patrocinador."));

    if (parsed.data.status === "inactive") {
      await admin
        .from("sponsor_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("sponsor_id", parsed.data.sponsorId)
        .is("revoked_at", null);
    }

    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "SPONSOR_UPDATED",
      context: {
        sponsor_id: parsed.data.sponsorId,
        name: parsed.data.name,
        username: parsed.data.username.toLowerCase(),
        status: parsed.data.status,
      },
    });

    revalidatePath("/patrocinadores");
    revalidatePath(sponsorPath(parsed.data.sponsorId));
    return success("Dados do patrocinador atualizados.");
  } catch (error) {
    console.error("updateSponsorAction", error);
    return failure("Não foi possível atualizar o patrocinador.");
  }
}

export async function resetSponsorPasswordAction(
  _: SponsorActionState,
  formData: FormData
): Promise<SponsorActionState> {
  try {
    const session = await requireSession(["super_adm", "organizador"]);
    const parsed = resetPasswordSchema.safeParse({
      sponsorId: formData.get("sponsor_id"),
      password: formData.get("password"),
    });
    if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Senha inválida.");

    const admin = createAdminClient();
    const { error } = await admin
      .from("sponsors")
      .update({
        password_hash: hashPassword(parsed.data.password),
        encrypted_password: encryptPassword(parsed.data.password),
        updated_by: session.userId,
      })
      .eq("id", parsed.data.sponsorId);
    if (error) return failure("Não foi possível redefinir a senha.");

    await admin
      .from("sponsor_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("sponsor_id", parsed.data.sponsorId)
      .is("revoked_at", null);

    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "SPONSOR_PASSWORD_RESET",
      context: { sponsor_id: parsed.data.sponsorId },
    });

    revalidatePath(sponsorPath(parsed.data.sponsorId));
    return success("Senha redefinida. As sessões anteriores foram encerradas.");
  } catch (error) {
    console.error("resetSponsorPasswordAction", error);
    return failure(error instanceof Error ? error.message : "Não foi possível redefinir a senha.");
  }
}

export async function revealSponsorPasswordAction(
  _: SponsorActionState,
  formData: FormData
): Promise<SponsorActionState> {
  try {
    const session = await requireSession(["super_adm"]);
    const parsed = sponsorIdSchema.safeParse(formData.get("sponsor_id"));
    if (!parsed.success) return failure("Patrocinador inválido.");

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("sponsors")
      .select("encrypted_password")
      .eq("id", parsed.data)
      .maybeSingle();
    if (error || !data) return failure("Patrocinador não encontrado.");
    if (!isEncryptedPassword(data.encrypted_password)) return failure("O cofre deste acesso está inválido.");

    const revealedPassword = decryptPassword(data.encrypted_password);
    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "SPONSOR_PASSWORD_REVEALED",
      context: { sponsor_id: parsed.data },
    });

    return { error: null, success: "Senha revelada somente nesta tela.", revealedPassword };
  } catch (error) {
    console.error("revealSponsorPasswordAction", error);
    return failure(error instanceof Error ? error.message : "Não foi possível revelar a senha.");
  }
}

export async function createSponsorTeamMemberAction(
  _: SponsorActionState,
  formData: FormData
): Promise<SponsorActionState> {
  try {
    const session = await requireSession(["super_adm", "organizador"]);
    const parsed = createTeamMemberSchema.safeParse({
      sponsorId: formData.get("sponsor_id"),
      fullName: formData.get("full_name"),
      jobTitle: formData.get("job_title"),
    });
    if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Dados inválidos.");

    const admin = createAdminClient();
    const { error } = await admin.from("sponsor_team_members").insert({
      sponsor_id: parsed.data.sponsorId,
      full_name: parsed.data.fullName,
      job_title: parsed.data.jobTitle || null,
      created_by_user_id: session.userId,
      updated_by_user_id: session.userId,
    });
    if (error) return failure("Não foi possível cadastrar o integrante.");

    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "SPONSOR_TEAM_MEMBER_CREATED",
      context: { sponsor_id: parsed.data.sponsorId, full_name: parsed.data.fullName },
    });
    revalidatePath(sponsorPath(parsed.data.sponsorId));
    return success("Integrante cadastrado.");
  } catch (error) {
    console.error("createSponsorTeamMemberAction", error);
    return failure("Não foi possível cadastrar o integrante.");
  }
}

export async function updateSponsorTeamMemberAction(
  _: SponsorActionState,
  formData: FormData
): Promise<SponsorActionState> {
  try {
    const session = await requireSession(["super_adm", "organizador"]);
    const parsed = updateTeamMemberSchema.safeParse({
      sponsorId: formData.get("sponsor_id"),
      memberId: formData.get("member_id"),
      fullName: formData.get("full_name"),
      jobTitle: formData.get("job_title"),
      status: formData.get("status"),
    });
    if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Dados inválidos.");

    const admin = createAdminClient();
    const { error } = await admin
      .from("sponsor_team_members")
      .update({
        full_name: parsed.data.fullName,
        job_title: parsed.data.jobTitle || null,
        status: parsed.data.status,
        updated_by_user_id: session.userId,
      })
      .eq("id", parsed.data.memberId)
      .eq("sponsor_id", parsed.data.sponsorId);
    if (error) return failure("Não foi possível atualizar o integrante.");

    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "SPONSOR_TEAM_MEMBER_UPDATED",
      context: {
        sponsor_id: parsed.data.sponsorId,
        member_id: parsed.data.memberId,
        status: parsed.data.status,
      },
    });
    revalidatePath(sponsorPath(parsed.data.sponsorId));
    return success("Integrante atualizado.");
  } catch (error) {
    console.error("updateSponsorTeamMemberAction", error);
    return failure("Não foi possível atualizar o integrante.");
  }
}


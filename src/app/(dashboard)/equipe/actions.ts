"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { canManageExhibitorCompany } from "@/lib/exhibitors/access";
import { uploadExhibitorLogo } from "@/lib/exhibitors/assets";
import { createAdminClient } from "@/lib/supabase/admin";

const memberSchema = z.object({
  companyId: z.string().uuid(),
  fullName: z.string().trim().min(2, "Informe o nome completo.").max(160, "Nome muito longo."),
  jobTitle: z.string().trim().max(100, "Cargo muito longo.").optional(),
  linkedUserId: z.string().uuid().optional().or(z.literal("")),
});

const updateMemberSchema = memberSchema.extend({
  memberId: z.string().uuid(),
});

const statusSchema = z.object({
  companyId: z.string().uuid(),
  memberId: z.string().uuid(),
  status: z.enum(["active", "inactive"]),
});

const logoSchema = z.object({
  companyId: z.string().uuid(),
});

function withNotice(companyId: string, type: "success" | "error", message: string) {
  return `/equipe?empresa=${companyId}&notice_type=${type}&notice=${encodeURIComponent(message)}`;
}

async function requireCompanyAccess(companyId: string) {
  const session = await requireSession(["super_adm", "organizador", "expositor"]);
  if (!(await canManageExhibitorCompany(session, companyId))) {
    redirect("/forbidden");
  }
  return session;
}

function parseMember(formData: FormData) {
  return memberSchema.safeParse({
    companyId: formData.get("company_id"),
    fullName: formData.get("full_name"),
    jobTitle: formData.get("job_title"),
    linkedUserId: formData.get("linked_user_id"),
  });
}

export async function createTeamMemberAction(formData: FormData) {
  const parsed = parseMember(formData);
  if (!parsed.success) {
    const companyId = String(formData.get("company_id") ?? "");
    redirect(withNotice(companyId, "error", parsed.error.issues[0]?.message ?? "Dados inválidos."));
  }

  const session = await requireCompanyAccess(parsed.data.companyId);
  const admin = createAdminClient();

  if (parsed.data.linkedUserId) {
    const { data: linkedUser } = await admin
      .from("exhibitor_users")
      .select("user_id")
      .eq("user_id", parsed.data.linkedUserId)
      .eq("exhibitor_company_id", parsed.data.companyId)
      .maybeSingle();
    if (!linkedUser) {
      redirect(withNotice(parsed.data.companyId, "error", "O usuário selecionado não pertence a esta empresa."));
    }
  }

  const { data: member, error } = await admin
    .from("exhibitor_team_members")
    .insert({
      exhibitor_company_id: parsed.data.companyId,
      full_name: parsed.data.fullName,
      job_title: parsed.data.jobTitle || null,
      linked_user_id: parsed.data.linkedUserId || null,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !member) {
    const message = error?.code === "23505"
      ? "Este usuário já está associado a uma pessoa da Equipe Geral."
      : "Não foi possível cadastrar a pessoa.";
    redirect(withNotice(parsed.data.companyId, "error", message));
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EXHIBITOR_TEAM_MEMBER_CREATED",
    context: {
      exhibitor_company_id: parsed.data.companyId,
      team_member_id: member.id,
      full_name: parsed.data.fullName,
    },
  });

  revalidatePath("/equipe");
  redirect(withNotice(parsed.data.companyId, "success", "Pessoa adicionada à Equipe Geral."));
}

export async function updateTeamMemberAction(formData: FormData) {
  const base = parseMember(formData);
  const parsed = updateMemberSchema.safeParse({
    ...(base.success ? base.data : {}),
    companyId: formData.get("company_id"),
    memberId: formData.get("member_id"),
    fullName: formData.get("full_name"),
    jobTitle: formData.get("job_title"),
    linkedUserId: formData.get("linked_user_id"),
  });
  if (!parsed.success) {
    const companyId = String(formData.get("company_id") ?? "");
    redirect(withNotice(companyId, "error", parsed.error.issues[0]?.message ?? "Dados inválidos."));
  }

  const session = await requireCompanyAccess(parsed.data.companyId);
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("exhibitor_team_members")
    .select("id")
    .eq("id", parsed.data.memberId)
    .eq("exhibitor_company_id", parsed.data.companyId)
    .maybeSingle();
  if (!member) {
    redirect(withNotice(parsed.data.companyId, "error", "Pessoa não encontrada nesta empresa."));
  }

  if (parsed.data.linkedUserId) {
    const { data: linkedUser } = await admin
      .from("exhibitor_users")
      .select("user_id")
      .eq("user_id", parsed.data.linkedUserId)
      .eq("exhibitor_company_id", parsed.data.companyId)
      .maybeSingle();
    if (!linkedUser) {
      redirect(withNotice(parsed.data.companyId, "error", "O usuário selecionado não pertence a esta empresa."));
    }
  }

  const { error } = await admin
    .from("exhibitor_team_members")
    .update({
      full_name: parsed.data.fullName,
      job_title: parsed.data.jobTitle || null,
      linked_user_id: parsed.data.linkedUserId || null,
    })
    .eq("id", member.id);
  if (error) {
    redirect(withNotice(parsed.data.companyId, "error", "Não foi possível atualizar a pessoa."));
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EXHIBITOR_TEAM_MEMBER_UPDATED",
    context: { exhibitor_company_id: parsed.data.companyId, team_member_id: member.id },
  });

  revalidatePath("/equipe");
  redirect(withNotice(parsed.data.companyId, "success", "Dados da pessoa atualizados."));
}

export async function updateTeamMemberStatusAction(formData: FormData) {
  const parsed = statusSchema.safeParse({
    companyId: formData.get("company_id"),
    memberId: formData.get("member_id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    redirect("/equipe?notice_type=error&notice=Dados%20inv%C3%A1lidos.");
  }

  const session = await requireCompanyAccess(parsed.data.companyId);
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("exhibitor_team_members")
    .select("id")
    .eq("id", parsed.data.memberId)
    .eq("exhibitor_company_id", parsed.data.companyId)
    .maybeSingle();
  if (!member) {
    redirect(withNotice(parsed.data.companyId, "error", "Pessoa não encontrada nesta empresa."));
  }

  const { error } = await admin.from("exhibitor_team_members").update({ status: parsed.data.status }).eq("id", member.id);
  if (error) {
    redirect(withNotice(parsed.data.companyId, "error", "Não foi possível alterar a situação."));
  }

  if (parsed.data.status === "inactive") {
    await admin.from("exhibitor_credentials").update({ status: "cancelled" }).eq("team_member_id", member.id);
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: parsed.data.status === "active" ? "EXHIBITOR_TEAM_MEMBER_REACTIVATED" : "EXHIBITOR_TEAM_MEMBER_INACTIVATED",
    context: { exhibitor_company_id: parsed.data.companyId, team_member_id: member.id },
  });

  revalidatePath("/equipe");
  redirect(
    withNotice(
      parsed.data.companyId,
      "success",
      parsed.data.status === "active" ? "Pessoa reativada." : "Pessoa desativada e credenciais futuras canceladas."
    )
  );
}

export async function uploadCompanyLogoAction(formData: FormData) {
  const parsed = logoSchema.safeParse({ companyId: formData.get("company_id") });
  if (!parsed.success) {
    redirect("/equipe?notice_type=error&notice=Empresa%20inv%C3%A1lida.");
  }

  const session = await requireCompanyAccess(parsed.data.companyId);
  const file = formData.get("company_logo");
  if (!(file instanceof File) || file.size === 0) {
    redirect(withNotice(parsed.data.companyId, "error", "Selecione uma imagem para o logo."));
  }

  const admin = createAdminClient();
  try {
    const logoPath = await uploadExhibitorLogo(admin, parsed.data.companyId, file);
    const { error } = await admin
      .from("exhibitor_companies")
      .update({ logo_path: logoPath })
      .eq("id", parsed.data.companyId);
    if (error) throw new Error("Não foi possível associar o logo à empresa.");

    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "EXHIBITOR_LOGO_UPDATED",
      context: { exhibitor_company_id: parsed.data.companyId, logo_path: logoPath },
    });
  } catch (error) {
    redirect(withNotice(parsed.data.companyId, "error", error instanceof Error ? error.message : "Falha ao salvar o logo."));
  }

  revalidatePath("/equipe");
  redirect(withNotice(parsed.data.companyId, "success", "Logo da empresa atualizado."));
}

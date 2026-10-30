"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSponsorSession } from "@/lib/sponsors/session";
import { createAdminClient } from "@/lib/supabase/admin";

const memberSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome completo.").max(160),
  jobTitle: z.string().trim().max(120).optional(),
});
const updateMemberSchema = memberSchema.extend({
  memberId: z.string().uuid(),
  status: z.enum(["active", "inactive"]),
});

export type SponsorPortalActionState = { error: string | null; success: string | null };
const failure = (error: string): SponsorPortalActionState => ({ error, success: null });
const success = (message: string): SponsorPortalActionState => ({ error: null, success: message });

export async function createOwnTeamMemberAction(_: SponsorPortalActionState, formData: FormData) {
  const session = await requireSponsorSession();
  const parsed = memberSchema.safeParse({ fullName: formData.get("full_name"), jobTitle: formData.get("job_title") });
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const admin = createAdminClient();
  const { error } = await admin.from("sponsor_team_members").insert({
    sponsor_id: session.sponsorId,
    full_name: parsed.data.fullName,
    job_title: parsed.data.jobTitle || null,
    created_by_sponsor: true,
  });
  if (error) return failure("Não foi possível cadastrar o integrante.");
  await admin.from("audit_logs").insert({ actor_user_id: null, action: "SPONSOR_TEAM_MEMBER_CREATED_BY_SPONSOR", context: { sponsor_id: session.sponsorId } });
  revalidatePath("/patrocinador/portal");
  return success("Integrante cadastrado.");
}

export async function updateOwnTeamMemberAction(_: SponsorPortalActionState, formData: FormData) {
  const session = await requireSponsorSession();
  const parsed = updateMemberSchema.safeParse({ memberId: formData.get("member_id"), fullName: formData.get("full_name"), jobTitle: formData.get("job_title"), status: formData.get("status") });
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const admin = createAdminClient();
  const { error } = await admin.from("sponsor_team_members").update({ full_name: parsed.data.fullName, job_title: parsed.data.jobTitle || null, status: parsed.data.status }).eq("id", parsed.data.memberId).eq("sponsor_id", session.sponsorId);
  if (error) return failure("Não foi possível atualizar o integrante.");
  await admin.from("audit_logs").insert({ actor_user_id: null, action: "SPONSOR_TEAM_MEMBER_UPDATED_BY_SPONSOR", context: { sponsor_id: session.sponsorId, member_id: parsed.data.memberId, status: parsed.data.status } });
  revalidatePath("/patrocinador/portal");
  return success("Integrante atualizado.");
}


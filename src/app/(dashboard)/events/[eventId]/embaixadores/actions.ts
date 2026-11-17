"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createCredentialSlug } from "@/lib/badges/tokens";
import { createAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({
  eventId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(160),
});

const updateSchema = z.object({
  eventId: z.string().uuid(),
  ambassadorId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(160),
  status: z.enum(["active", "inactive"]),
});

function withNotice(eventId: string, type: "success" | "error", message: string) {
  return `/events/${eventId}/embaixadores?notice_type=${type}&notice=${encodeURIComponent(message)}`;
}

export async function createAmbassadorAction(formData: FormData) {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = createSchema.safeParse({
    eventId: formData.get("event_id"),
    fullName: formData.get("full_name"),
  });
  if (!parsed.success) redirect(withNotice(String(formData.get("event_id") ?? ""), "error", "Informe o nome completo do embaixador."));

  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("status").eq("id", parsed.data.eventId).maybeSingle();
  if (!event || event.status === "arquivado") redirect("/events");

  const { data: ambassador, error } = await admin
    .from("event_ambassadors")
    .insert({
      event_id: parsed.data.eventId,
      full_name: parsed.data.fullName,
      qr_slug: createCredentialSlug(),
      created_by: session.userId,
      updated_by: session.userId,
    })
    .select("id, ambassador_number")
    .single();
  if (error || !ambassador) {
    redirect(withNotice(parsed.data.eventId, "error", "Não foi possível cadastrar o embaixador."));
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EVENT_AMBASSADOR_CREATED",
    context: { event_id: parsed.data.eventId, ambassador_id: ambassador.id, ambassador_number: ambassador.ambassador_number },
  });
  revalidatePath(`/events/${parsed.data.eventId}/embaixadores`);
  redirect(withNotice(parsed.data.eventId, "success", "Embaixador cadastrado com sucesso."));
}

export async function updateAmbassadorAction(formData: FormData) {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = updateSchema.safeParse({
    eventId: formData.get("event_id"),
    ambassadorId: formData.get("ambassador_id"),
    fullName: formData.get("full_name"),
    status: formData.get("status"),
  });
  if (!parsed.success) redirect("/events");

  const admin = createAdminClient();
  const { error } = await admin
    .from("event_ambassadors")
    .update({ full_name: parsed.data.fullName, status: parsed.data.status, updated_by: session.userId })
    .eq("id", parsed.data.ambassadorId)
    .eq("event_id", parsed.data.eventId);
  if (error) redirect(withNotice(parsed.data.eventId, "error", "Não foi possível atualizar o embaixador."));

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EVENT_AMBASSADOR_UPDATED",
    context: {
      event_id: parsed.data.eventId,
      ambassador_id: parsed.data.ambassadorId,
      status: parsed.data.status,
    },
  });
  revalidatePath(`/events/${parsed.data.eventId}/embaixadores`);
  redirect(withNotice(parsed.data.eventId, "success", "Embaixador atualizado."));
}

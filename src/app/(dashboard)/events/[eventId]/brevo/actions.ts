"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { brevoTemplateCatalogSchema, syncBrevoTemplateCatalog } from "@/lib/brevo/templates";
import { createAdminClient } from "@/lib/supabase/admin";

const settingsSchema = z
  .object({
    eventId: z.string().uuid(),
    enabled: z.boolean(),
    templateId: z.number().int().positive().nullable(),
  })
  .refine((value) => !value.enabled || value.templateId !== null, {
    message: "Selecione um modelo ativo antes de habilitar o envio.",
  });

export async function saveEventBrevoSettingsAction(formData: FormData) {
  const session = await requireSession(["super_adm", "organizador"]);
  const rawTemplateId = String(formData.get("template_id") ?? "").trim();
  const parsed = settingsSchema.safeParse({
    eventId: formData.get("event_id"),
    enabled: formData.get("enabled") === "on",
    templateId: rawTemplateId ? Number(rawTemplateId) : null,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Configuração da Brevo inválida.");
  }

  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select("id")
    .eq("id", parsed.data.eventId)
    .maybeSingle();
  if (!event) throw new Error("Evento não encontrado.");

  if (parsed.data.templateId !== null) {
    const { data: template } = await admin
      .from("brevo_templates")
      .select("template_id, is_active")
      .eq("template_id", parsed.data.templateId)
      .maybeSingle();
    if (!template) throw new Error("O modelo selecionado não existe no catálogo sincronizado.");
    if (parsed.data.enabled && !template.is_active) {
      throw new Error("O modelo selecionado está inativo na Brevo.");
    }
  }

  const { error } = await admin.from("event_brevo_settings").upsert({
    event_id: parsed.data.eventId,
    registration_confirmation_enabled: parsed.data.enabled,
    registration_template_id: parsed.data.templateId,
    updated_by: session.userId,
  });
  if (error) throw new Error("Não foi possível salvar a configuração da Brevo.");

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EVENT_BREVO_SETTINGS_UPDATED",
    context: {
      event_id: parsed.data.eventId,
      enabled: parsed.data.enabled,
      template_id: parsed.data.templateId,
    },
  });

  const path = `/events/${parsed.data.eventId}/brevo`;
  revalidatePath(path);
  redirect(`${path}?notice=${encodeURIComponent("Configuração da Brevo salva.")}&notice_type=success`);
}

export async function syncBrevoTemplatesAction(formData: FormData) {
  const session = await requireSession(["super_adm", "organizador"]);
  const eventId = z.string().uuid().parse(formData.get("event_id"));
  const path = `/events/${eventId}/brevo`;
  const webhookUrl = process.env.N8N_BREVO_TEMPLATE_CATALOG_URL;
  const secret = process.env.N8N_INTERNAL_API_SECRET;

  if (!webhookUrl || !secret || secret.length < 32) {
    redirect(
      `${path}?notice=${encodeURIComponent("A sincronização ainda não foi configurada neste ambiente.")}&notice_type=error`
    );
  }

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    redirect(`${path}?notice=${encodeURIComponent("O n8n não respondeu à solicitação.")}&notice_type=error`);
  }

  if (!response.ok) {
    redirect(
      `${path}?notice=${encodeURIComponent("O n8n recusou a atualização do catálogo.")}&notice_type=error`
    );
  }

  const parsed = brevoTemplateCatalogSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    redirect(
      `${path}?notice=${encodeURIComponent("O n8n retornou um catálogo inválido.")}&notice_type=error`
    );
  }

  let syncedCount: number;
  try {
    syncedCount = await syncBrevoTemplateCatalog(parsed.data);
  } catch {
    redirect(
      `${path}?notice=${encodeURIComponent("Não foi possível salvar o catálogo no banco.")}&notice_type=error`
    );
  }

  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "BREVO_TEMPLATE_CATALOG_SYNCED",
    context: { event_id: eventId, template_count: syncedCount },
  });

  revalidatePath(path);
  redirect(
    `${path}?notice=${encodeURIComponent(`${syncedCount} modelos da Brevo foram sincronizados.`)}&notice_type=success`
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { WEBHOOK_EVENT_TYPES } from "@/lib/webhooks/dispatch";

const webhookSchema = z.object({
  eventType: z.enum(WEBHOOK_EVENT_TYPES),
  webhookUrl: z.url("Informe uma URL válida.").refine((value) => value.startsWith("https://"), "O Webhook deve usar HTTPS."),
  enabled: z.boolean(),
  signingSecret: z.string().trim().max(200).optional(),
});

export async function saveWebhookSettingAction(formData: FormData) {
  const session = await requireSession(["super_adm"]);
  const parsed = webhookSchema.safeParse({
    eventType: formData.get("event_type"),
    webhookUrl: formData.get("webhook_url"),
    enabled: formData.get("enabled") === "on",
    signingSecret: formData.get("signing_secret"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Configuração de Webhook inválida.");

  const admin = createAdminClient();
  const { data: current } = await admin
    .from("webhook_settings")
    .select("signing_secret")
    .eq("event_type", parsed.data.eventType)
    .maybeSingle();

  const { error } = await admin.from("webhook_settings").upsert(
    {
      event_type: parsed.data.eventType,
      webhook_url: parsed.data.webhookUrl,
      enabled: parsed.data.enabled,
      signing_secret: parsed.data.signingSecret || current?.signing_secret || null,
      updated_by: session.userId,
    },
    { onConflict: "event_type" }
  );
  if (error) throw new Error("Não foi possível salvar o Webhook.");

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "WEBHOOK_SETTING_UPDATED",
    context: {
      event_type: parsed.data.eventType,
      enabled: parsed.data.enabled,
      has_signing_secret: Boolean(parsed.data.signingSecret || current?.signing_secret),
    },
  });

  revalidatePath("/integracoes");
}

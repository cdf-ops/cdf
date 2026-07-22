import { createHmac, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

export const WEBHOOK_EVENT_TYPES = [
  "registration.completed",
  "credential.generated",
  "checkin.completed",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

type DispatchWebhookInput = {
  eventType: WebhookEventType;
  payload: Record<string, Json | undefined>;
};

function signBody(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export async function dispatchConfiguredWebhook(
  admin: SupabaseClient<Database>,
  { eventType, payload }: DispatchWebhookInput
) {
  const { data: setting } = await admin
    .from("webhook_settings")
    .select("webhook_url, enabled, signing_secret")
    .eq("event_type", eventType)
    .maybeSingle();

  if (!setting?.enabled || setting.webhook_url.endsWith(".invalid")) {
    return { delivered: false, reason: "disabled" as const };
  }

  const deliveryId = randomUUID();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    id: deliveryId,
    type: eventType,
    created_at: new Date().toISOString(),
    data: payload,
  });

  try {
    const response = await fetch(setting.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ClubeDoFrio-Webhooks/1.0",
        "X-CDF-Event": eventType,
        "X-CDF-Delivery": deliveryId,
        "X-CDF-Timestamp": timestamp,
        ...(setting.signing_secret
          ? { "X-CDF-Signature": `sha256=${signBody(setting.signing_secret, timestamp, body)}` }
          : {}),
      },
      body,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    await admin.from("audit_logs").insert({
      actor_user_id: null,
      action: response.ok ? "WEBHOOK_DELIVERED" : "WEBHOOK_DELIVERY_FAILED",
      context: {
        delivery_id: deliveryId,
        event_type: eventType,
        response_status: response.status,
      },
    });

    return { delivered: response.ok, status: response.status };
  } catch (error) {
    await admin.from("audit_logs").insert({
      actor_user_id: null,
      action: "WEBHOOK_DELIVERY_FAILED",
      context: {
        delivery_id: deliveryId,
        event_type: eventType,
        error: error instanceof Error ? error.message.slice(0, 240) : "unknown",
      },
    });
    return { delivered: false, reason: "request_failed" as const };
  }
}

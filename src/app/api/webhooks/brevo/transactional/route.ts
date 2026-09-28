import { createHash } from "crypto";
import { z } from "zod";
import { authenticateBrevoWebhookRequest } from "@/lib/internal-api/authenticate";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

const MAX_PAYLOAD_SIZE = 256 * 1024;

const payloadSchema = z
  .object({
    event: z.string().trim().min(1).max(80),
    "message-id": z.string().trim().min(1).max(500),
    email: z.string().trim().max(320).optional(),
    id: z.union([z.number(), z.string()]).optional(),
    ts_event: z.coerce.number().int().positive().optional(),
    ts: z.coerce.number().int().positive().optional(),
    reason: z.string().trim().max(1000).optional(),
  })
  .loose();

function occurredAt(timestamp: number | undefined) {
  if (!timestamp) return null;
  const date = new Date(timestamp * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function POST(request: Request) {
  const authentication = authenticateBrevoWebhookRequest(request);
  if (!authentication.authenticated) return authentication.response;

  const rawBody = await request.text();
  if (rawBody.length > MAX_PAYLOAD_SIZE) {
    return Response.json({ error: "Payload muito grande." }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Evento da Brevo inválido." }, { status: 400 });
  }

  const payload = parsed.data;
  const timestamp = payload.ts_event ?? payload.ts;
  const deduplicationKey = createHash("sha256")
    .update(
      [payload["message-id"], payload.event, timestamp ?? "", payload.id ?? "", payload.email ?? ""].join("|")
    )
    .digest("hex");

  const admin = createAdminClient();
  const { data: status, error } = await admin.rpc("record_brevo_delivery_event", {
    p_message_id: payload["message-id"],
    p_event_type: payload.event,
    p_deduplication_key: deduplicationKey,
    p_occurred_at: occurredAt(timestamp),
    p_payload: payload as Json,
  });

  if (error) {
    return Response.json({ error: "Não foi possível registrar o evento." }, { status: 500 });
  }

  return Response.json({ received: true, status }, { status: 202 });
}

import { z } from "zod";
import { authenticateN8nRequest } from "@/lib/internal-api/authenticate";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const requestSchema = z.object({
  workerId: z.string().trim().min(1).max(120),
  limit: z.number().int().min(1).max(50).default(10),
  lockSeconds: z.number().int().min(60).max(1800).default(300),
});

export async function POST(request: Request) {
  const authentication = authenticateN8nRequest(request);
  if (!authentication.authenticated) return authentication.response;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Parâmetros de reserva inválidos." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_email_delivery_jobs", {
    p_worker_id: parsed.data.workerId,
    p_limit: parsed.data.limit,
    p_lock_seconds: parsed.data.lockSeconds,
  });

  if (error) {
    return Response.json({ error: "Não foi possível reservar os envios." }, { status: 500 });
  }

  return Response.json({ jobs: data ?? [] });
}

import { z } from "zod";
import { authenticateN8nRequest } from "@/lib/internal-api/authenticate";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const requestSchema = z
  .object({
    workerId: z.string().trim().min(1).max(120),
    outcome: z.enum(["accepted", "retryable_failed", "permanent_failed"]),
    n8nExecutionId: z.string().trim().max(200).nullish(),
    brevoContactId: z.number().int().positive().nullish(),
    brevoMessageId: z.string().trim().max(500).nullish(),
    responseStatus: z.number().int().min(100).max(599).nullish(),
    errorCode: z.string().trim().max(120).nullish(),
    errorMessage: z.string().trim().max(1000).nullish(),
    retryAt: z.iso.datetime({ offset: true }).nullish(),
  })
  .superRefine((value, context) => {
    if (value.outcome === "accepted" && (!value.brevoContactId || !value.brevoMessageId)) {
      context.addIssue({
        code: "custom",
        message: "Envios aceitos exigem os identificadores da Brevo.",
      });
    }
  });

export async function POST(
  request: Request,
  context: RouteContext<"/api/internal/email-deliveries/[jobId]/result">
) {
  const authentication = authenticateN8nRequest(request);
  if (!authentication.authenticated) return authentication.response;

  const [{ jobId }, body] = await Promise.all([
    context.params,
    request.json().catch(() => null),
  ]);
  const parsedJobId = z.string().uuid().safeParse(jobId);
  const parsed = requestSchema.safeParse(body);
  if (!parsedJobId.success || !parsed.success) {
    return Response.json({ error: "Resultado de envio inválido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: status, error } = await admin.rpc("complete_email_delivery_job", {
    p_job_id: parsedJobId.data,
    p_worker_id: parsed.data.workerId,
    p_outcome: parsed.data.outcome,
    p_n8n_execution_id: parsed.data.n8nExecutionId ?? null,
    p_brevo_contact_id: parsed.data.brevoContactId ?? null,
    p_brevo_message_id: parsed.data.brevoMessageId ?? null,
    p_response_status: parsed.data.responseStatus ?? null,
    p_error_code: parsed.data.errorCode ?? null,
    p_error_message: parsed.data.errorMessage ?? null,
    p_retry_at: parsed.data.retryAt ?? null,
  });

  if (error) {
    const statusCode = error.message.includes("not leased") ? 409 : error.message.includes("not found") ? 404 : 500;
    return Response.json({ error: "Não foi possível registrar o resultado do envio." }, { status: statusCode });
  }

  return Response.json({ status });
}

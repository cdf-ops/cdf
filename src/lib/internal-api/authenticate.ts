import { timingSafeEqual } from "crypto";

const MINIMUM_SECRET_LENGTH = 32;

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function authenticateBearerRequest(request: Request, configuredSecret: string | undefined) {
  if (!configuredSecret || configuredSecret.length < MINIMUM_SECRET_LENGTH) {
    return {
      authenticated: false as const,
      response: Response.json({ error: "Integração interna indisponível." }, { status: 503 }),
    };
  }

  const authorization = request.headers.get("authorization");
  const providedSecret = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!providedSecret || !constantTimeEqual(providedSecret, configuredSecret)) {
    return {
      authenticated: false as const,
      response: Response.json({ error: "Não autorizado." }, { status: 401 }),
    };
  }

  return { authenticated: true as const };
}

export function authenticateN8nRequest(request: Request) {
  return authenticateBearerRequest(request, process.env.N8N_INTERNAL_API_SECRET);
}

export function authenticateBrevoWebhookRequest(request: Request) {
  return authenticateBearerRequest(request, process.env.BREVO_WEBHOOK_SECRET);
}

import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const tokenPayloadSchema = z.object({
  eventId: z.string().uuid(),
  eventDayId: z.string().uuid(),
  participantId: z.string().uuid(),
  exp: z.number().int().positive(),
});

export type CertificateAccessPayload = z.infer<typeof tokenPayloadSchema>;

function getTokenSecret() {
  const secret = process.env.CERTIFICATE_ACCESS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("CERTIFICATE_ACCESS_SECRET ou SUPABASE_SERVICE_ROLE_KEY precisa estar configurada.");
  }
  return secret;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getTokenSecret()).update(encodedPayload).digest("base64url");
}

export function createCertificateAccessToken(
  payload: Omit<CertificateAccessPayload, "exp">,
  expiresInSeconds = 60 * 60 * 24 * 7
) {
  const encodedPayload = encodeBase64Url(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    })
  );
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyCertificateAccessToken(token: string) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = tokenPayloadSchema.parse(JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

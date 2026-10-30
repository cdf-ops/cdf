"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyPassword } from "@/lib/security/password-vault";
import { createSponsorSession, destroySponsorSession } from "@/lib/sponsors/session";
import { createAdminClient } from "@/lib/supabase/admin";

const loginSchema = z.object({
  username: z.string().trim().min(3).max(80),
  password: z.string().min(5).max(128),
});

export type SponsorLoginState = { error: string | null };

function fingerprint(source: string) {
  return createHash("sha256").update(source).digest("hex");
}

export async function sponsorLoginAction(
  _: SponsorLoginState,
  formData: FormData
): Promise<SponsorLoginState> {
  const parsed = loginSchema.safeParse({ username: formData.get("username"), password: formData.get("password") });
  if (!parsed.success) return { error: "Usuário ou senha inválidos." };

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = requestHeaders.get("user-agent") ?? "unknown";
  const fingerprintHash = fingerprint(`${forwardedFor}:${userAgent}`);
  const usernameNormalized = parsed.data.username.toLocaleLowerCase("pt-BR");
  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const admin = createAdminClient();

  const { count } = await admin
    .from("sponsor_auth_attempts")
    .select("id", { count: "exact", head: true })
    .eq("username_normalized", usernameNormalized)
    .eq("fingerprint_hash", fingerprintHash)
    .gte("attempted_at", windowStart);
  if ((count ?? 0) >= 10) return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };

  const { data: sponsor } = await admin
    .from("sponsors")
    .select("id, password_hash, status")
    .eq("username_normalized", usernameNormalized)
    .maybeSingle();
  const valid = Boolean(sponsor && sponsor.status === "active" && verifyPassword(parsed.data.password, sponsor.password_hash));

  await admin.from("sponsor_auth_attempts").insert({
    username_normalized: usernameNormalized,
    fingerprint_hash: fingerprintHash,
    succeeded: valid,
  });
  if (!valid || !sponsor) return { error: "Usuário ou senha inválidos." };

  await createSponsorSession(sponsor.id);
  await admin.from("audit_logs").insert({
    actor_user_id: null,
    action: "SPONSOR_LOGIN_SUCCEEDED",
    context: { sponsor_id: sponsor.id },
  });
  redirect("/patrocinador/portal");
}

export async function sponsorLogoutAction() {
  await destroySponsorSession();
  redirect("/patrocinador");
}


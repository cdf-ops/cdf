import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE_NAME = "clube_sponsor_session";
const SESSION_DAYS = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type SponsorSession = {
  sessionId: string;
  sponsorId: string;
  sponsorName: string;
  username: string;
};

export async function createSponsorSession(sponsorId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const admin = createAdminClient();
  const { error } = await admin.from("sponsor_sessions").insert({
    sponsor_id: sponsorId,
    token_hash: hashToken(token),
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error("Não foi possível iniciar a sessão do patrocinador.");

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSponsorSession(): Promise<SponsorSession | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("sponsor_sessions")
    .select("id, sponsor_id, expires_at, revoked_at, last_seen_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) return null;

  const { data: sponsor } = await admin
    .from("sponsors")
    .select("id, name, username, status")
    .eq("id", session.sponsor_id)
    .maybeSingle();
  if (!sponsor || sponsor.status !== "active") return null;

  const lastSeenAt = session.last_seen_at ? new Date(session.last_seen_at).getTime() : 0;
  if (Date.now() - lastSeenAt > 15 * 60 * 1000) {
    await admin.from("sponsor_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", session.id);
  }

  return {
    sessionId: session.id,
    sponsorId: sponsor.id,
    sponsorName: sponsor.name,
    username: sponsor.username,
  };
}

export async function requireSponsorSession() {
  const session = await getSponsorSession();
  if (!session) redirect("/patrocinador");
  return session;
}

export async function destroySponsorSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    const admin = createAdminClient();
    await admin
      .from("sponsor_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashToken(token))
      .is("revoked_at", null);
  }
  cookieStore.delete(COOKIE_NAME);
}


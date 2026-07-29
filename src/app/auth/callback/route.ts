import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDaysFromNow } from "@/lib/exhibitors/access-status";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/events";
}

function hasRecentEmailVerification(claims: unknown) {
  const methods =
    typeof claims === "object" && claims && "amr" in claims && Array.isArray(claims.amr)
      ? claims.amr
      : [];
  const cutoff = Math.floor(Date.now() / 1000) - 15 * 60;
  return methods.some(
    (entry) =>
      typeof entry === "object" &&
      entry &&
      "method" in entry &&
      ["otp", "magiclink"].includes(String(entry.method)) &&
      "timestamp" in entry &&
      typeof entry.timestamp === "number" &&
      entry.timestamp >= cutoff
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const origin = url.origin;
  if (!code) return NextResponse.redirect(`${origin}/login`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login`);

  if (next === "/renovar-acesso") {
    const [{ data: userData }, { data: claimsData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getClaims(),
    ]);
    const user = userData.user;
    if (!user || !hasRecentEmailVerification(claimsData?.claims)) {
      return NextResponse.redirect(`${origin}/renovar-acesso`);
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("user_profiles")
      .select("role, status, password_change_required")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile || profile.role !== "expositor" || profile.status !== "active" || profile.password_change_required) {
      return NextResponse.redirect(`${origin}/login`);
    }

    const now = new Date().toISOString();
    const { data: renewed, error: renewalError } = await admin
      .from("exhibitor_users")
      .update({
        access_validated_at: now,
        access_valid_until: addDaysFromNow(30),
        access_validated_by: user.id,
        emergency_access_until: null,
      })
      .eq("user_id", user.id)
      .eq("status", "active")
      .select("id");
    if (renewalError || !renewed?.length) {
      return NextResponse.redirect(`${origin}/renovar-acesso`);
    }

    await admin.from("audit_logs").insert({
      actor_user_id: user.id,
      action: "EXHIBITOR_ACCESS_RENEWED_BY_EMAIL",
      context: { user_id: user.id, link_count: renewed.length, valid_days: 30 },
    });
    return NextResponse.redirect(`${origin}/events`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

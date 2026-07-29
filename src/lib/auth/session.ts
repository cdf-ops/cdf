import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAnyRole, type AppRole } from "@/lib/auth/roles";
import { isExhibitorAccessLinkActive } from "@/lib/exhibitors/access-status";

export type AccountState = {
  userId: string;
  email: string | null;
  role: AppRole;
  status: "active" | "inactive";
  passwordChangeRequired: boolean;
  exhibitorAccessActive: boolean;
};

export type CurrentSession = Pick<AccountState, "userId" | "email" | "role">;

export async function getAccountState(): Promise<AccountState | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role, status, password_change_required")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  let exhibitorAccessActive = true;
  if (profile.role === "expositor") {
    const { data: links } = await admin
      .from("exhibitor_users")
      .select("status, access_valid_until, emergency_access_until")
      .eq("user_id", user.id);
    exhibitorAccessActive = (links ?? []).some((link) => isExhibitorAccessLinkActive(link));
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role: profile.role,
    status: profile.status,
    passwordChangeRequired: profile.password_change_required,
    exhibitorAccessActive,
  };
}

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const account = await getAccountState();
  if (
    !account ||
    account.status !== "active" ||
    account.passwordChangeRequired ||
    (account.role === "expositor" && !account.exhibitorAccessActive)
  ) {
    return null;
  }
  return {
    userId: account.userId,
    email: account.email,
    role: account.role,
  };
}

export async function requireSession(allowedRoles?: AppRole[]) {
  const account = await getAccountState();

  if (!account || account.status !== "active") {
    redirect("/login");
  }

  if (account.passwordChangeRequired) {
    redirect("/alterar-senha");
  }

  if (account.role === "expositor" && !account.exhibitorAccessActive) {
    redirect("/renovar-acesso");
  }

  if (allowedRoles && !hasAnyRole(account.role, allowedRoles)) {
    redirect("/forbidden");
  }

  return {
    userId: account.userId,
    email: account.email,
    role: account.role,
  };
}

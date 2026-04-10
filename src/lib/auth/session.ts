import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasAnyRole, type AppRole } from "@/lib/auth/roles";

export type CurrentSession = {
  userId: string;
  email: string | null;
  role: AppRole;
};

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") {
    return null;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role: profile.role,
  };
}

export async function requireSession(allowedRoles?: AppRole[]) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (allowedRoles && !hasAnyRole(session.role, allowedRoles)) {
    redirect("/forbidden");
  }

  return session;
}


import type { CurrentSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getAccessibleExhibitorCompanyIds(session: CurrentSession) {
  const admin = createAdminClient();

  if (session.role === "super_adm" || session.role === "organizador") {
    const { data } = await admin.from("exhibitor_companies").select("id");
    return (data ?? []).map((company) => company.id);
  }

  if (session.role !== "expositor") {
    return [];
  }

  const { data } = await admin
    .from("exhibitor_users")
    .select("exhibitor_company_id")
    .eq("user_id", session.userId);

  return [...new Set((data ?? []).map((link) => link.exhibitor_company_id))];
}

export async function canManageExhibitorCompany(session: CurrentSession, companyId: string) {
  const companyIds = await getAccessibleExhibitorCompanyIds(session);
  return companyIds.includes(companyId);
}

export async function getAccessibleEventExhibitor(
  session: CurrentSession,
  eventId: string,
  requestedCompanyId?: string | null
) {
  const admin = createAdminClient();
  const companyIds = await getAccessibleExhibitorCompanyIds(session);
  const allowedCompanyIds = requestedCompanyId
    ? companyIds.filter((companyId) => companyId === requestedCompanyId)
    : companyIds;

  if (!allowedCompanyIds.length) {
    return null;
  }

  const { data } = await admin
    .from("event_exhibitors")
    .select("id, event_id, exhibitor_company_id")
    .eq("event_id", eventId)
    .in("exhibitor_company_id", allowedCompanyIds)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data;
}

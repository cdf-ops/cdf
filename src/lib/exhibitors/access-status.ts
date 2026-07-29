export type ExhibitorAccessLink = {
  status: "active" | "suspended";
  access_valid_until: string;
  emergency_access_until: string | null;
};

export function isExhibitorAccessLinkActive(link: ExhibitorAccessLink, now = Date.now()) {
  if (link.status !== "active") return false;
  const regularAccessActive = new Date(link.access_valid_until).getTime() > now;
  const emergencyAccessActive =
    Boolean(link.emergency_access_until) &&
    new Date(link.emergency_access_until as string).getTime() > now;
  return regularAccessActive || emergencyAccessActive;
}

export function addDaysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function addHoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export async function getActiveExhibitorCompanyIdsForUser(
  admin: SupabaseClient<Database>,
  userId: string
) {
  const { data } = await admin
    .from("exhibitor_users")
    .select("exhibitor_company_id, status, access_valid_until, emergency_access_until")
    .eq("user_id", userId);
  return [
    ...new Set(
      (data ?? [])
        .filter((link) => isExhibitorAccessLinkActive(link))
        .map((link) => link.exhibitor_company_id)
    ),
  ];
}
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

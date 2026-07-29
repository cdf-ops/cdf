import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getAccessibleExhibitorCompanyIds } from "@/lib/exhibitors/access";
import { createAssetSignedUrl } from "@/lib/certificates/assets";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamManagementSection } from "@/app/(dashboard)/equipe/team-management-section";

type TeamPageProps = {
  searchParams: Promise<{
    empresa?: string;
    notice?: string;
    notice_type?: "success" | "error";
  }>;
};

async function getUserEmailMap(userIds: string[]) {
  const admin = createAdminClient();
  const emailMap = new Map<string, string>();
  const remaining = new Set(userIds);
  const perPage = 200;
  for (let page = 1; page <= 20 && remaining.size > 0; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const users = data?.users ?? [];
    users.forEach((user) => {
      if (remaining.has(user.id)) {
        emailMap.set(user.id, user.email ?? "sem-email");
        remaining.delete(user.id);
      }
    });
    if (users.length < perPage) break;
  }
  return emailMap;
}

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const session = await requireSession(["super_adm", "organizador", "expositor"]);
  if (session.role !== "expositor") {
    redirect("/expositores");
  }

  const params = await searchParams;
  const admin = createAdminClient();
  const accessibleIds = await getAccessibleExhibitorCompanyIds(session);
  const { data: companyData } = accessibleIds.length
    ? await admin
        .from("exhibitor_companies")
        .select("id, name, trade_name, logo_path")
        .in("id", accessibleIds)
        .order("trade_name", { ascending: true })
    : { data: [] };
  const companies = companyData ?? [];
  const selectedCompany = companies.find((company) => company.id === params.empresa) ?? companies[0] ?? null;

  if (!selectedCompany) {
    return (
      <section className="surface-card rounded-2xl p-6">
        <h1 className="font-headline text-3xl font-extrabold tracking-tight">Equipe Geral</h1>
        <p className="mt-2 text-sm text-muted">Seu usuário ainda não está vinculado a uma empresa expositora.</p>
      </section>
    );
  }

  const [{ data: membersData }, { data: linkedUsersData }, logoUrl] = await Promise.all([
    admin
      .from("exhibitor_team_members")
      .select("id, full_name, job_title, linked_user_id, status")
      .eq("exhibitor_company_id", selectedCompany.id)
      .order("status", { ascending: true })
      .order("full_name", { ascending: true }),
    admin.from("exhibitor_users").select("user_id").eq("exhibitor_company_id", selectedCompany.id),
    createAssetSignedUrl(admin, selectedCompany.logo_path),
  ]);
  const linkedUserIds = (linkedUsersData ?? []).map((link) => link.user_id);
  const emailMap = await getUserEmailMap(linkedUserIds);

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-2xl p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--outline)]">Empresa expositora</p>
        <div className="mt-1 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">Equipe Geral</h1>
            <p className="mt-2 text-sm text-muted">Gerencie as pessoas da sua empresa para todos os eventos.</p>
          </div>
          {companies.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {companies.map((company) => (
                <Link
                  key={company.id}
                  href={`/equipe?empresa=${company.id}`}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    company.id === selectedCompany.id
                      ? "bg-[var(--primary)] text-white"
                      : "ghost-border bg-white text-[var(--foreground)]"
                  }`}
                >
                  {company.trade_name ?? company.name}
                </Link>
              ))}
            </div>
          ) : (
            <span className="rounded-full bg-[var(--primary-soft)] px-4 py-2 text-sm font-bold text-[var(--primary)]">
              {selectedCompany.trade_name ?? selectedCompany.name}
            </span>
          )}
        </div>
      </div>

      <TeamManagementSection
        company={{
          id: selectedCompany.id,
          name: selectedCompany.trade_name ?? selectedCompany.name,
          hasLogo: Boolean(selectedCompany.logo_path),
        }}
        logoUrl={logoUrl}
        members={(membersData ?? []).map((member) => ({
          id: member.id,
          fullName: member.full_name,
          jobTitle: member.job_title,
          linkedUserId: member.linked_user_id,
          status: member.status,
        }))}
        users={linkedUserIds.map((userId) => ({
          userId,
          email: emailMap.get(userId) ?? userId,
        }))}
        returnTo={`/equipe?empresa=${selectedCompany.id}`}
        notice={params.notice}
        noticeType={params.notice_type}
      />
    </section>
  );
}

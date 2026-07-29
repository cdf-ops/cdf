import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth/session";
import { getAccessibleExhibitorCompanyIds } from "@/lib/exhibitors/access";
import { createAssetSignedUrl } from "@/lib/certificates/assets";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createTeamMemberAction,
  updateTeamMemberAction,
  updateTeamMemberStatusAction,
  uploadCompanyLogoAction,
} from "@/app/(dashboard)/equipe/actions";
import { LogoUploadField } from "@/app/(dashboard)/equipe/logo-upload-field";

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
      .select("id, full_name, job_title, linked_user_id, status, created_at")
      .eq("exhibitor_company_id", selectedCompany.id)
      .order("status", { ascending: true })
      .order("full_name", { ascending: true }),
    admin.from("exhibitor_users").select("user_id").eq("exhibitor_company_id", selectedCompany.id),
    createAssetSignedUrl(admin, selectedCompany.logo_path),
  ]);
  const members = membersData ?? [];
  const linkedUserIds = (linkedUsersData ?? []).map((link) => link.user_id);
  const emailMap = await getUserEmailMap(linkedUserIds);

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-2xl p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--outline)]">Empresa expositora</p>
        <div className="mt-1 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">Equipe Geral</h1>
            <p className="mt-2 text-sm text-muted">
              Cadastre uma vez as pessoas da empresa e reutilize a equipe em todos os eventos.
            </p>
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

      {params.notice ? (
        <p className={`rounded-xl px-4 py-3 text-sm ${
          params.notice_type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[var(--danger)]"
        }`}>
          {params.notice}
        </p>
      ) : null}

      <details className="surface-card rounded-2xl p-5" open={!selectedCompany.logo_path}>
        <summary className="cursor-pointer font-headline text-xl font-extrabold tracking-tight">Logo da empresa</summary>
        <p className="mt-2 text-sm text-muted">
          Um único logo será reutilizado em todas as credenciais. A imagem precisa ser quadrada.
        </p>
        <form action={uploadCompanyLogoAction} className="mt-4">
          <input type="hidden" name="company_id" value={selectedCompany.id} />
          <LogoUploadField currentLogoUrl={logoUrl} />
          <SubmitButton pendingLabel="Enviando logo..." className="gradient-primary mt-4 rounded-xl px-5 py-3 text-sm font-semibold text-white">
            Salvar logo
          </SubmitButton>
        </form>
      </details>

      <div className="surface-card rounded-2xl p-5">
        <h2 className="font-headline text-xl font-extrabold tracking-tight">Adicionar pessoa</h2>
        <p className="mt-1 text-sm text-muted">A pessoa não receberá login. O vínculo com usuário do sistema é opcional.</p>
        <form action={createTeamMemberAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="company_id" value={selectedCompany.id} />
          <label className="text-sm font-semibold">
            Nome completo
            <input name="full_name" required maxLength={160} className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold">
            Cargo ou função <span className="font-normal text-muted">(opcional)</span>
            <input name="job_title" maxLength={100} className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold md:col-span-2">
            Usuário com acesso ao sistema <span className="font-normal text-muted">(opcional)</span>
            <select name="linked_user_id" defaultValue="" className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal">
              <option value="">Pessoa sem acesso ao sistema</option>
              {linkedUserIds.map((userId) => (
                <option key={userId} value={userId}>{emailMap.get(userId) ?? userId}</option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <SubmitButton pendingLabel="Adicionando..." className="gradient-primary rounded-xl px-5 py-3 text-sm font-semibold text-white">
              Adicionar à equipe
            </SubmitButton>
          </div>
        </form>
      </div>

      <div className="surface-card rounded-2xl p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-headline text-2xl font-extrabold tracking-tight">Pessoas cadastradas</h2>
            <p className="mt-1 text-sm text-muted">
              {members.filter((member) => member.status === "active").length} ativas · {members.length} no histórico
            </p>
          </div>
          <Link href="/events" className="text-sm font-bold text-[var(--primary)]">Ir para os eventos e imprimir credenciais →</Link>
        </div>

        <div className="mt-5 grid gap-3">
          {members.map((member) => (
            <details key={member.id} className="rounded-xl border border-[var(--outline-variant)]/45 bg-white p-4">
              <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-[var(--foreground)]">{member.full_name}</p>
                    <p className="text-sm text-muted">{member.job_title || "Cargo não informado"}</p>
                    {member.linked_user_id ? (
                      <p className="mt-1 text-xs text-muted">Login associado: {emailMap.get(member.linked_user_id) ?? "usuário"}</p>
                    ) : null}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                    member.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {member.status === "active" ? "Ativa" : "Inativa"}
                  </span>
                </div>
              </summary>

              <form action={updateTeamMemberAction} className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2">
                <input type="hidden" name="company_id" value={selectedCompany.id} />
                <input type="hidden" name="member_id" value={member.id} />
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">
                  Nome completo
                  <input name="full_name" required maxLength={160} defaultValue={member.full_name} className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)]" />
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">
                  Cargo ou função
                  <input name="job_title" maxLength={100} defaultValue={member.job_title ?? ""} className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)]" />
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--outline)] md:col-span-2">
                  Usuário associado
                  <select name="linked_user_id" defaultValue={member.linked_user_id ?? ""} className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)]">
                    <option value="">Pessoa sem acesso ao sistema</option>
                    {linkedUserIds.map((userId) => (
                      <option key={userId} value={userId}>{emailMap.get(userId) ?? userId}</option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <SubmitButton pendingLabel="Salvando..." className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white">
                    Salvar alterações
                  </SubmitButton>
                </div>
              </form>
              <form action={updateTeamMemberStatusAction} className="mt-2">
                <input type="hidden" name="company_id" value={selectedCompany.id} />
                <input type="hidden" name="member_id" value={member.id} />
                <input type="hidden" name="status" value={member.status === "active" ? "inactive" : "active"} />
                <SubmitButton
                  pendingLabel={member.status === "active" ? "Desativando..." : "Reativando..."}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                    member.status === "active" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {member.status === "active" ? "Desativar pessoa" : "Reativar pessoa"}
                </SubmitButton>
              </form>
            </details>
          ))}
          {!members.length ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted">
              Nenhuma pessoa cadastrada na Equipe Geral.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

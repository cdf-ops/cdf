import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import {
  createTeamMemberAction,
  updateTeamMemberAction,
  updateTeamMemberStatusAction,
  uploadCompanyLogoAction,
} from "@/app/(dashboard)/equipe/actions";
import { LogoUploadField } from "@/app/(dashboard)/equipe/logo-upload-field";

export type TeamMemberItem = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  linkedUserId: string | null;
  status: "active" | "inactive";
};

export type TeamUserOption = {
  userId: string;
  email: string;
};

type TeamManagementSectionProps = {
  company: {
    id: string;
    name: string;
    hasLogo: boolean;
  };
  logoUrl: string | null;
  members: TeamMemberItem[];
  users: TeamUserOption[];
  returnTo: string;
  notice?: string;
  noticeType?: "success" | "error";
  showEventsLink?: boolean;
};

export function TeamManagementSection({
  company,
  logoUrl,
  members,
  users,
  returnTo,
  notice,
  noticeType,
  showEventsLink = true,
}: TeamManagementSectionProps) {
  const activeMembers = members.filter((member) => member.status === "active");
  const userById = new Map(users.map((user) => [user.userId, user]));

  return (
    <section id="equipe-geral" className="scroll-mt-24 space-y-4">
      <div className="surface-card rounded-2xl p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--outline)]">Pessoas da empresa</p>
        <h2 className="mt-1 font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
          Equipe Geral
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Cadastre uma vez a equipe de {company.name} e reutilize essas pessoas nas credenciais de todos os eventos.
        </p>
      </div>

      {notice ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            noticeType === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[var(--danger)]"
          }`}
        >
          {notice}
        </p>
      ) : null}

      <details className="surface-card rounded-2xl p-5" open={!company.hasLogo}>
        <summary className="cursor-pointer font-headline text-lg font-extrabold tracking-tight">
          Logo para as credenciais
        </summary>
        <p className="mt-2 text-sm text-muted">
          Um único logo será reutilizado em todos os eventos. A imagem precisa ser quadrada.
        </p>
        <form action={uploadCompanyLogoAction} className="mt-4">
          <input type="hidden" name="company_id" value={company.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <LogoUploadField currentLogoUrl={logoUrl} />
          <SubmitButton
            pendingLabel="Enviando logo..."
            className="gradient-primary mt-4 rounded-xl px-5 py-3 text-sm font-semibold text-white"
          >
            Salvar logo
          </SubmitButton>
        </form>
      </details>

      <div className="surface-card rounded-2xl p-5">
        <h3 className="font-headline text-lg font-extrabold tracking-tight">Adicionar pessoa</h3>
        <p className="mt-1 text-sm text-muted">
          A pessoa não receberá login. O vínculo com um usuário do sistema é opcional.
        </p>
        <form action={createTeamMemberAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="company_id" value={company.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <label className="text-sm font-semibold">
            Nome completo
            <input
              name="full_name"
              required
              maxLength={160}
              className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Cargo ou função <span className="font-normal text-muted">(opcional)</span>
            <input
              name="job_title"
              maxLength={100}
              className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold md:col-span-2">
            Usuário com acesso ao sistema <span className="font-normal text-muted">(opcional)</span>
            <select
              name="linked_user_id"
              defaultValue=""
              className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
            >
              <option value="">Pessoa sem acesso ao sistema</option>
              {users.map((user) => (
                <option key={user.userId} value={user.userId}>
                  {user.email}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <SubmitButton
              pendingLabel="Adicionando..."
              className="gradient-primary rounded-xl px-5 py-3 text-sm font-semibold text-white"
            >
              Adicionar à equipe
            </SubmitButton>
          </div>
        </form>
      </div>

      <div className="surface-card rounded-2xl p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-headline text-xl font-extrabold tracking-tight">Pessoas cadastradas</h3>
            <p className="mt-1 text-sm text-muted">
              {activeMembers.length} ativas · {members.length} no histórico
            </p>
          </div>
          {showEventsLink ? (
            <Link href="/events" className="text-sm font-bold text-[var(--primary)]">
              Ir para os eventos e imprimir credenciais →
            </Link>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3">
          {members.map((member) => {
            const linkedUser = member.linkedUserId ? userById.get(member.linkedUserId) : null;
            return (
              <details
                key={member.id}
                className="rounded-xl border border-[var(--outline-variant)]/45 bg-white p-4"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-[var(--foreground)]">{member.fullName}</p>
                      <p className="text-sm text-muted">{member.jobTitle || "Cargo não informado"}</p>
                      {linkedUser ? (
                        <p className="mt-1 text-xs text-muted">Login associado: {linkedUser.email}</p>
                      ) : null}
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        member.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {member.status === "active" ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                </summary>

                <form action={updateTeamMemberAction} className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2">
                  <input type="hidden" name="company_id" value={company.id} />
                  <input type="hidden" name="member_id" value={member.id} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <label className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">
                    Nome completo
                    <input
                      name="full_name"
                      required
                      maxLength={160}
                      defaultValue={member.fullName}
                      className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)]"
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">
                    Cargo ou função
                    <input
                      name="job_title"
                      maxLength={100}
                      defaultValue={member.jobTitle ?? ""}
                      className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)]"
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wide text-[var(--outline)] md:col-span-2">
                    Usuário associado
                    <select
                      name="linked_user_id"
                      defaultValue={member.linkedUserId ?? ""}
                      className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal text-[var(--foreground)]"
                    >
                      <option value="">Pessoa sem acesso ao sistema</option>
                      {users.map((user) => (
                        <option key={user.userId} value={user.userId}>
                          {user.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="md:col-span-2">
                    <SubmitButton
                      pendingLabel="Salvando..."
                      className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Salvar alterações
                    </SubmitButton>
                  </div>
                </form>
                <form action={updateTeamMemberStatusAction} className="mt-2">
                  <input type="hidden" name="company_id" value={company.id} />
                  <input type="hidden" name="member_id" value={member.id} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <input type="hidden" name="status" value={member.status === "active" ? "inactive" : "active"} />
                  <SubmitButton
                    pendingLabel={member.status === "active" ? "Desativando..." : "Reativando..."}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                      member.status === "active"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {member.status === "active" ? "Desativar pessoa" : "Reativar pessoa"}
                  </SubmitButton>
                </form>
              </details>
            );
          })}
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

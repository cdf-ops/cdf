import Form from "next/form";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth/session";
import { formatSaoPauloDate, formatSaoPauloDateTime } from "@/lib/date-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAllAuthUsers } from "@/lib/users/auth-admin";
import { CreateUserForm } from "@/app/(dashboard)/usuarios/create-user-form";
import { updateUserProfileAction } from "@/app/(dashboard)/usuarios/actions";
import { EmergencyResetForm } from "@/app/(dashboard)/usuarios/emergency-reset-form";
import { isExhibitorAccessLinkActive } from "@/lib/exhibitors/access-status";

type UsersPageProps = {
  searchParams: Promise<{
    q?: string;
    notice?: string;
    notice_type?: "success" | "error";
  }>;
};

type ProfileRow = {
  id: string;
  role: "super_adm" | "organizador" | "recepcao" | "expositor";
  status: "active" | "inactive";
  password_change_required: boolean;
};

type ExhibitorAccessLink = {
  user_id: string;
  status: "active" | "suspended";
  access_valid_until: string;
  emergency_access_until: string | null;
};

function roleLabel(role: "super_adm" | "organizador" | "recepcao" | "expositor") {
  switch (role) {
    case "super_adm":
      return "Super ADM";
    case "organizador":
      return "Organizador";
    case "recepcao":
      return "Recepção";
    case "expositor":
      return "Expositor";
    default:
      return role;
  }
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const session = await requireSession(["super_adm", "organizador"]);
  const { q = "", notice, notice_type } = await searchParams;
  const queryText = q.trim().toLowerCase();

  const authUsers = (await listAllAuthUsers()).sort((a, b) => (a.email ?? "").localeCompare(b.email ?? "", "pt-BR"));
  const userIds = authUsers.map((user) => user.id);

  const admin = createAdminClient();
  const profileChunks =
    userIds.length > 0
      ? await Promise.all(
          chunkArray(userIds, 400).map(async (idsChunk) => {
            const { data } = await admin
              .from("user_profiles")
              .select("id, role, status, password_change_required")
              .in("id", idsChunk);
            return (data ?? []) as ProfileRow[];
          })
        )
      : [];

  const profileMap = new Map(profileChunks.flat().map((profile) => [profile.id, profile]));
  const { data: exhibitorLinksData } = userIds.length
    ? await admin
        .from("exhibitor_users")
        .select("user_id, status, access_valid_until, emergency_access_until")
        .in("user_id", userIds)
    : { data: [] };
  const exhibitorLinksByUser = new Map<string, ExhibitorAccessLink[]>();
  (exhibitorLinksData ?? []).forEach((link) => {
    const current = exhibitorLinksByUser.get(link.user_id) ?? [];
    current.push(link);
    exhibitorLinksByUser.set(link.user_id, current);
  });

  const rows = authUsers
    .map((user) => {
      const profile = profileMap.get(user.id);
      return {
        userId: user.id,
        email: user.email ?? "sem-email",
        role: profile?.role ?? "recepcao",
        status: profile?.status ?? "active",
        hasProfile: Boolean(profile),
        passwordChangeRequired: profile?.password_change_required ?? false,
        exhibitorAccessActive:
          profile?.role === "expositor"
            ? (exhibitorLinksByUser.get(user.id) ?? []).some((link) => isExhibitorAccessLinkActive(link))
            : true,
        lastSignInAt: user.last_sign_in_at,
        createdAt: user.created_at,
      };
    })
    .filter((row) => session.role === "super_adm" || ["recepcao", "expositor"].includes(row.role))
    .filter((row) => {
      if (!queryText) {
        return true;
      }

      return (
        row.email.toLowerCase().includes(queryText) ||
        row.role.toLowerCase().includes(queryText) ||
        row.status.toLowerCase().includes(queryText)
      );
    });

  const activeCount = rows.filter((row) => row.status === "active").length;
  const inactiveCount = rows.filter((row) => row.status === "inactive").length;

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-xl p-5">
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">Usuários</h1>
        <p className="mt-1 text-sm text-muted">
          Gestão de perfis, senhas temporárias e validade dos acessos.
        </p>
      </div>

      {session.role === "super_adm" ? <CreateUserForm /> : null}

      {notice ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            notice_type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[var(--danger)]"
          }`}
        >
          {notice}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-card rounded-xl p-4">
          <p className="text-xs text-muted">Total de usuários</p>
          <p className="font-headline text-3xl font-extrabold">{rows.length}</p>
        </div>
        <div className="surface-card rounded-xl p-4">
          <p className="text-xs text-muted">Usuários ativos</p>
          <p className="font-headline text-3xl font-extrabold">{activeCount}</p>
        </div>
        <div className="surface-card rounded-xl p-4">
          <p className="text-xs text-muted">Usuários inativos</p>
          <p className="font-headline text-3xl font-extrabold">{inactiveCount}</p>
        </div>
      </div>

      <div className="surface-card rounded-xl p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="font-headline text-xl font-bold text-[var(--foreground)]">Lista de Usuários</h2>
          <Form action="/usuarios" scroll={false} className="flex w-full max-w-md gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por e-mail, role ou status"
              className="w-full rounded-xl border border-[var(--outline-variant)]/50 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            />
            <SubmitButton pendingLabel="Buscando..." className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white">
              Buscar
            </SubmitButton>
          </Form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Último acesso</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {rows.map((row) => (
                <tr key={row.userId}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{row.email}</p>
                    <p className="text-xs text-muted">{row.hasProfile ? row.userId : `${row.userId} • sem perfil salvo`}</p>
                  </td>
                  <td className="px-4 py-3">
                    {session.role === "super_adm" ? (
                    <form action={updateUserProfileAction} className="flex items-center gap-2">
                      <input type="hidden" name="user_id" value={row.userId} />
                      <select
                        name="role"
                        defaultValue={row.role}
                        className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
                      >
                        <option value="super_adm">Super ADM</option>
                        <option value="organizador">Organizador</option>
                        <option value="recepcao">Recepção</option>
                        <option value="expositor">Expositor</option>
                      </select>
                      <select
                        name="status"
                        defaultValue={row.status}
                        className="rounded-lg border border-[var(--outline-variant)]/55 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
                      >
                        <option value="active">Ativo</option>
                        <option value="inactive">Inativo</option>
                      </select>
                      <SubmitButton
                        pendingLabel="Salvando..."
                        className="rounded-lg border border-[var(--outline-variant)]/65 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]"
                      >
                        Salvar
                      </SubmitButton>
                    </form>
                    ) : (
                      <span className="font-semibold">{roleLabel(row.role)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${
                        row.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {row.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                    {row.passwordChangeRequired ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                        Troca de senha pendente
                      </span>
                    ) : null}
                    {row.role === "expositor" && !row.exhibitorAccessActive ? (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                        Vínculo vencido
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <p>{row.lastSignInAt ? formatSaoPauloDateTime(row.lastSignInAt) : "-"}</p>
                    <p className="text-xs text-muted">Criado em {formatSaoPauloDate(row.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    {row.status === "active" && row.userId !== session.userId ? (
                      <EmergencyResetForm userId={row.userId} email={row.email} />
                    ) : (
                      <span className="text-xs text-muted">Sem ação disponível</span>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

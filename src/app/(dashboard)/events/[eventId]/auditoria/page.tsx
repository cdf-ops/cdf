import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type AuditPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    action?: string;
    from?: string;
    to?: string;
  }>;
};

type AuditLogRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  context: Record<string, unknown> | null;
  created_at: string;
};

function inDateRange(value: string, from?: string, to?: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return false;
  }
  if (from) {
    const fromTime = new Date(`${from}T00:00:00`).getTime();
    if (time < fromTime) {
      return false;
    }
  }
  if (to) {
    const toTime = new Date(`${to}T23:59:59`).getTime();
    if (time > toTime) {
      return false;
    }
  }
  return true;
}

export default async function AuditPage({ params, searchParams }: AuditPageProps) {
  await requireSession(["super_adm"]);
  const { eventId } = await params;
  const { action = "", from, to } = await searchParams;
  const admin = createAdminClient();

  const { data: logsData } = await admin
    .from("audit_logs")
    .select("id, actor_user_id, action, context, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  const logs = (logsData ?? []) as AuditLogRow[];

  const filteredLogs = logs.filter((log) => {
    const contextEventId = typeof log.context?.event_id === "string" ? String(log.context.event_id) : null;
    const isEventLog = contextEventId === eventId;
    const isLoginLog = log.action === "AUTH_LOGIN";
    if (!isEventLog && !isLoginLog) {
      return false;
    }
    if (action && log.action !== action) {
      return false;
    }
    if ((from || to) && !inDateRange(log.created_at, from, to)) {
      return false;
    }
    return true;
  });

  const actorIds = [...new Set(filteredLogs.map((log) => log.actor_user_id).filter(Boolean) as string[])];
  const { data: usersResponse } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const userEmailMap = new Map(
    (usersResponse?.users ?? [])
      .filter((user) => actorIds.includes(user.id))
      .map((user) => [user.id, user.email ?? "sem-email"])
  );

  const actionsAvailable = [...new Set(filteredLogs.map((log) => log.action))].sort();
  const exportHref = `/events/${eventId}/auditoria/export?action=${encodeURIComponent(action)}&from=${encodeURIComponent(
    from ?? ""
  )}&to=${encodeURIComponent(to ?? "")}`;

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)]">Auditoria</h2>
            <p className="mt-1 text-sm text-muted">Ações críticas do sistema (login, check-ins, sorteio e edições de evento).</p>
          </div>
          <Link
            href={exportHref}
            className="rounded-xl border border-[var(--outline-variant)]/65 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--foreground)]"
          >
            Exportar CSV
          </Link>
        </div>

        <form className="mt-4 grid gap-3 md:grid-cols-4">
          <select
            name="action"
            defaultValue={action}
            className="rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="">Todas as ações</option>
            {actionsAvailable.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            name="from"
            type="date"
            defaultValue={from}
            className="rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <input
            name="to"
            type="date"
            defaultValue={to}
            className="rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <button className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white">Aplicar filtros</button>
        </form>
      </div>

      <div className="surface-card overflow-hidden rounded-xl">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
            <tr>
              <th className="px-4 py-3">Data / Hora</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Contexto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-container)]">
            {filteredLogs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-3">{new Date(log.created_at).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">{log.actor_user_id ? userEmailMap.get(log.actor_user_id) ?? log.actor_user_id : "sistema"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-[var(--surface-container-low)] px-2 py-1 text-xs font-semibold">{log.action}</span>
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs text-muted">{JSON.stringify(log.context ?? {})}</code>
                </td>
              </tr>
            ))}
            {!filteredLogs.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">
                  Nenhum log encontrado com os filtros atuais.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}


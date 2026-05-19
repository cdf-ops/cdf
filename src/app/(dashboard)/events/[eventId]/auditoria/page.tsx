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

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    AUTH_LOGIN: "Login efetuado",
    ENTRY_CHECKIN_CREATED: "Check-in realizado",
    STAND_CHECKIN_CREATED: "Stand registrado",
    RAFFLE_EXECUTED: "Sorteio executado",
    RAFFLE_DELETED: "Sorteio removido",
    CERTIFICATE_ISSUED: "Certificado emitido",
  };

  return labels[action] ?? action.replaceAll("_", " ").toLowerCase();
}

function actionTone(action: string) {
  if (action.includes("DELETED") || action.includes("REMOVED")) {
    return "bg-red-100 text-red-700";
  }
  if (action.includes("RAFFLE") || action.includes("CERTIFICATE")) {
    return "bg-blue-100 text-blue-700";
  }
  if (action.includes("CHECKIN") || action.includes("LOGIN")) {
    return "bg-emerald-100 text-emerald-700";
  }

  return "bg-[var(--surface-container-low)] text-[var(--foreground)]";
}

function contextTag(context: Record<string, unknown> | null) {
  if (!context) {
    return "-";
  }

  const candidates = [
    context.origin,
    context.module,
    context.screen,
    context.event_day_id,
    context.event_id,
  ].filter(Boolean);

  if (!candidates.length) {
    return "-";
  }

  return String(candidates[0]);
}

function detailsText(context: Record<string, unknown> | null) {
  if (!context) {
    return "-";
  }

  const knownKeys = ["participant_id", "raffle_id", "certificate_id", "event_day_id", "event_id"] as const;
  for (const key of knownKeys) {
    const value = context[key];
    if (value) {
      return `${key}: ${String(value)}`;
    }
  }

  const raw = JSON.stringify(context);
  return raw.length > 80 ? `${raw.slice(0, 80)}...` : raw;
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

  const scopedLogs = logs.filter((log) => {
    const contextEventId = typeof log.context?.event_id === "string" ? String(log.context.event_id) : null;
    const isEventLog = contextEventId === eventId;
    const isLoginLog = log.action === "AUTH_LOGIN";
    return isEventLog || isLoginLog;
  });

  const filteredLogs = scopedLogs.filter((log) => {
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

  const actionsAvailable = [...new Set(scopedLogs.map((log) => log.action))].sort();
  const exportHref = `/events/${eventId}/auditoria/export?action=${encodeURIComponent(action)}&from=${encodeURIComponent(
    from ?? ""
  )}&to=${encodeURIComponent(to ?? "")}`;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-headline text-5xl font-extrabold tracking-tight text-[var(--foreground)]">Auditoria de Sistema</h2>
          <span className="rounded bg-[var(--primary-soft)]/45 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--primary)]">
            Live Logs
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--outline)]">
          <span>{filteredLogs.length} registros</span>
        </div>
      </div>

      <form className="shell-card grid gap-3 rounded-xl p-4 md:grid-cols-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Filtrar por Ação</label>
          <select
            name="action"
            defaultValue={action}
            className="input-surface mt-1 w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/10"
          >
            <option value="">Todas as ações</option>
            {actionsAvailable.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Período (de)</label>
          <input
            name="from"
            type="date"
            defaultValue={from}
            className="input-surface mt-1 w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/10"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Período (até)</label>
          <input
            name="to"
            type="date"
            defaultValue={to}
            className="input-surface mt-1 w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/10"
          />
        </div>

        <div className="flex items-end gap-2">
          <button className="gradient-primary w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white">Aplicar Filtros</button>
        </div>
      </form>

      <div className="surface-card overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-container-high)] px-4 py-3">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--outline)]">Logs de Atividade Recentes</h3>
          <div className="flex items-center gap-4">
            <Link href={exportHref} className="text-sm font-semibold text-[var(--primary)]">
              Exportar CSV
            </Link>
            <Link href={`/events/${eventId}/auditoria`} className="text-sm font-semibold text-[var(--outline)]">
              Limpar Filtros
            </Link>
          </div>
        </div>

        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--surface-container-low)] text-xs uppercase tracking-wide text-[var(--outline)]">
            <tr>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Data / Hora</th>
              <th className="px-4 py-3">Contexto</th>
              <th className="px-4 py-3">Detalhes</th>
              <th className="px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-container)]">
            {filteredLogs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${actionTone(log.action)}`}>{actionLabel(log.action)}</span>
                </td>
                <td className="px-4 py-3">
                  {log.actor_user_id ? userEmailMap.get(log.actor_user_id) ?? log.actor_user_id : "sistema"}
                </td>
                <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{new Date(log.created_at).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-[var(--surface-container-low)] px-2 py-1 text-xs font-semibold">{contextTag(log.context)}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted">{detailsText(log.context)}</td>
                <td className="px-4 py-3 text-center text-[var(--outline)]">o</td>
              </tr>
            ))}
            {!filteredLogs.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted">
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

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }
  return value;
}

export async function GET(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Não autenticado", { status: 401 });
  }

  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "super_adm") {
    return new NextResponse("Sem permissão", { status: 403 });
  }

  const { eventId } = await context.params;
  const url = new URL(request.url);
  const action = (url.searchParams.get("action") ?? "").trim();
  const from = (url.searchParams.get("from") ?? "").trim() || undefined;
  const to = (url.searchParams.get("to") ?? "").trim() || undefined;

  const admin = createAdminClient();
  const { data: logsData } = await admin
    .from("audit_logs")
    .select("id, actor_user_id, action, context, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
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
      .filter((account) => actorIds.includes(account.id))
      .map((account) => [account.id, account.email ?? "sem-email"])
  );

  const lines = [
    ["created_at", "actor", "action", "context"].join(","),
    ...filteredLogs.map((log) =>
      [
        escapeCsv(new Date(log.created_at).toISOString()),
        escapeCsv(log.actor_user_id ? userEmailMap.get(log.actor_user_id) ?? log.actor_user_id : "sistema"),
        escapeCsv(log.action),
        escapeCsv(JSON.stringify(log.context ?? {})),
      ].join(",")
    ),
  ];
  const csv = lines.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria_${eventId}.csv"`,
    },
  });
}


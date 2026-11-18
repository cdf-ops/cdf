import { NextResponse } from "next/server";
import { getReportExportData, type ExportReportTab } from "@/lib/reports/report-export-data";
import { createCsv, createXlsx } from "@/lib/reports/tabular-export";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REPORT_TABS = new Set<ExportReportTab>([
  "resumo-inscricoes",
  "lista-inscritos",
  "presenca-dia",
  "presenca-total",
  "presentes",
  "sorteados",
]);

function reportTab(value: string | null): ExportReportTab {
  return REPORT_TABS.has(value as ExportReportTab) ? value as ExportReportTab : "resumo-inscricoes";
}

export async function GET(request: Request, context: RouteContext<"/api/reports/events/[eventId]/export">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles").select("role, status").eq("id", user.id).maybeSingle();
  if (profile?.role !== "super_adm" || profile.status !== "active") {
    return new NextResponse("Sem permissão para exportar relatórios", { status: 403 });
  }

  const { eventId } = await context.params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const statusValue = url.searchParams.get("status");
  const kindValue = url.searchParams.get("kind");
  const attendanceValue = url.searchParams.get("attendance");
  const exportData = await getReportExportData(eventId, {
    tab: reportTab(url.searchParams.get("report")),
    day: url.searchParams.get("day") || "all",
    q: (url.searchParams.get("q") ?? "").trim(),
    status: statusValue === "cancelled" || statusValue === "all" ? statusValue : "active",
    kind: kindValue === "expected" || kindValue === "onsite" ? kindValue : "all",
    attendance: attendanceValue === "absent" || attendanceValue === "all" ? attendanceValue : "present",
  });
  if (!exportData) return new NextResponse("Evento não encontrado", { status: 404 });

  const body = format === "xlsx" ? createXlsx(exportData) : createCsv(exportData);
  const extension = format === "xlsx" ? "xlsx" : "csv";
  const contentType = format === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv; charset=utf-8";
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${exportData.filename}.${extension}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

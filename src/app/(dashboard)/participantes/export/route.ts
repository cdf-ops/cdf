import { NextResponse } from "next/server";
import { parseParticipantFilters, participantRpcArgs } from "@/lib/participants/filters";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const EXPORT_PAGE_SIZE = 1000;

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }
  return value;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Não autenticado", { status: 401 });
  }

  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["super_adm", "organizador"].includes(profile.role)) {
    return new NextResponse("Sem permissão", { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseParticipantFilters({
    q: url.searchParams.get("q") ?? undefined,
    event: url.searchParams.get("event") ?? undefined,
    city: url.searchParams.get("city") ?? undefined,
    profession: url.searchParams.get("profession") ?? undefined,
    last_checkin_from: url.searchParams.get("last_checkin_from") ?? undefined,
    last_checkin_to: url.searchParams.get("last_checkin_to") ?? undefined,
  });
  const admin = createAdminClient();
  const participants = [];
  let offset = 0;
  let totalCount = 0;

  do {
    const { data, error } = await admin.rpc("list_global_participants", participantRpcArgs(filters, EXPORT_PAGE_SIZE, offset));
    if (error) {
      console.error("participantsExport.listError", error);
      return new NextResponse("Não foi possível exportar os participantes.", { status: 500 });
    }

    const rows = data ?? [];
    participants.push(...rows);
    totalCount = rows[0]?.total_count ?? participants.length;
    offset += rows.length;
  } while (offset < totalCount && offset > 0);

  const lines = [
    [
      "nome",
      "tipo_documento",
      "documento",
      "email",
      "telefone",
      "estado",
      "cidade",
      "profissao",
      "eventos_cadastrados",
      "checkins_entrada",
      "ultimo_checkin",
      "dias_desde_ultimo_checkin",
    ].join(","),
    ...participants.map((participant) => {
      const lastCheckin = participant.last_checkin_at ? new Date(participant.last_checkin_at) : null;
      const daysSinceLastCheckin = lastCheckin
        ? String(Math.max(0, Math.floor((Date.now() - lastCheckin.getTime()) / 86_400_000)))
        : "";
      return [
        participant.full_name,
        participant.document_type,
        participant.document_number,
        participant.email,
        participant.phone,
        participant.state,
        participant.city,
        participant.profession,
        String(participant.event_count),
        String(participant.entry_checkin_count),
        lastCheckin?.toISOString() ?? "",
        daysSinceLastCheckin,
      ]
        .map(escapeCsv)
        .join(",");
    }),
  ];

  return new NextResponse(`\uFEFF${lines.join("\n")}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="participantes.csv"',
    },
  });
}

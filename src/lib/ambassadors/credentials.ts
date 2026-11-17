import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export function ambassadorCode(ambassadorNumber: number) {
  return `EMB-${String(ambassadorNumber).padStart(6, "0")}`;
}

export async function loadAmbassadorCredentialPdfData(
  admin: SupabaseClient<Database>,
  input: { eventId: string; ambassadorIds: string[] }
) {
  const ambassadorIds = [...new Set(input.ambassadorIds)];
  if (!ambassadorIds.length) throw new Error("Selecione ao menos um embaixador ativo.");

  const [{ data: event }, { data: days }, { data: ambassadors }, { data: settings }] = await Promise.all([
    admin
      .from("events")
      .select("id, name, location, details, event_logo_path, status")
      .eq("id", input.eventId)
      .maybeSingle(),
    admin.from("event_days").select("date").eq("event_id", input.eventId).order("date"),
    admin
      .from("event_ambassadors")
      .select("id, ambassador_number, full_name, qr_slug, status")
      .eq("event_id", input.eventId)
      .in("id", ambassadorIds),
    admin.from("event_badge_settings").select("*").eq("event_id", input.eventId).maybeSingle(),
  ]);

  if (!event || event.status === "arquivado") throw new Error("Evento indisponível para impressão.");
  const eventDates = (days ?? []).map((day) => day.date).sort();
  if (!eventDates.length) throw new Error("O evento não possui datas cadastradas.");
  if ((ambassadors ?? []).length !== ambassadorIds.length || (ambassadors ?? []).some((item) => item.status !== "active")) {
    throw new Error("A seleção contém um embaixador inativo ou de outro evento.");
  }

  return {
    event: {
      id: event.id,
      name: event.name,
      location: event.location,
      details: event.details,
      eventLogoPath: event.event_logo_path,
      dates: eventDates,
    },
    participants: (ambassadors ?? [])
      .sort((left, right) => left.full_name.localeCompare(right.full_name, "pt-BR"))
      .map((ambassador) => ({
        id: ambassador.id,
        fullName: ambassador.full_name,
        participantNumber: ambassadorCode(ambassador.ambassador_number),
        qrSlug: ambassador.qr_slug,
        categoryLabel: "EMBAIXADOR",
      })),
    settings,
  };
}

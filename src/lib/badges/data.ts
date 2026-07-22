import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { ensureParticipantBadge } from "@/lib/badges/tokens";

export async function loadEventBadgePdfData(
  admin: SupabaseClient<Database>,
  eventId: string,
  requestedParticipantIds?: string[],
  generatedBy?: string | null
) {
  const { data: event } = await admin
    .from("events")
    .select("id, name, location, details, event_logo_path")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) throw new Error("Evento não encontrado.");

  const { data: daysData } = await admin
    .from("event_days")
    .select("id, date")
    .eq("event_id", eventId)
    .order("date", { ascending: true });
  const days = daysData ?? [];
  if (!days.length) throw new Error("Evento sem datas configuradas.");

  const { data: registrationsData } = await admin
    .from("event_registrations")
    .select("participant_id")
    .in("event_day_id", days.map((day) => day.id));
  const registeredIds = [...new Set((registrationsData ?? []).map((registration) => registration.participant_id))];
  const requested = requestedParticipantIds?.length ? [...new Set(requestedParticipantIds)] : registeredIds;
  const participantIds = requested.filter((id) => registeredIds.includes(id));
  if (!participantIds.length) throw new Error("Nenhum participante selecionado para a credencial.");

  const { data: participantsData } = await admin
    .from("participants")
    .select("id, full_name, participant_number")
    .in("id", participantIds);
  const participants = participantsData ?? [];

  const badges = await Promise.all(
    participants.map((participant) =>
      ensureParticipantBadge(admin, {
        eventId,
        participantId: participant.id,
        generatedBy,
      })
    )
  );
  const badgeByParticipant = new Map(participants.map((participant, index) => [participant.id, badges[index]]));

  const { data: settings } = await admin.from("event_badge_settings").select("*").eq("event_id", eventId).maybeSingle();

  return {
    event: {
      id: event.id,
      name: event.name,
      location: event.location,
      details: event.details,
      eventLogoPath: event.event_logo_path,
      dates: days.map((day) => day.date),
    },
    participants: participants
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"))
      .map((participant) => ({
        id: participant.id,
        fullName: participant.full_name,
        participantNumber: participant.participant_number,
        qrSlug: badgeByParticipant.get(participant.id)?.qr_slug ?? "",
      })),
    settings,
  };
}

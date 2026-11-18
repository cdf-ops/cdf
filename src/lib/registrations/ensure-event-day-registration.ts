import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function ensureEventDayRegistration(
  admin: AdminClient,
  participantId: string,
  eventDayId: string
) {
  const { data: existingRegistration, error: lookupError } = await admin
    .from("event_registrations")
    .select("id, status")
    .eq("participant_id", participantId)
    .eq("event_day_id", eventDayId)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existingRegistration?.status === "active") return false;
  if (existingRegistration?.status === "cancelled") {
    const { error: reactivateError } = await admin
      .from("event_registrations")
      .update({
        status: "active",
        cancelled_at: null,
        cancelled_by: null,
        created_at: new Date().toISOString(),
        registration_source: "reception",
      })
      .eq("id", existingRegistration.id);

    if (reactivateError) throw reactivateError;
    return true;
  }

  const { error: insertError } = await admin.from("event_registrations").insert({
    participant_id: participantId,
    event_day_id: eventDayId,
    registration_source: "reception",
  });

  if (insertError?.code === "23505") return false;
  if (insertError) throw insertError;
  return true;
}

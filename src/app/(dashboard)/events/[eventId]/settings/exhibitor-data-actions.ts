"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const settingsSchema = z.object({
  eventId: z.string().uuid(),
});

export async function updateExhibitorDataSettingsAction(formData: FormData) {
  const session = await requireSession(["super_adm"]);
  const parsed = settingsSchema.safeParse({ eventId: formData.get("event_id") });
  if (!parsed.success) {
    redirect("/events?notice_type=error&notice=Evento%20inv%C3%A1lido.");
  }

  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id").eq("id", parsed.data.eventId).maybeSingle();
  if (!event) {
    redirect("/events?notice_type=error&notice=Evento%20n%C3%A3o%20encontrado.");
  }

  const settings = {
    event_id: event.id,
    share_email: formData.get("share_email") === "on",
    share_phone: formData.get("share_phone") === "on",
    share_profession: formData.get("share_profession") === "on",
    share_city: formData.get("share_city") === "on",
    share_state: formData.get("share_state") === "on",
    updated_by: session.userId,
  };
  const { error } = await admin
    .from("event_exhibitor_data_settings")
    .upsert(settings, { onConflict: "event_id" });

  if (error) {
    redirect(
      `/events/${event.id}/settings?notice_type=error&notice=${encodeURIComponent(
        "Não foi possível salvar as permissões dos expositores."
      )}`
    );
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EXHIBITOR_DATA_SETTINGS_UPDATED",
    context: settings,
  });

  redirect(
    `/events/${event.id}/settings?notice_type=success&notice=${encodeURIComponent(
      "Permissões dos expositores atualizadas."
    )}`
  );
}

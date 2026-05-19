"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadEventImage } from "@/lib/certificates/assets";
import { parseCertificateLayout } from "@/lib/certificates/layout";

const saveCertificateSettingsSchema = z.object({
  eventId: z.string().uuid(),
  layoutJson: z.string().min(1),
});

function getOptionalImageFile(formData: FormData, fieldName: string) {
  const file = formData.get(fieldName);
  return file instanceof File && file.size > 0 ? file : null;
}

export async function saveCertificateSettingsAction(formData: FormData) {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = saveCertificateSettingsSchema.safeParse({
    eventId: formData.get("event_id"),
    layoutJson: formData.get("layout_json"),
  });

  if (!parsed.success) {
    redirect("/events");
  }

  const admin = createAdminClient();
  const layout = parseCertificateLayout(parsed.data.layoutJson);
  const backgroundFile = getOptionalImageFile(formData, "certificate_background");
  const sponsorFile = getOptionalImageFile(formData, "certificate_sponsor");

  const { data: current } = await admin
    .from("event_certificate_settings")
    .select("background_path, sponsor_image_path")
    .eq("event_id", parsed.data.eventId)
    .maybeSingle();

  const backgroundPath = backgroundFile
    ? await uploadEventImage(admin, parsed.data.eventId, backgroundFile, "certificate-background")
    : current?.background_path ?? null;
  const sponsorImagePath = sponsorFile
    ? await uploadEventImage(admin, parsed.data.eventId, sponsorFile, "certificate-sponsor")
    : current?.sponsor_image_path ?? null;

  const { error } = await admin.from("event_certificate_settings").upsert({
    event_id: parsed.data.eventId,
    background_path: backgroundPath,
    sponsor_image_path: sponsorImagePath,
    layout,
    updated_by: session.userId,
  });

  if (error) {
    throw new Error("Não foi possível salvar a configuração do certificado.");
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "CERTIFICATE_SETTINGS_UPDATED",
    context: {
      event_id: parsed.data.eventId,
      has_background: Boolean(backgroundPath),
      has_sponsor_image: Boolean(sponsorImagePath),
    },
  });

  revalidatePath(`/events/${parsed.data.eventId}/certificate-settings`);
}

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { extractCredentialSlug } from "@/lib/badges/tokens";
import {
  discloseParticipantData,
  getExhibitorDataSettings,
} from "@/lib/exhibitors/data-sharing";
import { createAdminClient } from "@/lib/supabase/admin";

const requestSchema = z.object({
  eventDayId: z.string().uuid(),
  qrValue: z.string().trim().min(1).max(500),
});

export async function POST(
  request: Request,
  context: RouteContext<"/api/events/[eventId]/stand-badge-checkin">
) {
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "Faça login como expositor." }, { status: 401 });
  if (session.role !== "expositor") {
    return Response.json({ error: "Seu usuário não possui perfil de expositor." }, { status: 403 });
  }

  const { eventId } = await context.params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "QR Code ou data inválida." }, { status: 400 });

  const qrSlug = extractCredentialSlug(parsed.data.qrValue);
  if (!qrSlug) {
    return Response.json({ error: "Este QR Code não é uma credencial do Clube do Frio." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: eventDay }, { data: badge }, { data: userLinks }] = await Promise.all([
    admin
      .from("event_days")
      .select("id")
      .eq("id", parsed.data.eventDayId)
      .eq("event_id", eventId)
      .maybeSingle(),
    admin
      .from("badges")
      .select("participant_id")
      .eq("event_id", eventId)
      .eq("qr_slug", qrSlug)
      .maybeSingle(),
    admin
      .from("exhibitor_users")
      .select("exhibitor_company_id")
      .eq("user_id", session.userId),
  ]);
  if (!eventDay) return Response.json({ error: "O dia selecionado não pertence a este evento." }, { status: 400 });
  if (!badge) return Response.json({ error: "Credencial não encontrada para este evento." }, { status: 404 });

  const companyIds = [...new Set((userLinks ?? []).map((item) => item.exhibitor_company_id))];
  const { data: eventExhibitor } =
    companyIds.length > 0
      ? await admin
          .from("event_exhibitors")
          .select("id")
          .eq("event_id", eventId)
          .in("exhibitor_company_id", companyIds)
          .maybeSingle()
      : { data: null };
  if (!eventExhibitor) {
    return Response.json({ error: "Sua empresa não está vinculada a este evento." }, { status: 403 });
  }

  const [{ data: participant }, { data: consent }, { data: entryCheckin }, settings] =
    await Promise.all([
      admin
        .from("participants")
        .select("participant_number, full_name, email, phone, profession, city, state")
        .eq("id", badge.participant_id)
        .maybeSingle(),
      admin
        .from("participant_event_consents")
        .select("exhibitor_data_sharing")
        .eq("event_id", eventId)
        .eq("participant_id", badge.participant_id)
        .maybeSingle(),
      admin
        .from("entry_checkins")
        .select("id")
        .eq("participant_id", badge.participant_id)
        .eq("event_day_id", eventDay.id)
        .is("deleted_at", null)
        .maybeSingle(),
      getExhibitorDataSettings(admin, eventId),
    ]);
  if (!participant) return Response.json({ error: "Participante não encontrado." }, { status: 404 });
  if (!entryCheckin) {
    return Response.json(
      { error: "Este visitante ainda não realizou o check-in na recepção neste dia." },
      { status: 409 }
    );
  }

  const additionalDataConsentGranted = consent?.exhibitor_data_sharing === true;
  const sharedParticipant = discloseParticipantData(
    participant,
    settings,
    additionalDataConsentGranted
  );
  const { data: existing } = await admin
    .from("stand_checkins")
    .select("checked_in_at")
    .eq("participant_id", badge.participant_id)
    .eq("event_day_id", eventDay.id)
    .eq("event_exhibitor_id", eventExhibitor.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) {
    return Response.json({
      status: "already_checked_in",
      participant: sharedParticipant,
      additionalDataConsentGranted,
      checkedInAt: existing.checked_in_at,
      message: additionalDataConsentGranted
        ? `${sharedParticipant.full_name} já foi registrado neste stand hoje.`
        : `${sharedParticipant.full_name} já foi registrado neste stand hoje. Dados adicionais não autorizados.`,
    });
  }

  const checkedInAt = new Date().toISOString();
  const { error } = await admin.from("stand_checkins").insert({
    participant_id: badge.participant_id,
    event_day_id: eventDay.id,
    event_exhibitor_id: eventExhibitor.id,
    operator_user_id: session.userId,
    checked_in_at: checkedInAt,
  });
  if (error && error.code !== "23505") {
    return Response.json({ error: "Não foi possível registrar a visita ao stand." }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "STAND_CHECKIN_CREATED_BY_BADGE",
    context: {
      event_id: eventId,
      event_day_id: eventDay.id,
      participant_id: badge.participant_id,
      event_exhibitor_id: eventExhibitor.id,
      additional_data_consent_granted: additionalDataConsentGranted,
    },
  });

  return Response.json({
    status: error?.code === "23505" ? "already_checked_in" : "checked_in",
    participant: sharedParticipant,
    additionalDataConsentGranted,
    checkedInAt,
    message: additionalDataConsentGranted
      ? `Visita de ${sharedParticipant.full_name} registrada com sucesso.`
      : `Visita de ${sharedParticipant.full_name} registrada. Dados adicionais não autorizados.`,
  });
}

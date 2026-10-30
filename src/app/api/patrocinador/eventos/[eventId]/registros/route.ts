import { z } from "zod";
import { extractCredentialSlug } from "@/lib/badges/tokens";
import { getSaoPauloDateKey } from "@/lib/date-time";
import {
  discloseSponsorParticipantData,
  getSponsorDataSettings,
} from "@/lib/sponsors/data-sharing";
import { getSponsorSession } from "@/lib/sponsors/session";
import { createAdminClient } from "@/lib/supabase/admin";

const requestSchema = z.object({
  qrValue: z.string().trim().min(1).max(500),
  capturedAt: z.string().datetime(),
  clientCaptureId: z.string().uuid(),
  queuedOffline: z.boolean().default(false),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const session = await getSponsorSession();
  if (!session) {
    return Response.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Os dados da leitura são inválidos." }, { status: 400 });
  }

  const qrSlug = extractCredentialSlug(parsed.data.qrValue);
  if (!qrSlug) {
    return Response.json(
      { error: "Este QR Code não é uma credencial do Clube do Frio." },
      { status: 400 }
    );
  }

  const capturedAt = new Date(parsed.data.capturedAt);
  if (capturedAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return Response.json({ error: "A data da leitura está no futuro." }, { status: 400 });
  }
  if (Date.now() - capturedAt.getTime() > 72 * 60 * 60 * 1000) {
    return Response.json(
      { error: "Esta leitura offline expirou. Faça uma nova leitura com conexão." },
      { status: 409 }
    );
  }

  const { eventId } = await context.params;
  const captureDate = getSaoPauloDateKey(capturedAt);
  const admin = createAdminClient();
  const [{ data: event }, { data: eventDay }, { data: badge }] = await Promise.all([
    admin.from("events").select("id, name, status").eq("id", eventId).maybeSingle(),
    admin
      .from("event_days")
      .select("id")
      .eq("event_id", eventId)
      .eq("date", captureDate)
      .maybeSingle(),
    admin
      .from("badges")
      .select("participant_id, event_id")
      .eq("qr_slug", qrSlug)
      .maybeSingle(),
  ]);

  if (!event || event.status !== "ativo") {
    return Response.json({ error: "Este evento não está disponível para leitura." }, { status: 404 });
  }
  if (!eventDay) {
    return Response.json(
      { error: "A leitura foi feita fora de uma data deste evento." },
      { status: 409 }
    );
  }
  if (!badge) {
    return Response.json({ error: "Credencial de participante não encontrada." }, { status: 404 });
  }
  if (badge.event_id !== eventId) {
    return Response.json(
      { error: "Esta credencial pertence a outro evento." },
      { status: 409 }
    );
  }

  const [{ data: participant }, settings, { data: existingByClient }, { data: existingByParticipant }] =
    await Promise.all([
      admin
        .from("participants")
        .select("full_name, email, phone, company, profession, job_title, city, state")
        .eq("id", badge.participant_id)
        .maybeSingle(),
      getSponsorDataSettings(admin, eventId),
      admin
        .from("sponsor_participant_records")
        .select("id, captured_at")
        .eq("sponsor_id", session.sponsorId)
        .eq("client_capture_id", parsed.data.clientCaptureId)
        .maybeSingle(),
      admin
        .from("sponsor_participant_records")
        .select("id, captured_at")
        .eq("sponsor_id", session.sponsorId)
        .eq("event_id", eventId)
        .eq("participant_id", badge.participant_id)
        .is("invalidated_at", null)
        .maybeSingle(),
    ]);

  if (!participant) {
    return Response.json({ error: "Participante não encontrado." }, { status: 404 });
  }

  const sharedParticipant = discloseSponsorParticipantData(participant, settings);
  const existing = existingByClient ?? existingByParticipant;
  if (existing) {
    return Response.json({
      status: "already_registered",
      participant: sharedParticipant,
      capturedAt: existing.captured_at,
      message: `${participant.full_name} já está nos registros deste evento.`,
    });
  }

  const { error } = await admin.from("sponsor_participant_records").insert({
    sponsor_id: session.sponsorId,
    event_id: eventId,
    participant_id: badge.participant_id,
    captured_at: capturedAt.toISOString(),
    source: parsed.data.queuedOffline ? "offline_badge_qr" : "badge_qr",
    client_capture_id: parsed.data.clientCaptureId,
  });

  if (error && error.code !== "23505") {
    return Response.json({ error: "Não foi possível salvar o registro." }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    actor_user_id: null,
    action: error?.code === "23505" ? "SPONSOR_PARTICIPANT_DUPLICATE" : "SPONSOR_PARTICIPANT_CAPTURED",
    context: {
      sponsor_id: session.sponsorId,
      sponsor_session_id: session.sessionId,
      event_id: eventId,
      participant_id: badge.participant_id,
      client_capture_id: parsed.data.clientCaptureId,
      queued_offline: parsed.data.queuedOffline,
    },
  });

  return Response.json({
    status: error?.code === "23505" ? "already_registered" : "registered",
    participant: sharedParticipant,
    capturedAt: capturedAt.toISOString(),
    message:
      error?.code === "23505"
        ? `${participant.full_name} já está nos registros deste evento.`
        : `${participant.full_name} registrado com sucesso.`,
  });
}

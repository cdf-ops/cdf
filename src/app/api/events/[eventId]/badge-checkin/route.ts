import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { extractCredentialSlug } from "@/lib/badges/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchConfiguredWebhook } from "@/lib/webhooks/dispatch";

const requestSchema = z.object({
  eventDayId: z.string().uuid(),
  qrValue: z.string().trim().min(1).max(500),
});

export async function POST(request: Request, context: RouteContext<"/api/events/[eventId]/badge-checkin">) {
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "Faça login para realizar check-in." }, { status: 401 });
  if (!(["super_adm", "organizador", "recepcao"] as string[]).includes(session.role)) {
    return Response.json({ error: "Seu usuário não possui permissão de recepção." }, { status: 403 });
  }

  const { eventId } = await context.params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "QR Code ou data inválida." }, { status: 400 });
  const qrSlug = extractCredentialSlug(parsed.data.qrValue);
  if (!qrSlug) return Response.json({ error: "Este QR Code não é uma credencial do Clube do Frio." }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: eventDay }, { data: badge }] = await Promise.all([
    admin.from("event_days").select("id, date").eq("id", parsed.data.eventDayId).eq("event_id", eventId).maybeSingle(),
    admin.from("badges").select("id, participant_id").eq("event_id", eventId).eq("qr_slug", qrSlug).maybeSingle(),
  ]);
  if (!eventDay) return Response.json({ error: "O dia selecionado não pertence a este evento." }, { status: 400 });
  if (!badge) return Response.json({ error: "Credencial não encontrada para este evento." }, { status: 404 });

  const { data: participant } = await admin
    .from("participants")
    .select("full_name, participant_number, email")
    .eq("id", badge.participant_id)
    .maybeSingle();
  if (!participant) return Response.json({ error: "Participante não encontrado." }, { status: 404 });

  const { data: existing } = await admin
    .from("entry_checkins")
    .select("checked_in_at")
    .eq("participant_id", badge.participant_id)
    .eq("event_day_id", eventDay.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) {
    return Response.json({
      status: "already_checked_in",
      participant,
      checkedInAt: existing.checked_in_at,
      message: `${participant.full_name} já realizou check-in neste dia.`,
    });
  }

  const checkedInAt = new Date().toISOString();
  const { error: insertError } = await admin.from("entry_checkins").insert({
    participant_id: badge.participant_id,
    event_day_id: eventDay.id,
    operator_user_id: session.userId,
    origin: "badge_qr",
    checked_in_at: checkedInAt,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      return Response.json({
        status: "already_checked_in",
        participant,
        checkedInAt,
        message: `${participant.full_name} já realizou check-in neste dia.`,
      });
    }
    return Response.json({ error: "Não foi possível registrar o check-in." }, { status: 500 });
  }

  await Promise.allSettled([
    admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "ENTRY_CHECKIN_CREATED_BY_BADGE",
      context: {
        event_id: eventId,
        event_day_id: eventDay.id,
        participant_id: badge.participant_id,
        participant_number: participant.participant_number,
      },
    }),
    dispatchConfiguredWebhook(admin, {
      eventType: "checkin.completed",
      payload: {
        event_id: eventId,
        event_day_id: eventDay.id,
        event_date: eventDay.date,
        participant_id: badge.participant_id,
        participant_number: participant.participant_number,
        participant_name: participant.full_name,
        participant_email: participant.email,
        checked_in_at: checkedInAt,
      },
    }),
  ]);

  return Response.json({
    status: "checked_in",
    participant,
    checkedInAt,
    message: `Check-in de ${participant.full_name} realizado com sucesso.`,
  });
}

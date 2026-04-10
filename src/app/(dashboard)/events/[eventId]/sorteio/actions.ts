"use server";

import { randomInt } from "crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const executeRaffleSchema = z.object({
  eventId: z.string().uuid(),
  eventDayId: z.string().uuid(),
  prizeDescription: z.string().trim().min(3),
  winnersCount: z.coerce.number().int().positive().max(100),
  redirectUrl: z.string().min(1),
});

const deleteRaffleSchema = z.object({
  raffleId: z.string().uuid(),
  eventId: z.string().uuid(),
  redirectUrl: z.string().min(1),
});

function withNotice(url: string, type: "success" | "error", message: string) {
  const safeUrl = url.startsWith("/events/") ? url : "/events";
  const separator = safeUrl.includes("?") ? "&" : "?";
  return `${safeUrl}${separator}notice_type=${type}&notice=${encodeURIComponent(message)}`;
}

function pickRandomUnique<T>(items: T[], count: number) {
  const pool = [...items];
  const winners: T[] = [];
  const limit = Math.min(count, pool.length);
  for (let i = 0; i < limit; i += 1) {
    const idx = randomInt(0, pool.length);
    winners.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return winners;
}

export async function executeRaffleAction(formData: FormData) {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = executeRaffleSchema.safeParse({
    eventId: formData.get("event_id"),
    eventDayId: formData.get("event_day_id"),
    prizeDescription: formData.get("prize_description"),
    winnersCount: formData.get("winners_count"),
    redirectUrl: formData.get("redirect_url"),
  });

  if (!parsed.success) {
    redirect(withNotice(`/events/${String(formData.get("event_id") ?? "")}/sorteio`, "error", "Dados inválidos para sorteio."));
  }

  const admin = createAdminClient();
  const { data: eventDay } = await admin
    .from("event_days")
    .select("id")
    .eq("id", parsed.data.eventDayId)
    .eq("event_id", parsed.data.eventId)
    .maybeSingle();
  if (!eventDay) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Dia de evento inválido."));
  }

  const { data: existingRaffle } = await admin
    .from("raffles")
    .select("id, executed_at")
    .eq("event_day_id", parsed.data.eventDayId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingRaffle?.executed_at) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Este dia já possui sorteio executado. Apenas Super-ADM pode excluir."));
  }

  const { data: entryCheckins } = await admin
    .from("entry_checkins")
    .select("participant_id")
    .eq("event_day_id", parsed.data.eventDayId)
    .is("deleted_at", null);
  const eligibleParticipantIds = [...new Set((entryCheckins ?? []).map((item) => item.participant_id))];

  if (!eligibleParticipantIds.length) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Sem participantes elegíveis no dia selecionado."));
  }

  const { data: previousRaffles } = await admin
    .from("raffles")
    .select("id")
    .eq("event_day_id", parsed.data.eventDayId)
    .is("deleted_at", null);
  const previousWinnerIds = new Set<string>();
  const raffleIds = (previousRaffles ?? []).map((raffle) => raffle.id);
  if (raffleIds.length > 0) {
    const { data: existingWinners } = await admin
      .from("raffle_winners")
      .select("participant_id")
      .in("raffle_id", raffleIds);
    (existingWinners ?? []).forEach((winner) => previousWinnerIds.add(winner.participant_id));
  }

  const availableForDraw = eligibleParticipantIds.filter((id) => !previousWinnerIds.has(id));
  if (!availableForDraw.length) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Não há participantes disponíveis para sorteio neste dia."));
  }

  const winners = pickRandomUnique(availableForDraw, parsed.data.winnersCount);
  const { data: raffle, error: raffleError } = await admin
    .from("raffles")
    .insert({
      event_day_id: parsed.data.eventDayId,
      prize_description: parsed.data.prizeDescription,
      winners_count: winners.length,
      executed_at: new Date().toISOString(),
      executed_by: session.userId,
    })
    .select("id")
    .single();

  if (raffleError || !raffle) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Falha ao criar sorteio."));
  }

  const { error: winnerError } = await admin
    .from("raffle_winners")
    .insert(winners.map((participantId) => ({ raffle_id: raffle.id, participant_id: participantId })));
  if (winnerError) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Falha ao registrar ganhadores."));
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "RAFFLE_EXECUTED",
    context: {
      event_id: parsed.data.eventId,
      event_day_id: parsed.data.eventDayId,
      raffle_id: raffle.id,
      winners_count: winners.length,
    },
  });

  redirect(withNotice(parsed.data.redirectUrl, "success", `Sorteio executado com ${winners.length} ganhador(es).`));
}

export async function deleteRaffleAction(formData: FormData) {
  const session = await requireSession(["super_adm"]);
  const parsed = deleteRaffleSchema.safeParse({
    raffleId: formData.get("raffle_id"),
    eventId: formData.get("event_id"),
    redirectUrl: formData.get("redirect_url"),
  });

  if (!parsed.success) {
    redirect("/events");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("raffles")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: session.userId,
    })
    .eq("id", parsed.data.raffleId)
    .is("deleted_at", null);
  if (error) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Não foi possível excluir sorteio."));
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "RAFFLE_DELETED",
    context: {
      event_id: parsed.data.eventId,
      raffle_id: parsed.data.raffleId,
    },
  });

  redirect(withNotice(parsed.data.redirectUrl, "success", "Sorteio excluído (lógico) com sucesso."));
}

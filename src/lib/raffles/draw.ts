import { randomInt } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type RaffleRoundWinner = {
  id: string;
  fullName: string;
  documentNumber: string;
};

export type RaffleRoundResult = {
  raffleId: string;
  roundNumber: number;
  winnersCount: number;
  executedAt: string;
  winners: RaffleRoundWinner[];
};

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

export async function executeRaffleRound(
  admin: SupabaseClient<Database>,
  input: {
    eventId: string;
    eventDayId: string;
    winnersCount: number;
    includePreviousWinners: boolean;
    executedBy: string;
  }
): Promise<RaffleRoundResult> {
  const { data: eventDay } = await admin
    .from("event_days")
    .select("id")
    .eq("id", input.eventDayId)
    .eq("event_id", input.eventId)
    .maybeSingle();
  if (!eventDay) {
    throw new Error("Dia de evento inválido.");
  }

  const { data: entryCheckins } = await admin
    .from("entry_checkins")
    .select("participant_id")
    .eq("event_day_id", input.eventDayId)
    .is("deleted_at", null);
  const eligibleParticipantIds = [...new Set((entryCheckins ?? []).map((item) => item.participant_id))];

  if (!eligibleParticipantIds.length) {
    throw new Error("Sem participantes elegíveis no dia selecionado.");
  }

  const { data: previousRaffles } = await admin
    .from("raffles")
    .select("id")
    .eq("event_day_id", input.eventDayId)
    .is("deleted_at", null);
  const activeRaffleIds = (previousRaffles ?? []).map((raffle) => raffle.id);
  const previousWinnerIds = new Set<string>();

  if (!input.includePreviousWinners && activeRaffleIds.length > 0) {
    const { data: existingWinners } = await admin
      .from("raffle_winners")
      .select("participant_id")
      .in("raffle_id", activeRaffleIds);
    (existingWinners ?? []).forEach((winner) => previousWinnerIds.add(winner.participant_id));
  }

  const availableForDraw = input.includePreviousWinners
    ? eligibleParticipantIds
    : eligibleParticipantIds.filter((id) => !previousWinnerIds.has(id));
  if (!availableForDraw.length) {
    throw new Error("Não há participantes disponíveis para esta rodada.");
  }

  const winners = pickRandomUnique(availableForDraw, input.winnersCount);
  const executedAt = new Date().toISOString();
  const { data: raffle, error: raffleError } = await admin
    .from("raffles")
    .insert({
      event_day_id: input.eventDayId,
      prize_description: `Rodada de sorteio ${(previousRaffles?.length ?? 0) + 1}`,
      winners_count: winners.length,
      executed_at: executedAt,
      executed_by: input.executedBy,
    })
    .select("id")
    .single();

  if (raffleError || !raffle) {
    throw new Error("Falha ao criar rodada de sorteio.");
  }

  const { error: winnerError } = await admin
    .from("raffle_winners")
    .insert(winners.map((participantId) => ({ raffle_id: raffle.id, participant_id: participantId })));
  if (winnerError) {
    throw new Error("Falha ao registrar ganhadores.");
  }

  const { data: winnerParticipants } = await admin
    .from("participants")
    .select("id, full_name, document_number")
    .in("id", winners);
  const winnerMap = new Map((winnerParticipants ?? []).map((winner) => [winner.id, winner]));

  await admin.from("audit_logs").insert({
    actor_user_id: input.executedBy,
    action: "RAFFLE_ROUND_EXECUTED",
    context: {
      event_id: input.eventId,
      event_day_id: input.eventDayId,
      raffle_id: raffle.id,
      winners_count: winners.length,
      include_previous_winners: input.includePreviousWinners,
    },
  });

  return {
    raffleId: raffle.id,
    roundNumber: activeRaffleIds.length + 1,
    winnersCount: winners.length,
    executedAt,
    winners: winners.map((id) => {
      const winner = winnerMap.get(id);
      return {
        id,
        fullName: winner?.full_name ?? "Participante",
        documentNumber: winner?.document_number ?? id.slice(0, 8),
      };
    }),
  };
}

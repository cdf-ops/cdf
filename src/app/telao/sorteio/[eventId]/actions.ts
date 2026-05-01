"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { executeRaffleRound } from "@/lib/raffles/draw";
import { createAdminClient } from "@/lib/supabase/admin";

const executeRaffleRoundSchema = z.object({
  eventId: z.string().uuid(),
  eventDayId: z.string().uuid(),
  winnersCount: z.coerce.number().int().positive().max(40),
  includePreviousWinners: z.boolean(),
});

export async function executeRaffleRoundAction(input: {
  eventId: string;
  eventDayId: string;
  winnersCount: number;
  includePreviousWinners: boolean;
}) {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = executeRaffleRoundSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Dados inválidos para sorteio.",
    };
  }

  try {
    const result = await executeRaffleRound(createAdminClient(), {
      eventId: parsed.data.eventId,
      eventDayId: parsed.data.eventDayId,
      winnersCount: parsed.data.winnersCount,
      includePreviousWinners: parsed.data.includePreviousWinners,
      executedBy: session.userId,
    });

    return {
      ok: true as const,
      result,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Falha ao executar sorteio.",
    };
  }
}

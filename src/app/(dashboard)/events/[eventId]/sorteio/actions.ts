"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { executeRaffleRound } from "@/lib/raffles/draw";
import { uploadRaffleSponsorBanner } from "@/lib/raffles/assets";
import { createAdminClient } from "@/lib/supabase/admin";

const executeRaffleSchema = z.object({
  eventId: z.string().uuid(),
  eventDayId: z.string().uuid(),
  winnersCount: z.coerce.number().int().positive().max(100),
  includePreviousWinners: z.coerce.boolean().default(false),
  redirectUrl: z.string().min(1),
});

const deleteRaffleSchema = z.object({
  raffleId: z.string().uuid(),
  eventId: z.string().uuid(),
  redirectUrl: z.string().min(1),
});

const sponsorBannerSchema = z.object({
  eventId: z.string().uuid(),
  redirectUrl: z.string().min(1),
  removeBanner: z.boolean(),
});

function withNotice(url: string, type: "success" | "error", message: string) {
  const safeUrl = url.startsWith("/events/") ? url : "/events";
  const separator = safeUrl.includes("?") ? "&" : "?";
  return `${safeUrl}${separator}notice_type=${type}&notice=${encodeURIComponent(message)}`;
}

export async function executeRaffleAction(formData: FormData) {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = executeRaffleSchema.safeParse({
    eventId: formData.get("event_id"),
    eventDayId: formData.get("event_day_id"),
    winnersCount: formData.get("winners_count"),
    includePreviousWinners: formData.get("include_previous_winners") === "on",
    redirectUrl: formData.get("redirect_url"),
  });

  if (!parsed.success) {
    redirect(withNotice(`/events/${String(formData.get("event_id") ?? "")}/sorteio`, "error", "Dados inválidos para sorteio."));
  }

  const admin = createAdminClient();
  try {
    const result = await executeRaffleRound(admin, {
      eventId: parsed.data.eventId,
      eventDayId: parsed.data.eventDayId,
      winnersCount: parsed.data.winnersCount,
      includePreviousWinners: parsed.data.includePreviousWinners,
      executedBy: session.userId,
    });

    redirect(withNotice(parsed.data.redirectUrl, "success", `Rodada ${result.roundNumber} executada com ${result.winnersCount} ganhador(es).`));
  } catch (error) {
    redirect(withNotice(parsed.data.redirectUrl, "error", error instanceof Error ? error.message : "Falha ao executar sorteio."));
  }
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

export async function saveRaffleSponsorBannerAction(formData: FormData) {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = sponsorBannerSchema.safeParse({
    eventId: formData.get("event_id"),
    redirectUrl: formData.get("redirect_url"),
    removeBanner: formData.get("remove_banner") === "on",
  });
  if (!parsed.success) {
    redirect("/events");
  }

  const fileValue = formData.get("sponsor_banner");
  const bannerFile = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  if (!bannerFile && !parsed.data.removeBanner) {
    redirect(withNotice(parsed.data.redirectUrl, "error", "Selecione uma imagem para o banner."));
  }

  const admin = createAdminClient();
  let bannerPath: string | null = null;
  try {
    bannerPath =
      parsed.data.removeBanner || !bannerFile
        ? null
        : await uploadRaffleSponsorBanner(admin, parsed.data.eventId, bannerFile);
    const { error } = await admin
      .from("events")
      .update({ raffle_sponsor_banner_path: bannerPath })
      .eq("id", parsed.data.eventId);
    if (error) {
      throw new Error("Não foi possível atualizar o banner deste evento.");
    }

    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "RAFFLE_SPONSOR_BANNER_UPDATED",
      context: {
        event_id: parsed.data.eventId,
        has_banner: Boolean(bannerPath),
      },
    });
  } catch (error) {
    redirect(
      withNotice(
        parsed.data.redirectUrl,
        "error",
        error instanceof Error ? error.message : "Não foi possível salvar o banner."
      )
    );
  }

  revalidatePath(`/events/${parsed.data.eventId}/sorteio`);
  revalidatePath(`/telao/sorteio/${parsed.data.eventId}`);
  redirect(
    withNotice(
      parsed.data.redirectUrl,
      "success",
      bannerPath ? "Banner dos patrocinadores atualizado." : "Banner dos patrocinadores removido."
    )
  );
}

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { loadEventBadgePdfData } from "@/lib/badges/data";
import { generateBadgePdf } from "@/lib/badges/pdf";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const participantIdSchema = z.string().uuid();

export async function POST(request: Request, context: RouteContext<"/api/events/[eventId]/credentials">) {
  const session = await getCurrentSession();
  if (!session) return new Response("Não autenticado.", { status: 401 });
  if (session.role !== "super_adm" && session.role !== "organizador") {
    return new Response("Sem permissão.", { status: 403 });
  }

  const { eventId } = await context.params;
  const formData = await request.formData();
  const requestedIds = formData
    .getAll("participant_ids")
    .map(String)
    .filter((value) => participantIdSchema.safeParse(value).success);

  const admin = createAdminClient();
  try {
    const data = await loadEventBadgePdfData(admin, eventId, requestedIds.length ? requestedIds : undefined, session.userId);
    const bytes = await generateBadgePdf(admin, data);
    const now = new Date().toISOString();
    const { data: printedBadges } = await admin
      .from("badges")
      .select("id, print_count")
      .eq("event_id", eventId)
      .in("participant_id", data.participants.map((participant) => participant.id));
    await Promise.all(
      (printedBadges ?? []).map((badge) =>
        admin
          .from("badges")
          .update({
            last_printed_at: now,
            last_printed_by: session.userId,
            print_count: badge.print_count + 1,
          })
          .eq("id", badge.id)
      )
    );

    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "BADGES_BATCH_PRINTED",
      context: { event_id: eventId, participant_count: data.participants.length },
    });

    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="credenciais-${eventId}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Falha ao gerar credenciais.", { status: 400 });
  }
}

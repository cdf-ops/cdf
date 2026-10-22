import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { loadEventBadgePdfData } from "@/lib/badges/data";
import { generateBadgePdf } from "@/lib/badges/pdf";
import { loadSponsorCredentialPdfData, recordSponsorCredentialPrints } from "@/lib/sponsor-credentials/data";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  eventId: z.string().uuid(),
  credentialType: z.enum(["participant", "sponsor"]),
  subjectId: z.string().uuid(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ eventId: string; credentialType: string; subjectId: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return new Response("Não autenticado.", { status: 401 });
  if (!(["super_adm", "organizador", "recepcao"] as string[]).includes(session.role)) {
    return new Response("Sem permissão para imprimir na recepção.", { status: 403 });
  }

  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return new Response("Dados inválidos.", { status: 400 });
  const { eventId, credentialType, subjectId } = parsed.data;
  const admin = createAdminClient();

  try {
    if (credentialType === "participant") {
      const data = await loadEventBadgePdfData(admin, eventId, [subjectId], session.userId);
      const bytes = await generateBadgePdf(admin, data);
      const participant = data.participants[0];
      const now = new Date().toISOString();
      const { data: badge } = await admin
        .from("badges")
        .select("id, print_count")
        .eq("event_id", eventId)
        .eq("participant_id", subjectId)
        .maybeSingle();

      if (badge) {
        await admin
          .from("badges")
          .update({
            last_printed_at: now,
            last_printed_by: session.userId,
            print_count: badge.print_count + 1,
          })
          .eq("id", badge.id);
      }
      await admin.from("audit_logs").insert({
        actor_user_id: session.userId,
        action: "BADGE_PRINTED_AT_RECEPTION",
        context: { event_id: eventId, participant_id: subjectId },
      });

      return pdfResponse(bytes, `credencial-${participant.participantNumber}.pdf`);
    }

    const { data: sponsorCredential } = await admin
      .from("exhibitor_credentials")
      .select("id, event_exhibitor_id, team_member_id")
      .eq("id", subjectId)
      .eq("status", "active")
      .maybeSingle();
    if (!sponsorCredential) return new Response("Credencial de patrocinador não encontrada.", { status: 404 });

    const { data: eventExhibitor } = await admin
      .from("event_exhibitors")
      .select("id")
      .eq("id", sponsorCredential.event_exhibitor_id)
      .eq("event_id", eventId)
      .maybeSingle();
    if (!eventExhibitor) return new Response("Patrocinador não vinculado a este evento.", { status: 403 });

    const data = await loadSponsorCredentialPdfData(admin, eventExhibitor.id, [sponsorCredential.team_member_id]);
    const bytes = await generateBadgePdf(admin, {
      event: data.event,
      participants: data.members.map((member) => ({
        fullName: member.fullName,
        participantNumber: member.credentialNumber,
        qrSlug: member.qrSlug,
        categoryLabel: data.settings?.sponsor_label ?? "PATROCINADOR",
      })),
      settings: data.settings,
    });
    await recordSponsorCredentialPrints(admin, {
      eventExhibitorId: eventExhibitor.id,
      memberIds: [sponsorCredential.team_member_id],
      userId: session.userId,
    });
    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "SPONSOR_CREDENTIAL_PRINTED_AT_RECEPTION",
      context: {
        event_id: eventId,
        sponsor_credential_id: sponsorCredential.id,
        team_member_id: sponsorCredential.team_member_id,
      },
    });

    return pdfResponse(bytes, `credencial-patrocinador-${sponsorCredential.team_member_id}.pdf`);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Falha ao gerar credencial.", { status: 400 });
  }
}

function pdfResponse(bytes: Uint8Array, filename: string) {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

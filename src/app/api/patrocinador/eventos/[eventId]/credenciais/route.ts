import { z } from "zod";
import { generateBadgePdf } from "@/lib/badges/pdf";
import { getSponsorSession } from "@/lib/sponsors/session";
import { loadSponsorTeamCredentialPdfData } from "@/lib/sponsors/credentials";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const uuidSchema = z.string().uuid();

export async function GET(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const memberId = new URL(request.url).searchParams.get("membro") ?? "";
  if (!uuidSchema.safeParse(memberId).success) return new Response("Integrante inválido.", { status: 400 });
  return generateResponse(context, [memberId], true);
}

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const formData = await request.formData();
  const memberIds = formData.getAll("member_ids").map(String).filter((id) => uuidSchema.safeParse(id).success);
  if (!memberIds.length) return new Response("Selecione ao menos um integrante ativo.", { status: 400 });
  return generateResponse(context, memberIds, false);
}

async function generateResponse(
  context: { params: Promise<{ eventId: string }> },
  memberIds: string[],
  inline: boolean
) {
  const session = await getSponsorSession();
  if (!session) return new Response("Sessão expirada.", { status: 401 });
  const { eventId } = await context.params;
  if (!uuidSchema.safeParse(eventId).success) return new Response("Evento inválido.", { status: 400 });
  const admin = createAdminClient();
  try {
    const data = await loadSponsorTeamCredentialPdfData(admin, {
      sponsorId: session.sponsorId,
      eventId,
      memberIds,
    });
    const bytes = await generateBadgePdf(admin, data);
    await admin.from("audit_logs").insert({
      actor_user_id: null,
      action: memberIds.length === 1 ? "SPONSOR_TEAM_CREDENTIAL_PRINTED" : "SPONSOR_TEAM_CREDENTIALS_BATCH_PRINTED",
      context: {
        sponsor_id: session.sponsorId,
        sponsor_session_id: session.sessionId,
        event_id: eventId,
        team_member_ids: memberIds,
      },
    });
    return pdfResponse(bytes, inline ? `credencial-${data.participants[0].participantNumber}.pdf` : `credenciais-${session.sponsorName}.pdf`, inline);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Falha ao gerar credenciais.", { status: 400 });
  }
}

function pdfResponse(bytes: Uint8Array, filename: string, inline: boolean) {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename.replace(/[^a-zA-Z0-9_.-]/g, "-")}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

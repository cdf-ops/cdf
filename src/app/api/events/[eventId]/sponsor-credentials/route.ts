import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { getAccessibleEventExhibitor } from "@/lib/exhibitors/access";
import {
  loadSponsorCredentialPdfData,
  recordSponsorCredentialPrints,
} from "@/lib/sponsor-credentials/data";
import { generateBadgePdf } from "@/lib/badges/pdf";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const uuidSchema = z.string().uuid();

export async function POST(request: Request, context: RouteContext<"/api/events/[eventId]/sponsor-credentials">) {
  const session = await getCurrentSession();
  if (!session) return new Response("Não autenticado.", { status: 401 });
  if (!["super_adm", "organizador", "expositor"].includes(session.role)) {
    return new Response("Sem permissão.", { status: 403 });
  }

  const { eventId } = await context.params;
  const formData = await request.formData();
  const companyId = String(formData.get("company_id") ?? "");
  const memberIds = formData
    .getAll("member_ids")
    .map(String)
    .filter((value) => uuidSchema.safeParse(value).success);
  if (!uuidSchema.safeParse(companyId).success || !memberIds.length) {
    return new Response("Selecione ao menos uma pessoa ativa da equipe.", { status: 400 });
  }

  const eventExhibitor = await getAccessibleEventExhibitor(session, eventId, companyId);
  if (!eventExhibitor) return new Response("Empresa não vinculada a este evento.", { status: 403 });

  const admin = createAdminClient();
  try {
    const data = await loadSponsorCredentialPdfData(admin, eventExhibitor.id, memberIds);
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
      memberIds: data.members.map((member) => member.id),
      userId: session.userId,
    });
    await admin.from("audit_logs").insert({
      actor_user_id: session.userId,
      action: "SPONSOR_CREDENTIALS_BATCH_PRINTED",
      context: {
        event_id: eventId,
        exhibitor_company_id: companyId,
        member_count: data.members.length,
      },
    });

    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="credenciais-patrocinador-${companyId}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Falha ao gerar credenciais.", { status: 400 });
  }
}
